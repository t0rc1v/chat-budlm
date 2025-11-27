// app/api/studio/route.ts
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  createStudioElement,
  deleteStudioElementById,
  getStudioElementsByProjectId,
} from "@/lib/db/project-queries";
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
    const elements = await getStudioElementsByProjectId({ projectId });
    return NextResponse.json(elements);
  } catch (error) {
    console.error("Error fetching studio elements:", error);
    return new ChatSDKError("bad_request:database").toResponse();
  }
}

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  try {
    const body = await request.json();
    const { projectId, type, title, content } = body;

    if (!projectId || !type || !title) {
      return NextResponse.json(
        { error: "Project ID, type, and title are required" },
        { status: 400 }
      );
    }

    const element = await createStudioElement({
      projectId,
      userId,
      type,
      title,
      content,
    });

    return NextResponse.json(element);
  } catch (error) {
    console.error("Error creating studio element:", error);
    return new ChatSDKError("bad_request:database").toResponse();
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { error: "Element ID is required" },
      { status: 400 }
    );
  }

  const { userId } = await auth();

  if (!userId) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  try {
    const deletedElement = await deleteStudioElementById({ id });
    return NextResponse.json(deletedElement);
  } catch (error) {
    console.error("Error deleting studio element:", error);
    return new ChatSDKError("bad_request:database").toResponse();
  }
}