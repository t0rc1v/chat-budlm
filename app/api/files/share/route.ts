// app/api/files/share/route.ts
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createFileShare, getFileById } from "@/lib/db/file-share-queries";
import { ChatSDKError } from "@/lib/errors";

export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new ChatSDKError("unauthorized:api").toResponse();
    }

    const { fileId, email, permission } = await request.json();

    if (!fileId || !email) {
      return NextResponse.json(
        { error: "fileId and email are required" },
        { status: 400 }
      );
    }

    // Verify file ownership
    const file = await getFileById({ id: fileId });
    if (!file || file.userId !== userId) {
      return new ChatSDKError("forbidden:api").toResponse();
    }

    // Create share record
    const share = await createFileShare({
      fileId,
      sharedWithEmail: email,
      permission: permission || "view",
      sharedBy: userId,
    });

    // TODO: Send email notification to shared user

    return NextResponse.json({
      success: true,
      shareId: share.id,
      shareLink: `${process.env.NEXT_PUBLIC_APP_URL}/shared/file/${share.id}`,
    });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return NextResponse.json(
      { error: "Failed to share file" },
      { status: 500 }
    );
  }
}