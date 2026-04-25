ClipFlow schedules TikTok and Instagram videos to Pinterest through Buffer. For local development, the Next.js app calls a local FastAPI downloader running on this Windows machine.

## Local Setup

### Next.js `.env.local`

```env
DOWNLOADER_SERVICE_URL=http://127.0.0.1:8000
BUFFER_API_KEY=your_key
BUFFER_PINTEREST_CHANNEL_ID=your_channel_id
```

`RAILWAY_SERVICE_URL` is still accepted as a fallback, but `DOWNLOADER_SERVICE_URL` is preferred.

### Downloader `.env`

Create this in `C:\Users\abmor\Desktop\clipflow-downloader\.env`:

```env
DOWNLOADS_DIR=C:\Users\abmor\Desktop\CONTENT\vids raw
INSTAGRAM_COOKIES_FILE=C:\Users\abmor\Desktop\CONTENT\cookies\cookies-ig.txt
TIKTOK_COOKIES_FILE=C:\Users\abmor\Desktop\CONTENT\cookies\www.tiktok.com_cookies.txt
R2_ACCOUNT_ID=your_account_id
R2_BUCKET=your_bucket
R2_PUBLIC_URL=https://your-public-r2-url.r2.dev
R2_ACCESS_KEY=your_access_key
R2_SECRET_KEY=your_secret_key
```

The downloader also supports `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_BUCKET_NAME`.

## Run Locally

Start the downloader:

```powershell
cd C:\Users\abmor\Desktop\clipflow-downloader
python -m pip install -r requirements.txt
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

Start the Next.js app:

```powershell
cd C:\Users\abmor\Desktop\clipflow
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).
