import { type BufferPost, createBufferPost } from "@/lib/buffer";
import { cleanupRailwayAssets, downloadMediaFromRailway, RailwayRequestError } from "@/lib/railway";

export type SchedulePinterestPostInput = {
  sourceVideoUrl: string;
  caption: string;
  dueAt: string;
  boardServiceId?: string;
  pinTitle?: string;
};

export type SchedulePinterestPostResult = {
  ok: boolean;
  statusCode: number;
  message: string;
  sourceVideoUrl: string;
  dueAt: string;
  r2Url: string | null;
  thumbnailUrl: string | null;
  scheduledPost: BufferPost | null;
  bufferError: string | null;
};

export async function schedulePinterestPost({
  sourceVideoUrl,
  caption,
  dueAt,
  boardServiceId,
  pinTitle,
}: SchedulePinterestPostInput): Promise<SchedulePinterestPostResult> {
  let uploadedKeys: string[] = [];

  try {
    const railwayAssets = await downloadMediaFromRailway(sourceVideoUrl);
    uploadedKeys = [railwayAssets.videoKey, railwayAssets.thumbnailKey];

    const bufferResult = await createBufferPost({
      text: caption,
      dueAt,
      videoUrl: railwayAssets.videoUrl,
      thumbnailUrl: railwayAssets.thumbnailUrl,
      boardServiceId,
      pinTitle,
    });

    if (!bufferResult.ok) {
      const cleanupResult = await cleanupRailwayAssets(uploadedKeys);
      const cleanupNote = cleanupResult.ok ? "" : " Cleanup of uploaded R2 assets failed.";

      return {
        ok: false,
        statusCode: bufferResult.kind === "config_error" ? 500 : 502,
        message: `Video and thumbnail uploaded, but Buffer could not create the Pinterest post.${cleanupNote}`,
        sourceVideoUrl,
        dueAt,
        r2Url: railwayAssets.videoUrl,
        thumbnailUrl: railwayAssets.thumbnailUrl,
        scheduledPost: null,
        bufferError: bufferResult.message,
      };
    }

    return {
      ok: true,
      statusCode: 200,
      message: "Pinterest post created in Buffer.",
      sourceVideoUrl,
      dueAt,
      r2Url: railwayAssets.videoUrl,
      thumbnailUrl: railwayAssets.thumbnailUrl,
      scheduledPost: bufferResult.post,
      bufferError: null,
    };
  } catch (error) {
    if (uploadedKeys.length > 0) {
      await cleanupRailwayAssets(uploadedKeys);
    }

    return {
      ok: false,
      statusCode: error instanceof RailwayRequestError ? error.status : 500,
      message: error instanceof Error ? error.message : "Unable to process schedule request.",
      sourceVideoUrl,
      dueAt,
      r2Url: null,
      thumbnailUrl: null,
      scheduledPost: null,
      bufferError: null,
    };
  }
}
