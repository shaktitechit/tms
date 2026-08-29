export interface LiveSessionRecordingKeys {
  prefix: string;
  segmentsPrefix: string;
  segmentKey: (index: number) => string;
}

function assertSafeId(liveSessionId: string): string {
  if (!/^[a-fA-F0-9]{24}$/.test(liveSessionId)) {
    throw new Error('Invalid live session id');
  }
  return liveSessionId;
}

export function buildLiveSessionRecordingKeys(liveSessionId: string): LiveSessionRecordingKeys {
  const id = assertSafeId(liveSessionId);
  const prefix = `live-sessions/${id}`;
  return {
    prefix,
    segmentsPrefix: `${prefix}/segments`,
    segmentKey(index: number) {
      return `${prefix}/segments/part${String(index).padStart(3, '0')}.mp4`;
    },
  };
}
