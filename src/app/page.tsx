"use client";

import { useEffect, useState } from "react";

const LAST_BOARD_STORAGE_KEY = "clipflow:last-board-service-id";

type DraftPostRow = {
  id: string;
  videoUrl: string;
  caption: string;
  scheduledAt: string;
  pinTitle: string;
};

type RowErrors = {
  videoUrl?: string;
  caption?: string;
  scheduledAt?: string;
};

type ScheduledPost = {
  id: string;
  dueAt: string | null;
};

type PinterestBoard = {
  serviceId: string;
  name: string | null;
};

type PinterestBoardsResponse = {
  ok: boolean;
  boards: PinterestBoard[];
  message: string | null;
};

type BulkScheduleResult = {
  index: number;
  videoUrl: string;
  ok: boolean;
  message: string;
  scheduledPost: ScheduledPost | null;
  r2Url: string | null;
  thumbnailUrl: string | null;
  bufferError: string | null;
  scheduledAt?: string;
};

type BulkScheduleResponse = {
  ok: boolean;
  total: number;
  successCount: number;
  failureCount: number;
  results: BulkScheduleResult[];
  message?: string;
};

type ScheduledCountResponse = {
  ok: boolean;
  count: number | null;
  limit?: number | null;
  message: string | null;
};

function createEmptyRow(): DraftPostRow {
  return {
    id: crypto.randomUUID(),
    videoUrl: "",
    caption: "",
    scheduledAt: "",
    pinTitle: "",
  };
}

export default function ClipFlowPage() {
  const [rows, setRows] = useState<DraftPostRow[]>([createEmptyRow()]);
  const [rowErrors, setRowErrors] = useState<Record<string, RowErrors>>({});
  const [boardServiceId, setBoardServiceId] = useState("");
  const [boardError, setBoardError] = useState<string | null>(null);
  const [boards, setBoards] = useState<PinterestBoard[]>([]);
  const [boardsLoading, setBoardsLoading] = useState(true);
  const [boardsMessage, setBoardsMessage] = useState<string | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [countLimit, setCountLimit] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(true);
  const [countMessage, setCountMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<BulkScheduleResponse | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadBoards = async () => {
      setBoardsLoading(true);
      setBoardsMessage(null);

      try {
        const response = await fetch("/api/pinterest-boards");
        const data = (await response.json()) as PinterestBoardsResponse;

        if (!response.ok || !data.ok) {
          throw new Error(data.message || "Failed to load Pinterest boards.");
        }

        if (!isMounted) {
          return;
        }

        setBoards(data.boards);

        const savedBoardId = window.localStorage.getItem(LAST_BOARD_STORAGE_KEY);
        const hasSavedBoard = data.boards.some((board) => board.serviceId === savedBoardId);

        if (savedBoardId && hasSavedBoard) {
          setBoardServiceId(savedBoardId);
        } else {
          if (savedBoardId) {
            window.localStorage.removeItem(LAST_BOARD_STORAGE_KEY);
          }

          setBoardServiceId("");
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }

        const message = error instanceof Error ? error.message : "Failed to load Pinterest boards.";
        setBoards([]);
        setBoardServiceId("");
        setBoardsMessage(message);
      } finally {
        if (isMounted) {
          setBoardsLoading(false);
        }
      }
    };

    void loadBoards();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!boardServiceId) {
      window.localStorage.removeItem(LAST_BOARD_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(LAST_BOARD_STORAGE_KEY, boardServiceId);
  }, [boardServiceId]);

  useEffect(() => {
    let isMounted = true;

    const loadScheduledCount = async () => {
      setCountLoading(true);
      setCountMessage(null);

      try {
        const response = await fetch("/api/scheduled-count");
        const data = (await response.json()) as ScheduledCountResponse;

        if (!response.ok || !data.ok) {
          throw new Error(data.message || "Failed to load scheduled post count.");
        }

        if (!isMounted) {
          return;
        }

        setCount(data.count);
        setCountLimit(typeof data.limit === "number" ? data.limit : null);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        const message = error instanceof Error ? error.message : "Failed to load scheduled post count.";
        setCount(null);
        setCountLimit(null);
        setCountMessage(message);
      } finally {
        if (isMounted) {
          setCountLoading(false);
        }
      }
    };

    void loadScheduledCount();

    return () => {
      isMounted = false;
    };
  }, []);

  const updateRow = (rowId: string, field: keyof DraftPostRow, value: string) => {
    setRows((currentRows) =>
      currentRows.map((row) => (row.id === rowId ? { ...row, [field]: value } : row))
    );

    setRowErrors((currentErrors) => {
      if (!currentErrors[rowId]) {
        return currentErrors;
      }

      return {
        ...currentErrors,
        [rowId]: {
          ...currentErrors[rowId],
          [field]: undefined,
        },
      };
    });
  };

  const addRow = () => {
    setRows((currentRows) => [...currentRows, createEmptyRow()]);
  };

  const removeRow = (rowId: string) => {
    setRows((currentRows) => {
      if (currentRows.length === 1) {
        return [createEmptyRow()];
      }

      return currentRows.filter((row) => row.id !== rowId);
    });

    setRowErrors((currentErrors) => {
      const nextErrors = { ...currentErrors };
      delete nextErrors[rowId];
      return nextErrors;
    });
  };

  const validateRows = () => {
    const nextErrors: Record<string, RowErrors> = {};

    rows.forEach((row) => {
      const errors: RowErrors = {};

      if (!row.videoUrl.trim()) {
        errors.videoUrl = "Video URL is required.";
      }

      if (!row.caption.trim()) {
        errors.caption = "Caption is required.";
      }

      if (!row.scheduledAt.trim()) {
        errors.scheduledAt = "Schedule date & time is required.";
      }

      if (Object.keys(errors).length > 0) {
        nextErrors[row.id] = errors;
      }
    });

    setRowErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setResult(null);

    if (!boardServiceId) {
      setBoardError("Select a Pinterest board.");
      return;
    }

    setBoardError(null);

    if (!validateRows()) {
      return;
    }

    const items = rows
      .map((row) => ({
        videoUrl: row.videoUrl.trim(),
        caption: row.caption.trim(),
        scheduledAt: row.scheduledAt.trim(),
        pinTitle: row.pinTitle.trim(),
      }))
      .filter((row) => row.videoUrl || row.caption || row.scheduledAt);

    setIsLoading(true);

    try {
      const response = await fetch("/api/schedule-bulk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          boardServiceId,
          items,
        }),
      });

      const data = (await response.json()) as BulkScheduleResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.message || "Failed to schedule posts.");
      }

      setResult(data);
      setRows([createEmptyRow()]);

      const countResponse = await fetch("/api/scheduled-count");
      const countData = (await countResponse.json()) as ScheduledCountResponse;

      if (countResponse.ok && countData.ok) {
        setCount(countData.count);
        setCountLimit(typeof countData.limit === "number" ? countData.limit : null);
        setCountMessage(null);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "An unexpected error occurred.";

      setResult({
        ok: false,
        total: 0,
        successCount: 0,
        failureCount: 0,
        results: [],
        message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-stone-100 px-4 py-10 text-stone-900">
      <div className="mx-auto w-full max-w-4xl rounded-[28px] border border-stone-200 bg-white p-6 shadow-[0_24px_80px_rgba(41,37,36,0.08)] sm:p-8">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-rose-500">ClipFlow</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-900">
            Send short-form video to Pinterest
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
            Build a batch row by row, keep one shared board, and schedule every post with its own caption and time.
          </p>
        </div>

        <section className="mb-6 rounded-2xl border border-stone-200 bg-stone-50 p-4">
          <p className="text-sm font-medium text-stone-900">
            {countLoading
              ? "Loading scheduled Buffer posts..."
              : countMessage
                ? "Scheduled in Buffer: unavailable"
                : countLimit !== null
                  ? `Scheduled in Buffer: ${count ?? 0} of ${countLimit} posts`
                  : `Scheduled in Buffer: ${count ?? 0} posts`}
          </p>
          {countMessage && <p className="mt-1 text-sm text-stone-600">{countMessage}</p>}
        </section>

        {boardsMessage && (
          <section className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-800">{boardsMessage}</p>
          </section>
        )}

        {result && (
          <section className="mb-6 rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-semibold text-stone-900">
              {result.successCount} succeeded, {result.failureCount} failed, {result.total} processed.
            </p>
            {result.message && <p className="mt-1 text-sm text-stone-600">{result.message}</p>}

            {result.results.length > 0 && (
              <div className="mt-4 space-y-3">
                {result.results.map((item) => (
                  <article
                    key={`${item.index}-${item.videoUrl}`}
                    className={`rounded-2xl border p-4 ${
                      item.ok ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"
                    }`}
                  >
                    <p className="text-sm font-semibold text-stone-900">
                      Row {item.index + 1}: {item.ok ? "Scheduled" : "Failed"}
                    </p>
                    <p className="mt-1 break-all text-sm text-stone-700">{item.videoUrl || "No URL provided"}</p>
                    {item.scheduledAt && (
                      <p className="mt-1 text-xs text-stone-600">
                        Scheduled for {new Date(item.scheduledAt).toLocaleString()}
                      </p>
                    )}
                    <p className="mt-2 text-sm text-stone-700">{item.message}</p>
                    {item.scheduledPost?.id && (
                      <p className="mt-2 text-sm text-stone-700">
                        Buffer post ID: <span className="font-mono">{item.scheduledPost.id}</span>
                      </p>
                    )}
                    {item.r2Url && (
                      <p className="mt-2 break-all text-xs text-stone-600">
                        Video URL: <span className="font-mono">{item.r2Url}</span>
                      </p>
                    )}
                    {item.thumbnailUrl && (
                      <p className="mt-1 break-all text-xs text-stone-600">
                        Thumbnail URL: <span className="font-mono">{item.thumbnailUrl}</span>
                      </p>
                    )}
                    {item.bufferError && (
                      <p className="mt-2 text-sm text-stone-700">
                        Buffer error: <span className="font-medium">{item.bufferError}</span>
                      </p>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <section className="rounded-2xl border border-stone-200 p-4">
            <label htmlFor="boardServiceId" className="mb-1.5 block text-sm font-medium text-stone-700">
              Pinterest Board
            </label>
            <select
              id="boardServiceId"
              required
              value={boardServiceId}
              onChange={(event) => {
                setBoardServiceId(event.target.value);
                setBoardError(null);
              }}
              disabled={boardsLoading || boards.length === 0}
              className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-rose-400 disabled:cursor-not-allowed disabled:bg-stone-100"
            >
              <option value="">{boardsLoading ? "Loading Pinterest boards..." : "Select a Pinterest board"}</option>
              {boards.map((board) => (
                <option key={board.serviceId} value={board.serviceId}>
                  {board.name ?? board.serviceId}
                </option>
              ))}
            </select>
            {boardError && <p className="mt-1 text-sm text-red-700">{boardError}</p>}
          </section>

          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-stone-500">Posts</h2>
            <button
              type="button"
              onClick={addRow}
              className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-100"
            >
              Add post
            </button>
          </div>

          <div className="space-y-4">
            {rows.map((row, index) => (
              <section key={row.id} className="rounded-2xl border border-stone-200 p-4">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm font-semibold text-stone-900">Post {index + 1}</p>
                  <button
                    type="button"
                    onClick={() => removeRow(row.id)}
                    className="text-sm font-medium text-stone-600 transition hover:text-stone-900"
                  >
                    Remove row
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label htmlFor={`videoUrl-${row.id}`} className="mb-1.5 block text-sm font-medium text-stone-700">
                      Video URL
                    </label>
                    <input
                      id={`videoUrl-${row.id}`}
                      type="url"
                      value={row.videoUrl}
                      onChange={(event) => updateRow(row.id, "videoUrl", event.target.value)}
                      placeholder="https://www.tiktok.com/@user/video/123"
                      className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-rose-400"
                    />
                    {rowErrors[row.id]?.videoUrl && (
                      <p className="mt-1 text-sm text-red-700">{rowErrors[row.id].videoUrl}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor={`caption-${row.id}`} className="mb-1.5 block text-sm font-medium text-stone-700">
                      Caption
                    </label>
                    <textarea
                      id={`caption-${row.id}`}
                      rows={4}
                      value={row.caption}
                      onChange={(event) => updateRow(row.id, "caption", event.target.value)}
                      placeholder="Write the Pinterest caption..."
                      className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-rose-400"
                    />
                    {rowErrors[row.id]?.caption && (
                      <p className="mt-1 text-sm text-red-700">{rowErrors[row.id].caption}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor={`scheduledAt-${row.id}`} className="mb-1.5 block text-sm font-medium text-stone-700">
                      Schedule Date &amp; Time
                    </label>
                    <input
                      id={`scheduledAt-${row.id}`}
                      type="datetime-local"
                      value={row.scheduledAt}
                      onChange={(event) => updateRow(row.id, "scheduledAt", event.target.value)}
                      className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-rose-400"
                    />
                    {rowErrors[row.id]?.scheduledAt && (
                      <p className="mt-1 text-sm text-red-700">{rowErrors[row.id].scheduledAt}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor={`pinTitle-${row.id}`} className="mb-1.5 block text-sm font-medium text-stone-700">
                      Pin Title
                    </label>
                    <input
                      id={`pinTitle-${row.id}`}
                      type="text"
                      value={row.pinTitle}
                      onChange={(event) => updateRow(row.id, "pinTitle", event.target.value)}
                      placeholder="Optional Pinterest title"
                      className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-rose-400"
                    />
                  </div>
                </div>
              </section>
            ))}
          </div>

          <button
            type="submit"
            disabled={isLoading || boardsLoading || boards.length === 0 || !boardServiceId}
            className="w-full rounded-2xl bg-stone-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isLoading ? "Scheduling posts..." : "Schedule all to Pinterest"}
          </button>
        </form>
      </div>
    </main>
  );
}
