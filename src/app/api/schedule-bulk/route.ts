import { NextResponse } from "next/server";

import { schedulePinterestPost } from "@/lib/schedule-post";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const boardServiceId =
      typeof body.boardServiceId === "string" && body.boardServiceId.trim()
        ? body.boardServiceId.trim()
        : undefined;
    const items = Array.isArray(body.items)
      ? body.items.filter(
          (
            item: unknown
          ): item is {
            videoUrl?: unknown;
            caption?: unknown;
            scheduledAt?: unknown;
            pinTitle?: unknown;
          } => typeof item === "object" && item !== null
        )
      : [];

    if (!boardServiceId || items.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          total: 0,
          successCount: 0,
          failureCount: 0,
          results: [],
          message: "boardServiceId and items are required.",
        },
        { status: 400 }
      );
    }

    const results = [];

    for (const [index, item] of items.entries()) {
      const videoUrl = typeof item.videoUrl === "string" ? item.videoUrl.trim() : "";
      const caption = typeof item.caption === "string" ? item.caption.trim() : "";
      const scheduledAt = typeof item.scheduledAt === "string" ? item.scheduledAt.trim() : "";
      const pinTitle =
        typeof item.pinTitle === "string" && item.pinTitle.trim() ? item.pinTitle.trim() : undefined;

      if (!videoUrl || !caption || !scheduledAt) {
        results.push({
          index,
          videoUrl,
          ok: false,
          message: "videoUrl, caption, and scheduledAt are required for each item.",
          scheduledPost: null,
          r2Url: null,
          thumbnailUrl: null,
          bufferError: null,
        });
        continue;
      }

      const dueAt = new Date(scheduledAt);

      if (Number.isNaN(dueAt.getTime())) {
        results.push({
          index,
          videoUrl,
          ok: false,
          message: "scheduledAt must be a valid date for each item.",
          scheduledPost: null,
          r2Url: null,
          thumbnailUrl: null,
          bufferError: null,
        });
        continue;
      }

      const result = await schedulePinterestPost({
        sourceVideoUrl: videoUrl,
        caption,
        dueAt: dueAt.toISOString(),
        boardServiceId,
        pinTitle,
      });

      results.push({
        index,
        videoUrl,
        ok: result.ok,
        message: result.message,
        scheduledPost: result.scheduledPost,
        r2Url: result.r2Url,
        thumbnailUrl: result.thumbnailUrl,
        bufferError: result.bufferError,
        scheduledAt: result.dueAt,
      });
    }

    const successCount = results.filter((result) => result.ok).length;
    const failureCount = results.length - successCount;

    return NextResponse.json(
      {
        ok: true,
        total: results.length,
        successCount,
        failureCount,
        results,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in schedule-bulk route:", error);

    return NextResponse.json(
      {
        ok: false,
        total: 0,
        successCount: 0,
        failureCount: 0,
        results: [],
        message: "Unable to process bulk schedule request.",
      },
      { status: 500 }
    );
  }
}
