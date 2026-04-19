type RailwayDownloadResponse = {
  video_url?: string;
  video_key?: string;
  thumbnail_url?: string;
  thumbnail_key?: string;
  detail?: string;
};

type RailwayDownloadSuccess = {
  videoUrl: string;
  videoKey: string;
  thumbnailUrl: string;
  thumbnailKey: string;
};

type RailwayCleanupResult = {
  ok: boolean;
  message?: string;
};

export async function downloadMediaFromRailway(sourceUrl: string): Promise<RailwayDownloadSuccess> {
  const railwayServiceUrl = process.env.RAILWAY_SERVICE_URL;

  if (!railwayServiceUrl) {
    throw new RailwayRequestError("RAILWAY_SERVICE_URL is not configured.", 500);
  }

  const response = await fetch(`${railwayServiceUrl}/download`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url: sourceUrl }),
  });

  const data = (await response.json().catch(() => null)) as RailwayDownloadResponse | null;

  if (!response.ok) {
    const message =
      data && typeof data.detail === "string" ? data.detail : "Downloader service failed.";

    throw new RailwayRequestError(message, 502);
  }

  if (
    !data ||
    typeof data.video_url !== "string" ||
    typeof data.video_key !== "string" ||
    typeof data.thumbnail_url !== "string" ||
    typeof data.thumbnail_key !== "string"
  ) {
    throw new RailwayRequestError("Downloader service returned an invalid asset payload.", 502);
  }

  return {
    videoUrl: data.video_url,
    videoKey: data.video_key,
    thumbnailUrl: data.thumbnail_url,
    thumbnailKey: data.thumbnail_key,
  };
}

export async function cleanupRailwayAssets(keys: string[]): Promise<RailwayCleanupResult> {
  const railwayServiceUrl = process.env.RAILWAY_SERVICE_URL;
  const filteredKeys = keys.filter(Boolean);

  if (!railwayServiceUrl || filteredKeys.length === 0) {
    return { ok: false, message: "Cleanup skipped." };
  }

  try {
    const response = await fetch(`${railwayServiceUrl}/cleanup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ keys: filteredKeys }),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { detail?: string } | null;
      return {
        ok: false,
        message: data && typeof data.detail === "string" ? data.detail : "Cleanup request failed.",
      };
    }

    return { ok: true };
  } catch (error) {
    console.error("Railway cleanup request failed:", error);
    return { ok: false, message: "Cleanup request failed." };
  }
}
export class RailwayRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "RailwayRequestError";
    this.status = status;
  }
}
