import { NextResponse } from "next/server";

import { getPinterestBoards } from "@/lib/buffer";

export async function GET() {
  try {
    const result = await getPinterestBoards();

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          boards: [],
          message: result.message,
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        boards: result.boards,
        message: null,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error loading Pinterest boards:", error);

    return NextResponse.json(
      {
        ok: false,
        boards: [],
        message: "Failed to load Pinterest boards.",
      },
      { status: 500 }
    );
  }
}
