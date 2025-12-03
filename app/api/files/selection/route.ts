// app/api/files/selection/route.ts
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { toggleFileSelection } from "@/lib/db/file-queries";
import { getFileSelections } from "@/lib/db/project-queries";
import { ChatSDKError } from "@/lib/errors";
import { getChatById } from "@/lib/db/queries";

export async function GET(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new ChatSDKError("unauthorized:api").toResponse();
    }

    const { searchParams } = new URL(request.url);
    const chatId = searchParams.get("chatId");

    if (!chatId) {
      return NextResponse.json(
        { error: "chatId is required" },
        { status: 400 }
      );
    }

    const selections = await getFileSelections({ chatId });
    return NextResponse.json(selections, { status: 200 });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return NextResponse.json(
      { error: "Failed to fetch file selections" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new ChatSDKError("unauthorized:api").toResponse();
    }

    const { chatId, fileId } = await request.json();

    if (!chatId || !fileId) {
      return NextResponse.json(
        { error: "chatId and fileId are required" },
        { status: 400 }
      );
    }

    const chat = await getChatById({id: chatId})

    if (!chat) {
      return NextResponse.json(
        { error: "Chat not found" },
        { status: 404 }
      );
    }

    const selection = await toggleFileSelection({ chatId, fileId });
    return NextResponse.json(selection, { status: 200 });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return NextResponse.json(
      { error: "Failed to toggle file selection" },
      { status: 500 }
    );
  }
}