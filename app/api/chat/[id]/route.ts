// app/api/chat/[chatId]/route.ts
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getChatById } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    const { chatId } = await params;
    const chat = await getChatById({ id: chatId });

    if (!chat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    if (chat.visibility === "private" && chat.userId !== userId) {
      return new ChatSDKError("forbidden:chat").toResponse();
    }

    return NextResponse.json(chat);
  } catch (error) {
    console.error("Error fetching chat:", error);
    return new ChatSDKError("bad_request:database").toResponse();
  }
}