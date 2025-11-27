// app/api/project/chats/route.ts
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getChatsByProjectId } from "@/lib/db/project-queries";
import { ChatSDKError } from "@/lib/errors";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json(
      { error: "Project ID is required" },
      { status: 400 }
    );
  }

  const { userId } = await auth();

  if (!userId) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  try {
    const chats = await getChatsByProjectId({ projectId });
    return NextResponse.json(chats);
  } catch (error) {
    console.error("Error fetching project chats:", error);
    return new ChatSDKError("bad_request:database").toResponse();
  }
}