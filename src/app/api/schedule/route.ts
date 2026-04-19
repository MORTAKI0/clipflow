import { NextResponse } from "next/server";

import { createBufferPost } from "@/lib/buffer";
import { cleanupRailwayAssets, downloadMediaFromRailway, RailwayRequestError } from "@/lib/railway";

export async function POST(request: Request) {
  let uploadedKeys: string[] = [];

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

    if (!videoUrl || !caption || !scheduledAt) {
      return NextResponse.json(
        {
          ok: false,
          message: "Missing required fields: videoUrl, caption, and scheduledAt are required.",
          r2Url: null,
          thumbnailUrl: null,
          scheduledPost: null,
          bufferError: null,
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
        },
        { status: 400 }
      );
    }

    const railwayAssets = await downloadMediaFromRailway(videoUrl);
    uploadedKeys = [railwayAssets.videoKey, railwayAssets.thumbnailKey];

    const bufferResult = await createBufferPost({
      text: caption,
      dueAt: dueAt.toISOString(),
      videoUrl: railwayAssets.videoUrl,
      thumbnailUrl: railwayAssets.thumbnailUrl,
      boardServiceId,
      pinTitle,
    });

    if (!bufferResult.ok) {
      const cleanupResult = await cleanupRailwayAssets(uploadedKeys);
      const cleanupNote = cleanupResult.ok ? "" : " Cleanup of uploaded R2 assets failed.";
      const status = bufferResult.kind === "config_error" ? 500 : 502;

      return NextResponse.json(
        {
          ok: false,
          message: `Video and thumbnail uploaded, but Buffer could not create the Pinterest post.${cleanupNote}`,
          r2Url: railwayAssets.videoUrl,
          thumbnailUrl: railwayAssets.thumbnailUrl,
          scheduledPost: null,
          bufferError: bufferResult.message,
        },
        { status }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        message: "Pinterest post created in Buffer.",
        r2Url: railwayAssets.videoUrl,
        thumbnailUrl: railwayAssets.thumbnailUrl,
        scheduledPost: bufferResult.post,
        bufferError: null,
      },
      { status: 200 }
    );
  } catch (error) {
    if (uploadedKeys.length > 0) {
      await cleanupRailwayAssets(uploadedKeys);
    }

    console.error("Error in schedule route:", error);

    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unable to process schedule request.",
        r2Url: null,
        thumbnailUrl: null,
        scheduledPost: null,
        bufferError: null,
      },
      { status: error instanceof RailwayRequestError ? error.status : 500 }
    );
  }
}
