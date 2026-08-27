# StreamForge — HLS Video Streaming Platform

Production-oriented video hosting platform: upload from Next.js, store originals in MinIO, transcode to adaptive HLS with FFmpeg in a dedicated BullMQ worker, and play back through an authenticated streaming layer.

## Architecture

```
Next.js
   |
   | HTTP /api (rewritten or via Nginx)
   v
Express API
   |
   +---- MongoDB
   |
   +---- MinIO (original + HLS + thumbnail)
   |
   +---- Redis / BullMQ
             |
             v
       Video Worker  (FFmpeg + ffprobe)
             |
             v
           MinIO
             |
             v
          MongoDB (READY / FAILED)
```

Videos are **never** transcoded inside an Express request. `POST /api/videos` stores the original object, creates a MongoDB record, enqueues a job, and returns `{ id, status: "QUEUED" }`.

HLS files are **not** served by exposing the MinIO bucket. The player loads:

```
/api/videos/:id/hls/master.m3u8
```

The API checks visibility (public / unlisted / private), then streams playlists and `.ts` segments from object storage. Private videos require the session cookie.

## Repository layout

```
apps/web          Next.js App Router UI + hls.js player
apps/api          Express API, auth, upload, streaming proxy
apps/worker       BullMQ worker + FFmpeg/HLS/thumbnail
packages/shared   Types, models, storage, queue, validation
packages/config   Shared ESLint / TS config
docker/           Dockerfiles + Nginx
docs/             Operator guides (MongoDB, …)
```

See [docs/](./docs/README.md) for how to inspect and edit local data stores.

## Requirements

- Node.js 20+
- Docker + Docker Compose (recommended)
- FFmpeg + ffprobe **only on the worker**. They are installed in `docker/worker.Dockerfile`. For `npm run worker` on the host, install FFmpeg locally.

## Environment variables

Copy the example file:

```bash
cp .env.example .env
```

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | `development` / `production` / `test` |
| `PORT` | API port (default `4000`) |
| `MONGO_URI` | MongoDB connection string |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | BullMQ connection |
| `MINIO_ENDPOINT` / `MINIO_PORT` | Object storage host |
| `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` | Storage credentials (**never** sent to the browser) |
| `MINIO_BUCKET` | Bucket name (default `contents`) |
| `MINIO_USE_SSL` | `true` / `false` |
| `MINIO_PUBLIC_URL` | Optional public/CDN base used by `getPublicUrl` |
| `NEXT_PUBLIC_API_URL` | Leave empty; the web app calls same-origin `/api` |
| `API_INTERNAL_URL` | Server-side rewrite target (`http://localhost:4000` locally, `http://api:4000` in Compose) |
| `VIDEO_MAX_SIZE` | Max upload bytes (default 5 GB) |
| `HLS_SEGMENT_DURATION` | HLS segment length in seconds (default `6`) |
| `FFMPEG_PRESET` / `FFMPEG_CRF` | Transcode quality/speed |
| `JWT_SECRET` / `JWT_EXPIRES_IN` | HTTP-only session cookie |
| `CORS_ORIGIN` | Comma-separated browser origins |
| `WORKER_TEMP_DIR` | Per-job temp directory root |

Change `JWT_SECRET` and MinIO keys before any real deployment.

## Installation (local development)

```bash
cp .env.example .env
npm install
```

Start MongoDB, Redis, and MinIO (API/worker/web can run on the host):

```bash
docker compose up -d mongodb redis minio minio-init
npm run build -w @video/shared
npm run dev
```

This starts:

- shared TypeScript watch
- API at `http://localhost:4000`
- worker (requires host FFmpeg)
- Next.js at `http://localhost:3000`

Useful splits:

```bash
npm run dev:api
npm run dev:worker
npm run dev:web
npm run worker          # production worker entry after build
npm run build
npm test
```

## Docker setup

Full stack, including Nginx, API, worker (with FFmpeg), and web:

```bash
cp .env.example .env
docker compose up -d --build
docker compose logs -f worker
```

If images are already built, skip the Hub pull:

```bash
docker compose up -d
```

If Docker Hub times out during `--build` (`TLS handshake timeout` for `node:20-bookworm-slim`), start without `--build` once `video-service-api`, `video-service-worker`, and `video-service-web` exist locally.

| Entry | URL |
| --- | --- |
| App via Nginx | http://localhost:8080 |
| Next.js direct | http://localhost:3000 |
| API direct | http://localhost:4000 |
| MinIO S3 API | http://localhost:9010 |
| MinIO console | http://localhost:9011 |
| MongoDB | localhost:27017 |
| Redis | localhost:6379 |

Health check: `GET http://localhost:8080/api/health`

## Production notes

- Terminate TLS in front of Nginx.
- Point `CORS_ORIGIN` at the real site origin.
- Keep the MinIO bucket **private**. Playback always goes through `/api/videos/:id/hls/*`.
- Scale workers horizontally; `WORKER_CONCURRENCY` controls jobs per process.
- Swap MinIO for S3 / R2 / B2 / Wasabi by changing the storage env vars. The application uses the AWS S3 SDK with path-style addressing.

## Upload flow

1. Sign in (`/register` or `/login`). Sessions are HTTP-only cookies, not `localStorage` JWTs.
2. Open `/upload`, drop an MP4/WebM/MOV/MKV, preview it, submit.
3. The browser uses `XMLHttpRequest` so upload progress is visible (0% → 100%).
4. API validates MIME + extension + size, writes `videos/{id}/original/source.mp4` to MinIO, inserts a Video document, enqueues BullMQ job `process-video` with `jobId = videoId`.
5. Response:

```json
{
  "success": true,
  "video": { "id": "66c9e8abc1234567890abcde", "status": "QUEUED" }
}
```

6. The page polls `GET /api/videos/:id/status` until `READY` or `FAILED`, then stops.

## Video processing flow

State machine:

```
UPLOADING → UPLOADED → QUEUED → PROCESSING → READY
                                      ↘ FAILED
```

The worker:

1. Downloads the original from MinIO into `/tmp/video-processing/{videoId}-{jobId}-{uuid}/`
2. Probes with `ffprobe` (duration, width, height, codec, bitrate, FPS, audio)
3. Picks renditions **without upscaling** (1080p source → 1080/720/480/360; 720p source → 720/480/360; 360p → 360)
4. Writes a JPEG thumbnail at ~10% of duration
5. Transcodes each ladder rung to HLS (`hls_time` from `HLS_SEGMENT_DURATION`, independent MPEG-TS segments)
6. Writes `master.m3u8` containing only generated variants
7. Uploads `hls/` + thumbnail to MinIO
8. Sets MongoDB `status=READY`, `availableQualities`, `hlsMasterPlaylistKey`
9. Deletes the temp directory (also on failure)

BullMQ: 3 attempts, exponential backoff from 5s. Corrupt inputs throw an unrecoverable error (no retry). Worker crashes leave a stalled job that is retried; final failure stores `FAILED` + `errorMessage` and **keeps the original file**.

## HLS layout

```
videos/{videoId}/
  original/source.mp4
  hls/master.m3u8
  hls/360p/index.m3u8
  hls/360p/segment000.ts
  hls/480p/...
  hls/720p/...
  hls/1080p/...          # only if source height >= 1080
  thumbnail/thumbnail.jpg
```

Watch URL: `http://localhost:3000/watch/{videoId}`  
Player source: `/api/videos/{videoId}/hls/master.m3u8`  
hls.js handles MSE browsers; Safari uses native HLS. The original MP4 is not the playback source.

## API endpoints

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | No | Create user + session cookie |
| POST | `/api/auth/login` | No | Login |
| POST | `/api/auth/logout` | No | Clear cookie |
| GET | `/api/auth/me` | Yes | Current user |
| POST | `/api/videos` | Yes | Multipart upload (`video` file + `title` `description` `visibility`) |
| GET | `/api/videos` | Optional | Library (`?status=READY`) |
| GET | `/api/videos/:id` | Visibility | Metadata |
| GET | `/api/videos/:id/status` | Visibility | `{ id, status, progress }` |
| GET | `/api/videos/:id/stream` | Visibility | Playback URL payload |
| GET | `/api/videos/:id/hls/*` | Visibility | Playlist/segment proxy |
| GET | `/api/videos/:id/thumbnail` | Visibility | JPEG |
| PATCH | `/api/videos/:id` | Owner/admin | title/description/visibility |
| DELETE | `/api/videos/:id` | Owner/admin | Record + objects + job |
| GET | `/api/health` | No | Liveness |

Error shape:

```json
{ "success": false, "message": "Video processing failed", "code": "VIDEO_PROCESSING_FAILED" }
```

## Frontend pages

| Path | Purpose |
| --- | --- |
| `/` | Homepage |
| `/videos` | Library + All / Processing / Ready / Failed filters |
| `/upload` | Drag-and-drop uploader + progress + processing status |
| `/watch/[videoId]` | HLS player |
| `/videos/[id]` | Management/details + delete |
| `/login` `/register` | Auth |

## MinIO

Compose creates a private `videos` bucket (`mc anonymous set none`). The reusable `S3CompatibleStorage` service implements `upload`, `download`, `delete` / `deletePrefix`, `exists`, `getMetadata`, `getPublicUrl`, and `getSignedUrl`.

## FFmpeg

Worker image installs `ffmpeg` and `ffprobe`. Commands are assembled in `apps/worker/src/services/hls.ts` and `thumbnail.ts` and are driven by `HLS_SEGMENT_DURATION`, `FFMPEG_PRESET`, and `FFMPEG_CRF`.

Follow worker logs:

```bash
docker compose logs -f worker
```

You should see stages: `download`, `probe`, `thumbnail`, `transcode`, `upload`, `complete`.

## Testing

```bash
npm test
```

Coverage includes Video/User schemas, upload validation, storage keys/path traversal, quality ladder (no upscale), access control, queue job ids, serializer/status payloads, auth validation, unauthorized upload, deletion authorization + idempotency, processing failure → `FAILED`, and HLS master playlist generation.

### Manual end-to-end

1. `docker compose up -d --build` (or `docker compose up -d` if images already exist)
2. Open http://localhost:8080/register
3. Upload an MP4 at `/upload`
4. Confirm MongoDB: `status` moves `QUEUED` → `PROCESSING` → `READY`
5. Confirm Redis/BullMQ job `process-video` with `jobId = videoId`
6. Confirm worker logs show FFmpeg commands
7. In MinIO, inspect `videos/{id}/hls/master.m3u8` and variant folders
8. Open `/watch/{videoId}`, play, seek, switch Auto/quality
9. Delete from `/videos/{id}` and confirm the object prefix is gone

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| Upload 401 | Register/login; cookie not blocked |
| Stuck on QUEUED | `docker compose logs worker`; Redis reachable; FFmpeg present in worker |
| FAILED after probe | Unsupported/corrupt input; `errorMessage` on the video |
| Player error | `GET /api/videos/:id` is READY; open the `master.m3u8` URL while logged in for private videos |
| Large upload 413 | Nginx `client_max_body_size 5G` and `VIDEO_MAX_SIZE` |
| Worker restarts mid-job | BullMQ stalls and retries; temp dirs are unique per attempt |
| `Bind for 0.0.0.0:9000 failed` | Host port 9000 is taken. Compose publishes MinIO on **9010/9011**; override with `MINIO_HOST_PORT` |
| `TLS handshake timeout` pulling `node:20-*` | Docker Hub flake. Do not rebuild; `docker compose up -d` uses images already built |

## Known limitations and next steps

- No CDN in front of the streaming proxy yet (`MINIO_PUBLIC_URL` is the hook).
- Quality names follow the ladder; very small sources emit a single non-upscaled rendition.
- No captions, playlists, comments, or transcoding presets per tenant.
- Auth is email/password + HTTP-only JWT; ready to swap for OIDC.
- Add object-lifecycle policies, virus scanning, and multi-region storage for production hardening.
