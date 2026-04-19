import { NextResponse } from "next/server";

import { getScheduledPostsCount } from "@/lib/buffer";

export async function GET() {
  try {
    const result = await getScheduledPostsCount();

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          count: null,
          limit: null,
          message: result.message,
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        count: result.count,
        limit: result.limit,
        message: null,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error loading scheduled post count:", error);

    return NextResponse.json(
      {
        ok: false,
        count: null,
        limit: null,
        message: "Failed to load scheduled post count.",
      },
      { status: 500 }
    );
  }
}
