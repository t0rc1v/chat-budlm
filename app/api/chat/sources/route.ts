// app/api/chat/sources/route.ts
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { updateChatSources } from "@/lib/db/project-queries";
import { getChatById } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

export async function PATCH(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  try {
    const body = await request.json();
    const { chatId, sources } = body;

    if (!chatId || !Array.isArray(sources)) {
      return NextResponse.json(
        { error: "Chat ID and sources array are required" },
        { status: 400 }
      );
    }

    // Verify chat ownership
    const chat = await getChatById({ id: chatId });

    if (!chat) {
      return new ChatSDKError("not_found:chat").toResponse();
    }

    if (chat.userId !== userId) {
      return new ChatSDKError("forbidden:chat").toResponse();
    }

    const updatedChat = await updateChatSources({ chatId, sources });
    return NextResponse.json(updatedChat);
  } catch (error) {
    console.error("Error updating chat sources:", error);
    return new ChatSDKError("bad_request:database").toResponse();
  }
}