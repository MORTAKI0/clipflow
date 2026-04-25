import { NextResponse } from "next/server";

import { schedulePinterestPost } from "@/lib/schedule-post";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const videoUrl = typeof body.videoUrl === "string" ? body.videoUrl.trim() : "";
    const caption = typeof body.caption === "string" ? body.caption.trim() : "";
    const scheduledAt = typeof body.scheduledAt === "string" ? body.scheduledAt.trim() : "";
    const boardServiceId =
      typeof body.boardServiceId === "string" && body.boardServiceId.trim()
        ? body.boardServiceId.trim()
        : undefined;
    const pinTitle =
      typeof body.pinTitle === "string" && body.pinTitle.trim()
        ? body.pinTitle.trim()
        : undefined;
    const destinationUrl =
      typeof body.destinationUrl === "string" && body.destinationUrl.trim()
        ? body.destinationUrl.trim()
        : undefined;

    if (!videoUrl || !caption || !scheduledAt) {
      return NextResponse.json(
        {
          ok: false,
          message: "Missing required fields: videoUrl, caption, and scheduledAt are required.",
          r2Url: null,
          thumbnailUrl: null,
          scheduledPost: null,
          bufferError: null,
          errorCode: "validation_failed",
        },
        { status: 400 }
      );
    }

    const dueAt = new Date(scheduledAt);

    if (Number.isNaN(dueAt.getTime())) {
      return NextResponse.json(
        {
          ok: false,
          message: "scheduledAt must be a valid date.",
          r2Url: null,
          thumbnailUrl: null,
          scheduledPost: null,
          bufferError: null,
          errorCode: "validation_failed",
        },
        { status: 400 }
      );
    }

    const result = await schedulePinterestPost({
      sourceVideoUrl: videoUrl,
      caption,
      dueAt: dueAt.toISOString(),
      boardServiceId,
      pinTitle,
      destinationUrl,
    });

    return NextResponse.json(
      {
        ok: result.ok,
        message: result.message,
        r2Url: result.r2Url,
        thumbnailUrl: result.thumbnailUrl,
        scheduledPost: result.scheduledPost,
        bufferError: result.bufferError,
        errorCode: result.errorCode,
      },
      { status: result.statusCode }
    );
  } catch (error) {
    console.error("Error in schedule route:", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Unable to process schedule request.",
        r2Url: null,
        thumbnailUrl: null,
        scheduledPost: null,
        bufferError: null,
        errorCode: "schedule_failed",
      },
      { status: 500 }
    );
  }
}
