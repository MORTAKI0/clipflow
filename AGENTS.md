

## Project
ClipFlow takes a TikTok or Instagram URL, downloads the video, uploads it to Cloudflare R2, and schedules it to Pinterest via Buffer.

## Flow
URL → Railway (yt-dlp + R2 upload) → Next.js → Buffer GraphQL → Pinterest scheduled post

## Stack
- Next.js App Router + Route Handlers
- FastAPI on Railway with yt-dlp
- Cloudflare R2 (public video storage)
- Buffer GraphQL API (not deprecated REST)

## File placement
- Integrations → `src/lib/` (buffer.ts, railway.ts)
- API orchestration → `src/app/api/schedule/route.ts`
- Types → `src/types/index.ts`

## MVP scope (do not expand)
- Single user, Pinterest only, manual scheduling
- No auth, no dashboard, no history, no multi-platform

## Rules
- Use Buffer GraphQL API, never the deprecated REST endpoints
- Secrets in server env vars only, never in client code
- Delete temp files after R2 upload
- Verify R2 URL is publicly accessible before sending to Buffer
- Do not add scope until the core flow works end-to-end