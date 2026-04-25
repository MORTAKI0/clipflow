import { type BufferPost, createBufferPost } from "@/lib/buffer";
import { cleanupDownloaderAssets, downloadMedia, DownloaderRequestError } from "@/lib/downloader";

export type SchedulePinterestPostInput = {
  sourceVideoUrl: string;
  caption: string;
  dueAt: string;
  boardServiceId?: string;
  pinTitle?: string;
  destinationUrl?: string;
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
  errorCode?: string;
};

export async function schedulePinterestPost({
  sourceVideoUrl,
  caption,
  dueAt,
  boardServiceId,
  pinTitle,
  destinationUrl,
}: SchedulePinterestPostInput): Promise<SchedulePinterestPostResult> {
  let uploadedKeys: string[] = [];

  try {
    const downloaderAssets = await downloadMedia(sourceVideoUrl);
    uploadedKeys = [downloaderAssets.videoKey, downloaderAssets.thumbnailKey];

    const bufferResult = await createBufferPost({
      text: caption,
      dueAt,
      videoUrl: downloaderAssets.videoUrl,
      thumbnailUrl: downloaderAssets.thumbnailUrl,
      boardServiceId,
      pinTitle,
      destinationUrl,
    });

    if (!bufferResult.ok) {
      const cleanupResult = await cleanupDownloaderAssets(uploadedKeys);
      const cleanupNote = cleanupResult.ok ? "" : " Cleanup of uploaded R2 assets failed.";

      return {
        ok: false,
        statusCode: bufferResult.kind === "config_error" ? 500 : 502,
        message: `Video and thumbnail uploaded, but Buffer could not create the Pinterest post.${cleanupNote}`,
        sourceVideoUrl,
        dueAt,
        r2Url: downloaderAssets.videoUrl,
        thumbnailUrl: downloaderAssets.thumbnailUrl,
        scheduledPost: null,
        bufferError: bufferResult.message,
        errorCode: "buffer_create_failed",
      };
    }

    return {
      ok: true,
      statusCode: 200,
      message: "Pinterest post created in Buffer.",
      sourceVideoUrl,
      dueAt,
      r2Url: downloaderAssets.videoUrl,
      thumbnailUrl: downloaderAssets.thumbnailUrl,
      scheduledPost: bufferResult.post,
      bufferError: null,
    };
  } catch (error) {
    if (uploadedKeys.length > 0) {
      await cleanupDownloaderAssets(uploadedKeys);
    }

    return {
      ok: false,
      statusCode: error instanceof DownloaderRequestError ? error.status : 500,
      message: error instanceof Error ? error.message : "Unable to process schedule request.",
      sourceVideoUrl,
      dueAt,
      r2Url: null,
      thumbnailUrl: null,
      scheduledPost: null,
      bufferError: null,
      errorCode: error instanceof DownloaderRequestError ? error.errorCode : "schedule_failed",
    };
  }
}
