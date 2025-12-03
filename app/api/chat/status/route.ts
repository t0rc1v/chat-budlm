// app/api/chat/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getChatById } from "@/lib/db/queries";
import { auth } from "@clerk/nextjs/server";
import { ChatSDKError } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    const {userId} = await auth();
    
    if (!userId) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    const searchParams = request.nextUrl.searchParams;
    const chatId = searchParams.get("chatId");

    if (!chatId) {
      return NextResponse.json(
        { error: "chatId is required" },
        { status: 400 }
      );
    }

    // Try to get chat from database
    const chat = await getChatById({ id: chatId });

    // If chat exists in DB, it's not a new chat
    const isNewChat = !chat;

    return NextResponse.json({ 
      isNewChat,
      chatExists: !!chat 
    });
  } catch (error) {
    console.error("Error checking chat status:", error);
    return NextResponse.json(
      { error: "Failed to check chat status" },
      { status: 500 }
    );
  }
}