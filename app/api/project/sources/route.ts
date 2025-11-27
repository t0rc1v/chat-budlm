// app/api/project/sources/route.ts
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getSourcesByProjectId } from "@/lib/db/project-queries";
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
    const sources = await getSourcesByProjectId({ projectId });
    return NextResponse.json(sources);
  } catch (error) {
    console.error("Error fetching project sources:", error);
    return new ChatSDKError("bad_request:database").toResponse();
  }
}