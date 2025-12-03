// app/api/files/chunks/route.ts
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getFileChunks } from "@/lib/services/chroma";
import { ChatSDKError } from "@/lib/errors";

export async function GET(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new ChatSDKError("unauthorized:api").toResponse();
    }

    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get("fileId");
    const projectId = searchParams.get("projectId");

    if (!fileId || !projectId) {
      return NextResponse.json(
        { error: "fileId and projectId are required" },
        { status: 400 }
      );
    }

    // Get chunks from ChromaDB
    const chunks = await getFileChunks({ fileId, projectId });

    return NextResponse.json({
      chunks: chunks.map((chunk, index) => ({
        text: chunk.document,
        index: chunk.metadata?.chunkIndex || index,
        metadata: chunk.metadata,
      })),
    });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return NextResponse.json(
      { error: "Failed to get file chunks" },
      { status: 500 }
    );
  }
}