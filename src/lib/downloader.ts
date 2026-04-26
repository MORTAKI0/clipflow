type DownloaderDownloadResponse = {
  ok?: boolean;
  video_url?: string;
  video_key?: string;
  thumbnail_url?: string;
  thumbnail_key?: string;
  error_code?: string;
  message?: string;
  detail?: string | DownloaderErrorDetail;
  diagnostics?: Record<string, boolean | string>;
};

type DownloaderErrorDetail = {
  ok?: boolean;
  error_code?: string;
  message?: string;
  detail?: string;
};

type DownloaderDownloadSuccess = {
  videoUrl: string;
  videoKey: string;
  thumbnailUrl: string;
  thumbnailKey: string;
};

type DownloaderCleanupResult = {
  ok: boolean;
  message?: string;
};

export async function downloadMedia(sourceUrl: string): Promise<DownloaderDownloadSuccess> {
  const downloaderServiceUrl =
    process.env.DOWNLOADER_SERVICE_URL || process.env.RAILWAY_SERVICE_URL;

  if (!downloaderServiceUrl) {
    throw new DownloaderRequestError("DOWNLOADER_SERVICE_URL is not configured.", 500);
  }

  const response = await fetch(`${downloaderServiceUrl}/download`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url: sourceUrl }),
  });

  const data = (await response.json().catch(() => null)) as DownloaderDownloadResponse | null;

  if (!response.ok) {
    const errorPayload = parseDownloaderError(data);

    console.error("Downloader service failed:", {
      status: response.status,
      errorCode: errorPayload.errorCode,
      detail: errorPayload.detail,
    });

    throw new DownloaderRequestError(
      errorPayload.message,
      response.status,
      errorPayload.errorCode,
      errorPayload.detail
    );
  }

  if (
    !data ||
    typeof data.video_url !== "string" ||
    typeof data.video_key !== "string" ||
    typeof data.thumbnail_url !== "string" ||
    typeof data.thumbnail_key !== "string"
  ) {
    throw new DownloaderRequestError("Downloader service returned an invalid asset payload.", 502);
  }

  return {
    videoUrl: data.video_url,
    videoKey: data.video_key,
    thumbnailUrl: data.thumbnail_url,
    thumbnailKey: data.thumbnail_key,
  };
}

export async function cleanupDownloaderAssets(keys: string[]): Promise<DownloaderCleanupResult> {
  const downloaderServiceUrl =
    process.env.DOWNLOADER_SERVICE_URL || process.env.RAILWAY_SERVICE_URL;
  const filteredKeys = keys.filter(Boolean);

  if (!downloaderServiceUrl || filteredKeys.length === 0) {
    return { ok: false, message: "Cleanup skipped." };
  }

  try {
    const response = await fetch(`${downloaderServiceUrl}/cleanup`, {
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
    console.error("Downloader cleanup request failed:", error);
    return { ok: false, message: "Cleanup request failed." };
  }
}
export class DownloaderRequestError extends Error {
  status: number;
  errorCode: string;
  detail: string | null;

  constructor(message: string, status: number, errorCode = "downloader_failed", detail: string | null = null) {
    super(message);
    this.name = "DownloaderRequestError";
    this.status = status;
    this.errorCode = errorCode;
    this.detail = detail;
  }
}

function parseDownloaderError(data: DownloaderDownloadResponse | null): {
  errorCode: string;
  message: string;
  detail: string | null;
} {
  if (!data) {
    return {
      errorCode: "downloader_failed",
      message: "Downloader service failed.",
      detail: null,
    };
  }

  if (typeof data.message === "string" && data.message.trim()) {
    const errorCode = typeof data.error_code === "string" ? data.error_code : "downloader_failed";

    return {
      errorCode,
      message: getSafeDownloaderMessage(errorCode, data.message),
      detail: typeof data.detail === "string" ? data.detail : null,
    };
  }

  if (typeof data.detail === "object" && data.detail !== null) {
    return {
      errorCode:
        typeof data.detail.error_code === "string" ? data.detail.error_code : "downloader_failed",
      message:
        typeof data.detail.message === "string" && data.detail.message.trim()
          ? data.detail.message
          : "Downloader service failed.",
      detail: typeof data.detail.detail === "string" ? data.detail.detail : null,
    };
  }

  if (typeof data.detail === "string" && data.detail.trim()) {
    return mapLegacyDownloaderDetail(data.detail);
  }

  return {
    errorCode: "downloader_failed",
    message: "Downloader service failed.",
    detail: null,
  };
}

function mapLegacyDownloaderDetail(detail: string): {
  errorCode: string;
  message: string;
  detail: string;
} {
  const normalizedDetail = detail.toLowerCase();
  const isTikTokDetail = normalizedDetail.includes("[tiktok]") || normalizedDetail.includes("tiktok");

  if (
    isTikTokDetail &&
    normalizedDetail.includes("attempting impersonation") &&
    normalizedDetail.includes("no impersonate target is available")
  ) {
    return {
      errorCode: "tiktok_impersonation_required",
      message:
        "TikTok blocked this request because browser impersonation support is not available in the downloader runtime.",
      detail,
    };
  }

  if (
    isTikTokDetail &&
    (normalizedDetail.includes("http error 429") ||
      normalizedDetail.includes("too many requests") ||
      normalizedDetail.includes("rate limit") ||
      normalizedDetail.includes("rate limited"))
  ) {
    return {
      errorCode: "tiktok_rate_limited",
      message: "TikTok rate limited this download request.",
      detail,
    };
  }

  if (
    isTikTokDetail &&
    (normalizedDetail.includes("http error 403") ||
      normalizedDetail.includes("403: forbidden") ||
      normalizedDetail.includes("403 forbidden"))
  ) {
    return {
      errorCode: "tiktok_forbidden",
      message: "TikTok blocked this download request.",
      detail,
    };
  }

  if (
    normalizedDetail.includes("isn't available to everyone") ||
    normalizedDetail.includes("isn\u2019t available to everyone") ||
    normalizedDetail.includes("not available to everyone") ||
    normalizedDetail.includes("can't be seen by certain audiences") ||
    normalizedDetail.includes("certain audiences")
  ) {
    return {
      errorCode: "instagram_restricted_audience",
      message: "This Instagram reel is not visible to the current logged-in session.",
      detail,
    };
  }

  if (
    normalizedDetail.includes("rate-limit reached") ||
    normalizedDetail.includes("rate limit") ||
    normalizedDetail.includes("rate limited") ||
    normalizedDetail.includes("too many requests") ||
    normalizedDetail.includes("http error 429")
  ) {
    return {
      errorCode: "instagram_rate_limited",
      message: "Instagram blocked this request due to rate limiting.",
      detail,
    };
  }

  if (
    normalizedDetail.includes("cookies are no longer valid") ||
    normalizedDetail.includes("cookies are invalid") ||
    normalizedDetail.includes("invalid cookies") ||
    normalizedDetail.includes("expired cookies")
  ) {
    return {
      errorCode: "instagram_cookies_invalid",
      message: "Instagram cookies are invalid or expired.",
      detail,
    };
  }

  if (
    normalizedDetail.includes("login required") ||
    normalizedDetail.includes("you need to log in") ||
    normalizedDetail.includes("please log in") ||
    normalizedDetail.includes("use --cookies-from-browser or --cookies")
  ) {
    return {
      errorCode: "instagram_login_required",
      message: "Instagram requires a valid logged-in session for this reel.",
      detail,
    };
  }

  if (
    normalizedDetail.includes("requested content is not available") ||
    normalizedDetail.includes("this content is not available") ||
    normalizedDetail.includes("content is unavailable") ||
    normalizedDetail.includes("media is unavailable") ||
    normalizedDetail.includes("private")
  ) {
    return {
      errorCode: "instagram_unavailable",
      message: "The reel may be private, audience-limited, or unavailable.",
      detail,
    };
  }

  if (normalizedDetail.includes("yt-dlp error")) {
    return {
      errorCode: "download_failed",
      message: "Downloader could not fetch this video.",
      detail,
    };
  }

  return {
    errorCode: "downloader_failed",
    message: detail,
    detail,
  };
}

function getSafeDownloaderMessage(errorCode: string, fallbackMessage: string): string {
  switch (errorCode) {
    case "tiktok_impersonation_required":
      return "TikTok blocked this request because browser impersonation support is not available in the downloader runtime.";
    case "tiktok_forbidden":
      return "TikTok blocked this download request.";
    case "tiktok_rate_limited":
      return "TikTok rate limited this download request.";
    case "tiktok_cookies_invalid":
      return "TikTok cookies are invalid, expired, or insufficient for this video.";
    default:
      return fallbackMessage;
  }
}
