// app/api/chat/project/route.ts
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { updateChatProject } from "@/lib/db/project-queries";
import { ChatSDKError } from "@/lib/errors";
import { getChatById } from "@/lib/db/queries";

export async function PATCH(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    const { chatId, projectId } = await request.json();

    if (!chatId) {
      return NextResponse.json(
        { error: "Chat ID is required" },
        { status: 400 }
      );
    }

    const chat = await getChatById({ id: chatId });

    if (!chat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    if (chat.userId !== userId) {
      return new ChatSDKError("forbidden:chat").toResponse();
    }

    await updateChatProject({ chatId, projectId: projectId || null });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error updating chat project:", error);
    return NextResponse.json(
      { error: "Failed to update chat project" },
      { status: 500 }
    );
  }
}