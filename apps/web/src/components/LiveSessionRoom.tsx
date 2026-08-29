'use client';

import { useState, useEffect, useRef, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import {
  useGetLiveSessionQuery,
  useGetChatHistoryQuery,
  useUpdateLiveSessionMutation,
} from '@/store/slices';
import type { LiveChatMessageDto } from '@/lib/types';
import { canHostLiveSession } from '@/lib/roles';
import { io, Socket } from 'socket.io-client';
import { VideoPlayer } from '@/components/VideoPlayer';

interface PeerUser {
  id: string;
  role: string;
  tenantId: string;
  name?: string;
  username?: string;
  isCameraOn?: boolean;
  isMicMuted?: boolean;
  isScreenSharing?: boolean;
}

function streamHasLiveVideo(stream: MediaStream | null | undefined): boolean {
  return !!stream?.getVideoTracks().some((track) => track.readyState === 'live');
}

function playVideo(el: HTMLVideoElement | null) {
  if (!el) return;
  const attempt = el.play();
  if (attempt) attempt.catch(() => {});
}

function findVideoSender(pc: RTCPeerConnection): RTCRtpSender | undefined {
  const live = pc.getSenders().find((s) => s.track?.kind === 'video');
  if (live) return live;
  return pc.getTransceivers().find(
    (t) => t.sender.track?.kind === 'video' || t.receiver.track?.kind === 'video',
  )?.sender;
}

async function publishVideoTrack(
  peers: Record<string, RTCPeerConnection>,
  track: MediaStreamTrack | null,
  stream: MediaStream,
) {
  for (const pc of Object.values(peers)) {
    const sender = findVideoSender(pc);
    if (sender) {
      await sender.replaceTrack(track);
    } else if (track) {
      pc.addTrack(track, stream);
    }
  }
}

export function LiveSessionRoom({ role }: { role: 'tenant' | 'user' }) {
  const params = useParams<{ tenantSlug: string; userName?: string; id: string }>();
  const router = useRouter();
  const { user: currentUser } = useAuth();
  
  const sessionId = params.id;
  const [sessionPollMs, setSessionPollMs] = useState(0);
  const { data: sessionRes, isLoading: isSessionLoading, refetch: refetchSession } = useGetLiveSessionQuery(sessionId, {
    pollingInterval: sessionPollMs,
  });
  const { data: historyRes, isLoading: isHistoryLoading } = useGetChatHistoryQuery(sessionId);
  const [updateSession] = useUpdateLiveSessionMutation();

  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<LiveChatMessageDto[]>([]);
  const [isSending, setIsSending] = useState(false);
  
  // WebRTC Mesh States
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(true);
  
  // Active room participants list: socketId -> PeerUser
  const [roomUsers, setRoomUsers] = useState<Record<string, PeerUser>>({});

  // Remote Streams map: socketId -> { stream, user }
  const [remoteStreams, setRemoteStreams] = useState<
    Record<string, { stream: MediaStream; user: PeerUser }>
  >({});

  // Spotlight State: stores 'local' or the socketId of focused peer
  const [focusedPeerId, setFocusedPeerId] = useState<string | 'local'>('local');

  const chatEndRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const spotlightVideoRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const peersRef = useRef<Record<string, RTCPeerConnection>>({});
  const iceCandidateQueueRef = useRef<Record<string, any[]>>({});
  const localStreamRef = useRef<MediaStream | null>(null);
  const roomUsersRef = useRef<Record<string, PeerUser>>({});
  // Single persistent stream — tracks are added/removed in-place to avoid stream ID churn
  const persistentStreamRef = useRef<MediaStream>(new MediaStream());
  const focusedPeerIdRef = useRef<string | 'local'>('local');
  const stopScreenShareRef = useRef<() => void>(() => {});
  const enableParticipantMediaRef = useRef<() => Promise<void>>(async () => {});
  const applyHostMicCommandRef = useRef<(muted: boolean) => Promise<void>>(async () => {});
  const mediaEnableLockRef = useRef<Promise<void> | null>(null);
  const refetchSessionRef = useRef(refetchSession);
  const isScreenSharingRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const recordingMixerStopRef = useRef<(() => void) | null>(null);
  const recordingEmitChainRef = useRef(Promise.resolve());
  const recordingVideoTrackIdRef = useRef<string | null>(null);
  const rotatingRecordingRef = useRef(false);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  // Sync historical messages
  useEffect(() => {
    if (historyRes?.data) {
      setMessages(historyRes.data);
    }
  }, [historyRes]);

  // Keep local stream ref in sync for WebRTC handshakes
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  // Keep room users ref in sync to decouple signaling useEffect dependencies
  useEffect(() => {
    roomUsersRef.current = roomUsers;
  }, [roomUsers]);

  useEffect(() => {
    focusedPeerIdRef.current = focusedPeerId;
  }, [focusedPeerId]);

  useEffect(() => {
    refetchSessionRef.current = refetchSession;
  }, [refetchSession]);

  useEffect(() => {
    isScreenSharingRef.current = isScreenSharing;
  }, [isScreenSharing]);

  useEffect(() => {
    const session = sessionRes?.data;
    const shouldPoll =
      session?.status === 'ended' &&
      (session.recordingStatus === 'processing' || session.recordingStatus === 'recording');
    setSessionPollMs(shouldPoll ? 4000 : 0);
  }, [sessionRes]);

  // Emit status change to other peers over socket
  useEffect(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('update-status', { isCameraOn, isMicMuted, isScreenSharing });
    }
  }, [isCameraOn, isMicMuted, isScreenSharing]);

  // Helper to initialize peer connections
  const createPeerConnection = (targetSocketId: string, targetUser: PeerUser) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });

    // Add any existing local tracks (mic/camera already active when connecting)
    const currentStream = localStreamRef.current;
    if (currentStream) {
      currentStream.getTracks().forEach((track) => {
        pc.addTrack(track, currentStream);
      });
    }

    // Shared offer-lock to prevent double-sends from onnegotiationneeded and _initOffer
    let makingOffer = false;

    const sendOffer = async () => {
      try {
        if (makingOffer) return;
        if (pc.signalingState !== 'stable') {
          (pc as any)._needOffer = true;
          return;
        }
        makingOffer = true;
        (pc as any)._needOffer = false;
        const offer = await pc.createOffer();
        if (pc.signalingState !== 'stable') {
          (pc as any)._needOffer = true;
          return;
        }
        await pc.setLocalDescription(offer);
        socketRef.current?.emit('signal-offer', { targetSocketId, offer: pc.localDescription });
      } catch (err) {
        console.error('WebRTC offer error:', err);
      } finally {
        makingOffer = false;
        if ((pc as any)._needOffer && pc.signalingState === 'stable') {
          sendOffer();
        }
      }
    };

    pc.onsignalingstatechange = () => {
      if ((pc as any)._needOffer && pc.signalingState === 'stable') {
        sendOffer();
      }
    };

    // Fires when tracks are added/removed (mic toggle, camera toggle, screen share)
    pc.onnegotiationneeded = sendOffer;

    // Expose helpers for external use
    (pc as any)._initOffer = sendOffer;        // used by room-users to start the first handshake
    (pc as any)._makingOffer = () => makingOffer;
    // Polite peer defers to incoming offer on collision (lower socket ID = polite)
    (pc as any)._polite = (socketRef.current?.id ?? '') < targetSocketId;

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('signal-ice-candidate', {
          targetSocketId,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      const remoteStream = event.streams[0] ?? new MediaStream([event.track]);
      if (event.track && !remoteStream.getTracks().includes(event.track)) {
        remoteStream.addTrack(event.track);
      }
      setRemoteStreams((prev) => ({
        ...prev,
        [targetSocketId]: { stream: remoteStream, user: targetUser },
      }));
    };

    return pc;
  };

  // Connect to Socket.IO for signaling channel
  useEffect(() => {
    if (!sessionId) return;
    
    const socketUrl = window.location.port === '33000'
      ? `${window.location.protocol}//${window.location.hostname}:38080`
      : undefined;

    // Connect Socket.IO
    const socket = io(socketUrl, {
      path: '/socket.io',
      withCredentials: true,
      transports: ['polling', 'websocket'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join-room', sessionId);
      socket.emit('update-status', { isCameraOn, isMicMuted, isScreenSharing });
    });

    socket.on('connect_error', (err) => {
      console.error('Socket connection error details:', err.message);
    });

    socket.on('chat-message', (msg: LiveChatMessageDto) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) {
          return prev;
        }
        return [...prev, msg];
      });
    });

    // WebRTC Signaling Events
    socket.on('room-users', (usersList: { socketId: string; user: PeerUser }[]) => {
      const usersMap: Record<string, PeerUser> = {};
      usersList.forEach((u) => {
        if (u.socketId !== socket.id) usersMap[u.socketId] = u.user;
      });
      setRoomUsers(usersMap);

      // For each existing peer: we are the offerer (we joined into an existing room)
      for (const client of usersList) {
        if (client.socketId === socket.id) continue;
        if (!peersRef.current[client.socketId]) {
          const pc = createPeerConnection(client.socketId, client.user);
          peersRef.current[client.socketId] = pc;
          // Trigger the initial offer using the shared lock (same as onnegotiationneeded)
          (pc as any)._initOffer?.();
        }
      }
    });

    socket.on('user-joined', ({ socketId, user }: { socketId: string; user: PeerUser }) => {
      // Add new user to room list
      setRoomUsers((prev) => ({ ...prev, [socketId]: user }));

      // Create peer connection container only if it does not already exist
      if (!peersRef.current[socketId]) {
        const pc = createPeerConnection(socketId, user);
        peersRef.current[socketId] = pc;
      }
    });

    const processQueuedIceCandidates = async (socketId: string, pc: RTCPeerConnection) => {
      const queue = iceCandidateQueueRef.current[socketId];
      if (queue && queue.length > 0) {
        while (queue.length > 0) {
          const candidate = queue.shift();
          if (candidate) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (candErr) {
              console.warn('Error adding queued ICE candidate:', candErr);
            }
          }
        }
      }
    };

    socket.on('signal-offer', async ({ senderSocketId, offer }: { senderSocketId: string; offer: any }) => {
      try {
        let pc = peersRef.current[senderSocketId];
        if (!pc) {
          const peerProfile = roomUsersRef.current[senderSocketId] || { id: '', role: '', tenantId: '' };
          pc = createPeerConnection(senderSocketId, peerProfile);
          peersRef.current[senderSocketId] = pc;
        }

        const polite: boolean = (pc as any)._polite ?? true;
        const makingOffer: boolean = (pc as any)._makingOffer?.() ?? false;
        const offerCollision = offer.type === 'offer' && (makingOffer || pc.signalingState !== 'stable');

        if (offerCollision && !polite) {
          // Impolite peer ignores the collision — our own offer takes precedence
          return;
        }

        // Polite peer (or no collision): accept the offer, rolling back if needed
        if (pc.signalingState !== 'stable') {
          // Implicit rollback: setRemoteDescription handles it in modern browsers
          await Promise.all([
            pc.setLocalDescription({ type: 'rollback' }),
            pc.setRemoteDescription(new RTCSessionDescription(offer)),
          ]);
        } else {
          await pc.setRemoteDescription(new RTCSessionDescription(offer));
        }

        await processQueuedIceCandidates(senderSocketId, pc);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('signal-answer', { targetSocketId: senderSocketId, answer: pc.localDescription });
      } catch (err) {
        console.error('Error handling signal-offer:', err);
      }
    });

    socket.on('signal-answer', async ({ senderSocketId, answer }: { senderSocketId: string; answer: any }) => {
      try {
        const pc = peersRef.current[senderSocketId];
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
          await processQueuedIceCandidates(senderSocketId, pc);
        }
      } catch (err) {
        console.error('Error handling signal-answer:', err);
      }
    });

    socket.on('signal-ice-candidate', async ({ senderSocketId, candidate }: { senderSocketId: string; candidate: any }) => {
      try {
        const pc = peersRef.current[senderSocketId];
        if (pc && pc.remoteDescription && pc.remoteDescription.type) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } else {
          if (!iceCandidateQueueRef.current[senderSocketId]) {
            iceCandidateQueueRef.current[senderSocketId] = [];
          }
          iceCandidateQueueRef.current[senderSocketId].push(candidate);
        }
      } catch (err) {
        console.error('Error handling signal-ice-candidate:', err);
      }
    });

    socket.on('user-status-updated', ({ socketId, status }: { socketId: string; status: { isCameraOn: boolean; isMicMuted: boolean; isScreenSharing?: boolean } }) => {
      setRoomUsers((prev) => {
        if (!prev[socketId]) return prev;
        return {
          ...prev,
          [socketId]: {
            ...prev[socketId],
            ...status,
          },
        };
      });
    });

    socket.on('user-left', ({ socketId }: { socketId: string }) => {
      // Remove from connections
      if (peersRef.current[socketId]) {
        peersRef.current[socketId].close();
        delete peersRef.current[socketId];
      }
      delete iceCandidateQueueRef.current[socketId];
      
      // Remove from streams map
      setRemoteStreams((prev) => {
        const copy = { ...prev };
        delete copy[socketId];
        return copy;
      });

      // Remove from room participants list
      setRoomUsers((prev) => {
        const copy = { ...prev };
        delete copy[socketId];
        return copy;
      });

      // Fallback focus to local user if the focused peer leaves
      setFocusedPeerId((prev) => (prev === socketId ? 'local' : prev));
    });

    socket.on('activate-media', () => {
      void enableParticipantMediaRef.current();
    });

    socket.on('set-mic', (data: { muted?: boolean }) => {
      void applyHostMicCommandRef.current(!!data?.muted);
    });

    socket.on('session-status', () => {
      void refetchSessionRef.current();
    });

    socket.on('error-msg', (msg: string) => {
      console.error('Socket error event:', msg);
    });

    return () => {
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        recorder.onstop = null;
        recorder.stop();
      }
      mediaRecorderRef.current = null;
      recordingMixerStopRef.current?.();
      recordingMixerStopRef.current = null;
      socket.disconnect();
      Object.values(peersRef.current).forEach((pc) => pc.close());
      peersRef.current = {};
      iceCandidateQueueRef.current = {};
    };
  }, [sessionId]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Connect local stream to preview elements (re-bind on source change, not just stream identity)
  useEffect(() => {
    const stream = localStream;
    const localEl = localVideoRef.current;
    const spotEl = spotlightVideoRef.current;

    if (localEl) {
      localEl.srcObject = stream;
      if (streamHasLiveVideo(stream)) playVideo(localEl);
    }

    if (spotEl && focusedPeerId === 'local') {
      spotEl.srcObject = stream;
      if (streamHasLiveVideo(stream)) playVideo(spotEl);
    }
  }, [localStream, isCameraOn, isScreenSharing, focusedPeerId]);

  // Bind the focused stream to the spotlight video element
  useEffect(() => {
    const el = spotlightVideoRef.current;
    if (!el) return;

    if (focusedPeerId === 'local') {
      if (localStream) {
        el.srcObject = localStream;
      } else {
        el.srcObject = null;
      }
    } else {
      const activeData = remoteStreams[focusedPeerId];
      if (activeData?.stream) {
        el.srcObject = activeData.stream;
      } else {
        el.srcObject = null;
      }
    }
  }, [focusedPeerId, localStream, remoteStreams]);

  const handleSendChat = (e: FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !socketRef.current) return;
    socketRef.current.emit('chat-message', {
      liveSessionId: sessionId,
      message: chatInput.trim(),
    });
    setChatInput('');
  };

  const startRecording = (opts?: { resumeAfterRotate?: boolean }) => {
    const socket = socketRef.current;
    const source = persistentStreamRef.current;
    if (!socket || !streamHasLiveVideo(source)) return;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') return;

    // Record the live MediaStream directly so audio and video share one clock.
    // Camera↔screen swaps start a new WebM segment instead of a canvas mixer
    // (canvas capture lags the mic and freezes when the tab is backgrounded).
    const mimeType =
      ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp8', 'video/webm'].find((m) =>
        MediaRecorder.isTypeSupported(m),
      ) ?? 'video/webm';

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(source, {
        mimeType,
        videoBitsPerSecond: 1_200_000,
        audioBitsPerSecond: 96_000,
      });
    } catch (err) {
      console.error('Failed to start session recorder', err);
      return;
    }

    recorder.ondataavailable = (e) => {
      if (!e.data || e.data.size === 0) return;
      const blob = e.data;
      recordingEmitChainRef.current = recordingEmitChainRef.current.then(async () => {
        if (!socket.connected) return;
        const buf = await blob.arrayBuffer();
        socket.emit('stream-chunk', { liveSessionId: sessionId, chunk: buf });
      });
    };

    if (!opts?.resumeAfterRotate) {
      socket.emit('stream-start', sessionId);
    }
    recorder.start(1000);
    mediaRecorderRef.current = recorder;
    recordingVideoTrackIdRef.current =
      source.getVideoTracks().find((track) => track.readyState === 'live')?.id ?? null;
    recordingMixerStopRef.current = null;
    setIsRecording(true);
  };

  const stopRecording = async (finalize: boolean) => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      await new Promise<void>((resolve) => {
        recorder.onstop = () => {
          void recordingEmitChainRef.current.then(() => resolve());
        };
        recorder.stop();
      });
    }
    mediaRecorderRef.current = null;
    recordingMixerStopRef.current?.();
    recordingMixerStopRef.current = null;
    recordingVideoTrackIdRef.current = null;
    setIsRecording(false);
    if (finalize) {
      socketRef.current?.emit('stream-stop', sessionId);
    }
  };

  const rotateRecording = async () => {
    if (rotatingRecordingRef.current) return;
    const socket = socketRef.current;
    if (!socket) return;

    rotatingRecordingRef.current = true;
    try {
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        await new Promise<void>((resolve) => {
          recorder.onstop = () => {
            void recordingEmitChainRef.current.then(() => resolve());
          };
          recorder.stop();
        });
      }
      mediaRecorderRef.current = null;

      await new Promise<void>((resolve) => {
        const timer = window.setTimeout(resolve, 8000);
        socket.emit('stream-rotate', sessionId, () => {
          window.clearTimeout(timer);
          resolve();
        });
      });

      startRecording({ resumeAfterRotate: true });
    } catch (err) {
      console.error('Failed to rotate session recorder', err);
    } finally {
      rotatingRecordingRef.current = false;
    }
  };

  const handleToggleLive = async () => {
    if (!sessionRes?.data) return;
    const session = sessionRes.data;
    const nextStatus = session.status === 'live' ? 'ended' : 'live';
    if (nextStatus === 'ended' && !confirm('Are you sure you want to end this live session? The recording will be saved for playback.')) return;
    
    if (nextStatus === 'ended') {
      await stopRecording(true);
      stopLocalStream();
      try {
        await updateSession({ id: session.id, status: nextStatus }).unwrap();
      } catch (err) {
        console.error('Failed to update session status', err);
      }
      return;
    }

    setIsStarting(true);
    try {
      await enableParticipantMediaRef.current();
      socketRef.current?.emit('session-start', sessionId);
      await updateSession({ id: session.id, status: 'live' }).unwrap();
    } catch (err) {
      console.error('Failed to start live session', err);
    } finally {
      setIsStarting(false);
    }
  };

  useEffect(() => {
    const session = sessionRes?.data;
    if (!session || session.status !== 'live' || !currentUser?.id) return;
    const hostId = String(session.host?.id || session.host);
    const canRecord = hostId === currentUser.id && canHostLiveSession(currentUser);
    if (canRecord && streamHasLiveVideo(localStream)) {
      const liveVideo = persistentStreamRef.current
        .getVideoTracks()
        .find((track) => track.readyState === 'live');
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        if (liveVideo && liveVideo.id !== recordingVideoTrackIdRef.current) {
          void rotateRecording();
        }
        return;
      }
      if (!rotatingRecordingRef.current) {
        startRecording();
      }
    }
  }, [sessionRes, localStream, isCameraOn, isScreenSharing, currentUser]);

  useEffect(() => {
    if (sessionRes?.data?.status === 'ended') {
      void stopRecording(false);
    }
  }, [sessionRes?.data?.status]);

  const enableCamera = async () => {
    if (isScreenSharingRef.current) return;
    if (streamHasLiveVideo(persistentStreamRef.current)) {
      setIsCameraOn(true);
      return;
    }

    try {
      setMediaError(null);
      const videoStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280, max: 1280 }, height: { ideal: 720, max: 720 }, frameRate: { ideal: 24, max: 30 } },
      });
      const newVideoTrack = videoStream.getVideoTracks()[0];
      if (!newVideoTrack) return;

      const oldVideo = persistentStreamRef.current.getVideoTracks()[0];
      if (oldVideo) {
        oldVideo.onended = null;
        oldVideo.stop();
        persistentStreamRef.current.removeTrack(oldVideo);
      }

      persistentStreamRef.current.addTrack(newVideoTrack);
      setLocalStream(persistentStreamRef.current);
      await publishVideoTrack(peersRef.current, newVideoTrack, persistentStreamRef.current);

      setIsCameraOn(true);
      setIsScreenSharing(false);
    } catch (err) {
      console.error('Failed accessing camera:', err);
      setMediaError('Allow camera access when prompted so the session can start.');
    }
  };

  const enableMic = async () => {
    const existingAudioTrack = persistentStreamRef.current.getAudioTracks()[0] ?? null;
    if (existingAudioTrack) {
      existingAudioTrack.enabled = true;
      setIsMicMuted(false);
      return;
    }

    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const newAudioTrack = audioStream.getAudioTracks()[0];
      if (!newAudioTrack) return;

      persistentStreamRef.current.addTrack(newAudioTrack);
      setLocalStream(persistentStreamRef.current);

      for (const pc of Object.values(peersRef.current)) {
        const audioSender = pc.getSenders().find((s) => s.track?.kind === 'audio');
        if (audioSender) {
          await audioSender.replaceTrack(newAudioTrack);
        } else {
          pc.addTrack(newAudioTrack, persistentStreamRef.current);
        }
      }
      setIsMicMuted(false);
    } catch (err) {
      console.error('Failed accessing microphone:', err);
      setMediaError('Allow microphone access when prompted so others can hear you.');
    }
  };

  enableParticipantMediaRef.current = () => {
    if (mediaEnableLockRef.current) return mediaEnableLockRef.current;
    const run = (async () => {
      await enableCamera();
      await enableMic();
    })().finally(() => {
      mediaEnableLockRef.current = null;
    });
    mediaEnableLockRef.current = run;
    return run;
  };

  applyHostMicCommandRef.current = async (muted: boolean) => {
    if (muted) {
      const track = persistentStreamRef.current.getAudioTracks()[0];
      if (track) track.enabled = false;
      setIsMicMuted(true);
      setMediaError('The host muted your microphone.');
      return;
    }
    setMediaError(null);
    await enableMic();
  };

  // Capture Camera
  const toggleCamera = async () => {
    if (isCameraOn) {
      const videoTrack = persistentStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = null;
        videoTrack.stop();
        persistentStreamRef.current.removeTrack(videoTrack);
      }
      setIsCameraOn(false);
      await publishVideoTrack(peersRef.current, null, persistentStreamRef.current);

      const remaining = persistentStreamRef.current.getTracks();
      setLocalStream(remaining.length > 0 ? persistentStreamRef.current : null);
    } else {
      await enableCamera();
    }
  };

  // Capture Screen Sharing
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      stopScreenShare();
      return;
    }

    try {
      setMediaError(null);
      if (!navigator.mediaDevices?.getDisplayMedia) {
        setMediaError('Screen sharing is not supported here. Use Chrome or Edge on HTTPS/localhost.');
        return;
      }

      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: { max: 1280 }, height: { max: 720 }, frameRate: { ideal: 15, max: 24 } },
      });
      const newVideoTrack = screenStream.getVideoTracks()[0];
      if (!newVideoTrack) {
        setMediaError('No screen track was returned. Try another window or screen.');
        return;
      }

      try {
        await newVideoTrack.applyConstraints({
          width: { max: 1280 },
          height: { max: 720 },
          frameRate: { max: 24 },
        });
      } catch {
        // constraints are best-effort
      }

      newVideoTrack.onended = () => stopScreenShareRef.current();

      const oldVideo = persistentStreamRef.current.getVideoTracks()[0];
      if (oldVideo) {
        oldVideo.onended = null;
        oldVideo.stop();
        persistentStreamRef.current.removeTrack(oldVideo);
      }

      persistentStreamRef.current.addTrack(newVideoTrack);
      try {
        newVideoTrack.contentHint = 'detail';
      } catch {
        // older browsers
      }

      setLocalStream(persistentStreamRef.current);
      setIsScreenSharing(true);
      setIsCameraOn(false);

      await publishVideoTrack(peersRef.current, newVideoTrack, persistentStreamRef.current);

      const stream = persistentStreamRef.current;
      requestAnimationFrame(() => {
        const localEl = localVideoRef.current;
        const spotEl = spotlightVideoRef.current;
        if (localEl) {
          localEl.srcObject = stream;
          playVideo(localEl);
        }
        if (spotEl && focusedPeerIdRef.current === 'local') {
          spotEl.srcObject = stream;
          playVideo(spotEl);
        }
      });
    } catch (err) {
      console.error('Failed accessing screen share:', err);
      const name = err instanceof DOMException ? err.name : '';
      if (name === 'NotAllowedError' || name === 'AbortError') {
        setMediaError('Screen share was blocked or cancelled. On macOS, allow Screen Recording for this browser in System Settings.');
        return;
      }
      setMediaError('Could not start screen sharing. Check browser permissions and try again.');
    }
  };

  const stopScreenShare = () => {
    const videoTrack = persistentStreamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.onended = null;
      videoTrack.stop();
      persistentStreamRef.current.removeTrack(videoTrack);
    }
    setIsScreenSharing(false);
    void publishVideoTrack(peersRef.current, null, persistentStreamRef.current);

    const remaining = persistentStreamRef.current.getTracks();
    setLocalStream(remaining.length > 0 ? persistentStreamRef.current : null);
  };
  stopScreenShareRef.current = stopScreenShare;

  const toggleMic = async () => {
    const existingAudioTrack = persistentStreamRef.current.getAudioTracks()[0] ?? null;

    if (existingAudioTrack) {
      existingAudioTrack.enabled = !existingAudioTrack.enabled;
      setIsMicMuted(!existingAudioTrack.enabled);
      return;
    }

    await enableMic();
  };

  const stopLocalStream = () => {
    persistentStreamRef.current.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
      persistentStreamRef.current.removeTrack(track);
    });
    setLocalStream(null);
    setIsCameraOn(false);
    setIsScreenSharing(false);
    setIsMicMuted(true);
    setFocusedPeerId('local');

    // Remove all track senders from peer connections
    for (const pc of Object.values(peersRef.current)) {
      pc.getSenders().forEach((sender) => {
        if (sender.track) sender.track.stop();
        pc.removeTrack(sender);
      });
    }
  };


  if (isSessionLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-slate-950 text-white min-h-screen">
        <div className="w-8 h-8 border-4 border-slate-100 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const session = sessionRes?.data;
  if (!session) {
    return (
      <div className="p-6 text-center text-slate-500 bg-slate-950 text-white min-h-screen flex items-center justify-center">
        Live session not found or you do not have permission to join.
      </div>
    );
  }

  const isLive = session.status === 'live';
  const isUpcoming = session.status === 'upcoming';
  const isEnded = session.status === 'ended';
  const isHost = String(session.host?.id || session.host) === currentUser?.id;
  const canHost = canHostLiveSession(currentUser);
  const canControlMics = isHost && canHost && !isEnded;

  const setParticipantMic = (targetSocketId: string | 'all', muted: boolean) => {
    socketRef.current?.emit('host-set-mic', {
      liveSessionId: sessionId,
      targetSocketId,
      muted,
    });
    setRoomUsers((prev) => {
      if (targetSocketId === 'all') {
        const next: Record<string, PeerUser> = {};
        for (const [id, user] of Object.entries(prev)) {
          next[id] = { ...user, isMicMuted: muted };
        }
        return next;
      }
      const current = prev[targetSocketId];
      if (!current) return prev;
      return { ...prev, [targetSocketId]: { ...current, isMicMuted: muted } };
    });
  };

  const sessionsListLink =
    role === 'tenant'
      ? `/${params.tenantSlug}/live-sessions`
      : `/${params.tenantSlug}/${params.userName}/live-sessions`;

  // Dynamic Video Grid Items (Local user + remote participants)
  const roomPeersList = Object.entries(roomUsers);
  const totalGridItems = 1 + roomPeersList.length; // Always include local user

  // Resolve active focused peer info
  const focusedUser =
    focusedPeerId === 'local'
      ? { name: 'Me (You)', initials: currentUser?.username?.slice(0, 2).toUpperCase() || 'ME' }
      : {
          name: roomUsers[focusedPeerId]?.name || roomUsers[focusedPeerId]?.username || 'Anonymous',
          initials: (roomUsers[focusedPeerId]?.name || roomUsers[focusedPeerId]?.username || 'Peer')
            .slice(0, 2)
            .toUpperCase(),
        };

  const isLocalVideoActive = streamHasLiveVideo(localStream);
  const isFocusedStreamActive =
    focusedPeerId === 'local'
      ? isLocalVideoActive
      : streamHasLiveVideo(remoteStreams[focusedPeerId]?.stream);
  const focusedIsScreenShare =
    focusedPeerId === 'local'
      ? isScreenSharing
      : !!roomUsers[focusedPeerId]?.isScreenSharing;

  return (
    <>
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Header Bar */}
      <header className="flex items-center justify-between px-6 py-4 bg-slate-900/60 border-b border-slate-800/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Link
            href={sessionsListLink}
            onClick={stopLocalStream}
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            ← Leave
          </Link>
          <div>
            <h1 className="text-lg font-bold tracking-tight line-clamp-1">{session.title}</h1>
            <p className="text-xs text-slate-400">
              Host: {session.host.name || session.host.username} • Participants: {totalGridItems}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                isLive ? 'bg-red-500 animate-pulse' : isUpcoming ? 'bg-blue-500' : 'bg-slate-600'
              }`}
            />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              {session.status}
            </span>
          </div>
          {isLive && isRecording && (
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-red-600/20 text-[10px] font-bold uppercase tracking-widest text-red-400">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
              Recording
            </span>
          )}

          {canHost && isHost && !isEnded && (
            <button
              onClick={handleToggleLive}
              disabled={isStarting}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-60 ${
                isLive
                  ? 'bg-red-600 hover:bg-red-500 text-white shadow-md shadow-red-600/10'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              {isLive ? 'End Session' : isStarting ? 'Starting…' : 'Start'}
            </button>
          )}
        </div>
      </header>

      {/* Main Room Layout */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden max-h-[calc(100vh-73px)]">
        
        {/* Spotlight Video Display (Left/Center) */}
        <div className="flex-1 bg-slate-950 flex flex-col justify-between overflow-y-auto p-6 relative">
          
          {isEnded ? (
            <div className="flex-1 flex items-center justify-center p-2">
              <div className="w-full max-w-4xl rounded-3xl overflow-hidden bg-slate-900 border border-slate-800/80 shadow-2xl">
                {session.playbackUrl ? (
                  <VideoPlayer src={session.playbackUrl} poster={session.thumbnailUrl} />
                ) : session.recordingStatus === 'processing' || session.recordingStatus === 'recording' ? (
                  <div className="aspect-video flex flex-col items-center justify-center text-center space-y-3 px-6">
                    <div className="w-8 h-8 border-4 border-slate-100 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm font-semibold text-slate-200">Preparing recording…</p>
                    <p className="text-xs text-slate-500">Playback will appear here when processing finishes.</p>
                  </div>
                ) : session.recordingStatus === 'failed' ? (
                  <div className="aspect-video flex flex-col items-center justify-center text-center px-6">
                    <p className="text-sm font-semibold text-slate-200">Recording failed</p>
                    <p className="text-xs text-slate-500 mt-2">The session recording could not be saved.</p>
                  </div>
                ) : (
                  <div className="aspect-video flex flex-col items-center justify-center text-center px-6">
                    <p className="text-sm font-semibold text-slate-200">No recording</p>
                    <p className="text-xs text-slate-500 mt-2">Turn on camera or screen share during the meeting to save a recording.</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
          <>
          <div className="flex-1 flex items-center justify-center p-2">
            {/* Featured Spotlight Area */}
            <div className="w-full max-w-4xl aspect-video rounded-3xl overflow-hidden bg-slate-900 border border-slate-800/80 shadow-2xl relative">
              <video
                ref={spotlightVideoRef}
                autoPlay
                playsInline
                muted={focusedPeerId === 'local'}
                className={`w-full h-full bg-black ${
                  focusedPeerId === 'local' && !isScreenSharing ? 'scale-x-[-1] object-cover' : 'object-contain'
                }`}
              />
              {!isFocusedStreamActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 text-center space-y-4">
                  <div className="h-20 w-20 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xl font-bold text-slate-300">
                    {focusedUser.initials}
                  </div>
                  <p className="text-sm text-slate-400 font-semibold">{focusedUser.name} (No video)</p>
                </div>
              )}

              {/* Label Tag on main spotlight */}
              <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-md px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-slate-800/50">
                <span>{focusedUser.name}</span>
                {focusedIsScreenShare && <span className="text-[10px]">🖥️</span>}
                {focusedPeerId === 'local' && isMicMuted && (
                  <span className="text-[10px] text-red-400">🔇</span>
                )}
              </div>
            </div>
          </div>

          {isUpcoming && (
            <p className="text-center text-xs text-slate-400 mt-3 px-4">
              {isHost
                ? 'Click Start to begin recording and turn on everyone’s camera and microphone.'
                : 'Waiting for the host to start. Camera and microphone will turn on automatically.'}
            </p>
          )}

          {mediaError && (
            <p className="text-center text-xs text-amber-400 mt-3 px-4">{mediaError}</p>
          )}

          {/* Conference Control Toolbar */}
          <div className="bg-slate-900/60 border border-slate-800/60 backdrop-blur-md rounded-2xl p-4 flex items-center justify-center gap-4 max-w-sm mx-auto w-full mt-4">
            <button
              onClick={toggleMic}
              className={`p-3.5 rounded-xl transition-all shadow-lg hover:scale-105 active:scale-95 ${
                isMicMuted
                  ? 'bg-red-600/90 hover:bg-red-500 text-white shadow-red-600/10'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
              title={isMicMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {isMicMuted ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="2" x2="22" y1="2" y2="22" />
                  <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
                  <path d="M5 10v2a7 7 0 0 0 12 5" />
                  <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
                  <line x1="12" x2="12" y1="19" y2="22" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" x2="12" y1="19" y2="22" />
                </svg>
              )}
            </button>
            <button
              onClick={toggleCamera}
              className={`p-3.5 rounded-xl transition-all shadow-lg hover:scale-105 active:scale-95 ${
                isCameraOn
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/10'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
              title={isCameraOn ? 'Turn camera off' : 'Turn camera on'}
            >
              {isCameraOn ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m22 8-6 4 6 4V8Z" />
                  <rect width="14" height="12" x="2" y="6" rx="2" ry="2" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="2" x2="22" y1="2" y2="22" />
                  <path d="M10.66 6H14a2 2 0 0 1 2 2v3.34" />
                  <path d="M16 16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2.34" />
                  <path d="m22 8-6 4 6 4V8Z" />
                </svg>
              )}
            </button>
            <button
              type="button"
              onClick={toggleScreenShare}
              className={`p-3.5 rounded-xl transition-all shadow-lg hover:scale-105 active:scale-95 ${
                isScreenSharing
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/10'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
              title={isScreenSharing ? 'Stop sharing screen' : 'Share screen'}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="12" x="3" y="4" rx="2" />
                <path d="M12 16v4" />
                <path d="M12 12V8" />
                <path d="m9 11 3-3 3 3" />
                <path d="M8 20h8" />
              </svg>
            </button>
            <button
              onClick={stopLocalStream}
              disabled={!localStream}
              className="p-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white disabled:opacity-50 transition-all shadow-lg hover:scale-105 active:scale-95"
              title="Close active camera/screen stream"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="m15 9-6 6" />
                <path d="m9 9 6 6" />
              </svg>
            </button>
          </div>
          </>
          )}
        </div>

        {/* Clickable Participant Widgets (Middle Column / Sidebar) */}
        <div className="w-full md:w-56 bg-slate-900/40 border-t md:border-t-0 md:border-l border-slate-800/80 flex flex-col flex-shrink-0">
          <div className="px-4 py-3 border-b border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-xs text-slate-300 uppercase tracking-widest">Participants</h3>
              <span className="bg-slate-800 px-2 py-0.5 rounded text-[10px] text-slate-400 font-semibold">
                {totalGridItems}
              </span>
            </div>
            {canControlMics && roomPeersList.length > 0 && (
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setParticipantMic('all', false)}
                  className="flex-1 px-2 py-1 rounded-md bg-emerald-600/20 hover:bg-emerald-600/30 text-[10px] font-bold uppercase tracking-wide text-emerald-300"
                  title="Allow every participant microphone"
                >
                  Unmute all
                </button>
                <button
                  type="button"
                  onClick={() => setParticipantMic('all', true)}
                  className="flex-1 px-2 py-1 rounded-md bg-red-600/20 hover:bg-red-600/30 text-[10px] font-bold uppercase tracking-wide text-red-300"
                  title="Mute every participant microphone"
                >
                  Mute all
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {/* Me thumbnail widget (Always displayed) */}
            <button
              onClick={() => setFocusedPeerId('local')}
              className={`w-full text-left rounded-xl overflow-hidden bg-slate-950 border transition-all relative block aspect-video ${
                focusedPeerId === 'local'
                  ? 'border-blue-500 ring-1 ring-blue-500'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className={`w-full h-full pointer-events-none ${
                  isScreenSharing ? 'object-contain bg-black' : 'object-cover scale-x-[-1]'
                } ${isLocalVideoActive ? '' : 'invisible'}`}
              />
              {!isLocalVideoActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900">
                  <div className="h-10 w-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                    {currentUser?.username?.slice(0, 2).toUpperCase() || 'ME'}
                  </div>
                </div>
              )}
              <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between pointer-events-none bg-black/60 px-1.5 py-0.5 rounded text-[9px] font-semibold text-slate-300 select-none font-sans">
                <span className="truncate max-w-[65%]">Me (You)</span>
                <div className="flex items-center gap-1.5">
                  <span>{isMicMuted ? '🔇' : '🎙️'}</span>
                  <span>{isScreenSharing ? '🖥️' : isCameraOn ? '📹' : '📷'}</span>
                </div>
              </div>
            </button>

            {/* Remote thumbnails widgets */}
            {roomPeersList.map(([socketId, user]) => {
              const name = user.name || user.username || 'Anonymous';
              const streamData = remoteStreams[socketId];
              const isPeerVideoActive = streamHasLiveVideo(streamData?.stream);
              const isCurrentFocused = focusedPeerId === socketId;
              const peerMuted = !!user.isMicMuted;

              return (
                <div
                  key={socketId}
                  className={`w-full text-left rounded-xl overflow-hidden bg-slate-950 border transition-all relative block aspect-video ${
                    isCurrentFocused
                      ? 'border-blue-500 ring-1 ring-blue-500'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setFocusedPeerId(socketId)}
                    className="absolute inset-0 z-0"
                    aria-label={`Focus ${name}`}
                  />
                  {isPeerVideoActive ? (
                    <video
                      autoPlay
                      playsInline
                      ref={(el) => {
                        if (el && streamData.stream) {
                          if (el.srcObject !== streamData.stream) {
                            el.srcObject = streamData.stream;
                          }
                          playVideo(el);
                        }
                      }}
                      className="w-full h-full object-contain bg-black pointer-events-none"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 pointer-events-none">
                      <div className="h-10 w-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                        {name.slice(0, 2).toUpperCase()}
                      </div>
                    </div>
                  )}
                  {canControlMics && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setParticipantMic(socketId, !peerMuted);
                      }}
                      className={`absolute top-1.5 right-1.5 z-10 p-1.5 rounded-lg text-sm shadow-lg ${
                        peerMuted
                          ? 'bg-red-600 hover:bg-red-500 text-white'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      }`}
                      title={peerMuted ? `Allow ${name}'s microphone` : `Mute ${name}`}
                    >
                      {peerMuted ? '🔇' : '🎙️'}
                    </button>
                  )}
                  <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between pointer-events-none bg-black/70 px-1.5 py-0.5 rounded text-[9px] font-semibold text-slate-300 select-none font-sans">
                    <span className="truncate max-w-[65%]">{name}</span>
                    <div className="flex items-center gap-1.5">
                      <span>{peerMuted ? '🔇' : '🎙️'}</span>
                      <span>{user.isScreenSharing ? '🖥️' : user.isCameraOn ? '📹' : '📷'}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live discussion chat (Far Right Sidebar) */}
        <div className="w-full md:w-80 bg-slate-900 border-t md:border-t-0 md:border-l border-slate-800 flex flex-col overflow-hidden flex-shrink-0">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-200">Live Discussion</h3>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-800 rounded-full text-xs font-semibold text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {messages.length} messages
            </span>
          </div>

          {/* Messages list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[250px]">
            {isHistoryLoading ? (
              <div className="flex items-center justify-center h-full">
                <span className="text-xs text-slate-500">Loading chat history...</span>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-4">
                <span className="text-3xl mb-2">💬</span>
                <p className="text-xs text-slate-500">No messages yet. Send a message to start the discussion!</p>
              </div>
            ) : (
              messages.map((msg) => {
                const senderName = msg.sender.name || msg.sender.username || 'Anonymous';
                const initials = senderName.slice(0, 2).toUpperCase();
                
                return (
                  <div key={msg.id} className="flex items-start gap-3 text-sm">
                    <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-slate-300 flex-shrink-0 select-none">
                      {initials}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-baseline gap-2">
                        <span className="font-semibold text-slate-200">{senderName}</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-slate-300 leading-relaxed break-words">{msg.message}</p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat send input */}
          {isEnded ? (
            <div className="p-4 border-t border-slate-800 bg-slate-950/40 text-center">
              <p className="text-xs text-slate-500">This session has ended. Chat is archived.</p>
            </div>
          ) : (
            <form onSubmit={handleSendChat} className="p-4 border-t border-slate-800 bg-slate-950/20">
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={1000}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Send a message..."
                  disabled={isEnded || isSending}
                  className="flex-1 px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-700 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={isEnded || isSending || !chatInput.trim()}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-950 font-bold rounded-lg text-sm transition-colors disabled:opacity-50 flex-shrink-0"
                >
                  Send
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>

    {/* Hidden audio elements — play remote audio streams regardless of camera state */}
    {Object.entries(remoteStreams).map(([socketId, { stream }]) => (
      <audio
        key={socketId}
        autoPlay
        ref={(el) => {
          if (el && stream) {
            el.srcObject = stream;
          }
        }}
        style={{ display: 'none' }}
      />
    ))}
    </>
  );
}
