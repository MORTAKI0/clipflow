"use client";

import { useState } from "react";

type ScheduleResponse = {
  ok: boolean;
  message: string;
  r2Url: string | null;
  scheduledPost: {
    id: string;
    dueAt: string | null;
  } | null;
  bufferError: string | null;
};

export default function ClipFlowPage() {
  const [videoUrl, setVideoUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [boardServiceId, setBoardServiceId] = useState("");
  const [pinTitle, setPinTitle] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ScheduleResponse | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/schedule", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          videoUrl,
          caption,
          scheduledAt,
          boardServiceId,
          pinTitle,
        }),
      });

      const data = (await response.json()) as ScheduleResponse;
      setResult(data);

      if (response.ok && data.ok) {
        setVideoUrl("");
        setCaption("");
        setScheduledAt("");
        setBoardServiceId("");
        setPinTitle("");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "An unexpected error occurred.";

      setResult({
        ok: false,
        message,
        r2Url: null,
        scheduledPost: null,
        bufferError: null,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-stone-100 px-4 py-10 text-stone-900">
      <div className="mx-auto w-full max-w-2xl rounded-[28px] border border-stone-200 bg-white p-6 shadow-[0_24px_80px_rgba(41,37,36,0.08)] sm:p-8">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-rose-500">ClipFlow</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-900">
            Send short-form video to Pinterest
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-stone-600">
            Paste a TikTok or Instagram URL, pick a time, and send the downloaded video into Buffer with the
            Pinterest board details you need.
          </p>
        </div>

        {result && (
          <section
            className={`mb-6 rounded-2xl border p-4 ${
              result.ok
                ? "border-emerald-200 bg-emerald-50"
                : result.r2Url
                  ? "border-amber-200 bg-amber-50"
                  : "border-red-200 bg-red-50"
            }`}
          >
            <p className="text-sm font-semibold text-stone-900">{result.message}</p>

            {result.scheduledPost && (
              <p className="mt-2 text-sm text-stone-700">
                Buffer post created with ID <span className="font-mono">{result.scheduledPost.id}</span>
                {result.scheduledPost.dueAt ? ` for ${new Date(result.scheduledPost.dueAt).toLocaleString()}` : ""}.
              </p>
            )}

            {!result.ok && result.r2Url && (
              <p className="mt-2 text-sm text-stone-700">Download to R2 succeeded, but Buffer did not create the post.</p>
            )}

            {result.bufferError && (
              <p className="mt-2 text-sm text-stone-700">
                Buffer error: <span className="font-medium">{result.bufferError}</span>
              </p>
            )}

            {result.r2Url && (
              <p className="mt-2 break-all text-xs text-stone-600">
                R2 URL: <span className="font-mono">{result.r2Url}</span>
              </p>
            )}
          </section>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="videoUrl" className="mb-1.5 block text-sm font-medium text-stone-700">
              Video URL
            </label>
            <input
              id="videoUrl"
              type="url"
              required
              value={videoUrl}
              onChange={(event) => setVideoUrl(event.target.value)}
              placeholder="https://www.tiktok.com/@user/video/123"
              className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-rose-400"
            />
          </div>

          <div>
            <label htmlFor="caption" className="mb-1.5 block text-sm font-medium text-stone-700">
              Caption
            </label>
            <textarea
              id="caption"
              required
              rows={4}
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              placeholder="Write the Pinterest caption..."
              className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-rose-400"
            />
          </div>

          <div>
            <label htmlFor="scheduledAt" className="mb-1.5 block text-sm font-medium text-stone-700">
              Schedule Date &amp; Time
            </label>
            <input
              id="scheduledAt"
              type="datetime-local"
              required
              value={scheduledAt}
              onChange={(event) => setScheduledAt(event.target.value)}
              className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-rose-400"
            />
          </div>

          <div>
            <label htmlFor="boardServiceId" className="mb-1.5 block text-sm font-medium text-stone-700">
              Pinterest Board ID
            </label>
            <input
              id="boardServiceId"
              type="text"
              value={boardServiceId}
              onChange={(event) => setBoardServiceId(event.target.value)}
              placeholder="Optional now, required by Buffer for Pinterest"
              className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-rose-400"
            />
          </div>

          <div>
            <label htmlFor="pinTitle" className="mb-1.5 block text-sm font-medium text-stone-700">
              Pin Title
            </label>
            <input
              id="pinTitle"
              type="text"
              value={pinTitle}
              onChange={(event) => setPinTitle(event.target.value)}
              placeholder="Optional Pinterest title"
              className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-rose-400"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-2xl bg-stone-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isLoading ? "Scheduling..." : "Schedule to Pinterest"}
          </button>
        </form>
      </div>
    </main>
  );
}
