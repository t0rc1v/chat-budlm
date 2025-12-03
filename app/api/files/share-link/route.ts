// app/api/files/share-link/route.ts
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

    const { fileId, permission } = await request.json();

    if (!fileId) {
      return NextResponse.json(
        { error: "fileId is required" },
        { status: 400 }
      );
    }

    // Verify file ownership
    const file = await getFileById({ id: fileId });
    if (!file || file.userId !== userId) {
      return new ChatSDKError("forbidden:api").toResponse();
    }

    // Generate share token
    const shareToken = generateShareToken();

    // Create public share link
    const share = await createFileShare({
      fileId,
      sharedWithEmail: null, // Public link
      permission: permission || "view",
      sharedBy: userId,
      shareToken,
    });

    return NextResponse.json({
      success: true,
      link: `${process.env.NEXT_PUBLIC_APP_URL}/shared/${shareToken}`,
    });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return NextResponse.json(
      { error: "Failed to generate share link" },
      { status: 500 }
    );
  }
}

function generateShareToken(): string {
  return Array.from({ length: 32 }, () =>
    Math.random().toString(36).charAt(2)
  ).join("");
}