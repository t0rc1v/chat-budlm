// app/api/project/route.ts
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  createProject,
  deleteProjectById,
  getProjectById,
  getProjectsByUserId,
  updateProjectTitle,
} from "@/lib/db/project-queries";
import { ChatSDKError } from "@/lib/errors";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("id");

  const { userId } = await auth();

  if (!userId) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  try {
    if (projectId) {
      // Get single project
      const project = await getProjectById({ id: projectId });

      if (!project) {
        return new ChatSDKError("not_found:chat").toResponse();
      }

      if (project.userId !== userId && project.visibility === "private") {
        return new ChatSDKError("forbidden:chat").toResponse();
      }

      return NextResponse.json(project);
    } else {
      // Get all projects for user
      const projects = await getProjectsByUserId({ userId });
      return NextResponse.json(projects);
    }
  } catch (error) {
    console.error("Error fetching projects:", error);
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
    const { title, visibility = "private" } = body;

    if (!title) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    const project = await createProject({ userId, title, visibility });
    return NextResponse.json(project);
  } catch (error) {
    console.error("Error creating project:", error);
    return new ChatSDKError("bad_request:database").toResponse();
  }
}

export async function PATCH(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  try {
    const body = await request.json();
    const { id, title } = body;

    if (!id || !title) {
      return NextResponse.json(
        { error: "Project ID and title are required" },
        { status: 400 }
      );
    }

    const project = await getProjectById({ id });

    if (!project) {
      return new ChatSDKError("not_found:chat").toResponse();
    }

    if (project.userId !== userId) {
      return new ChatSDKError("forbidden:chat").toResponse();
    }

    const updatedProject = await updateProjectTitle({ id, title });
    return NextResponse.json(updatedProject);
  } catch (error) {
    console.error("Error updating project:", error);
    return new ChatSDKError("bad_request:database").toResponse();
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
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
    const project = await getProjectById({ id });

    if (!project) {
      return new ChatSDKError("not_found:chat").toResponse();
    }

    if (project.userId !== userId) {
      return new ChatSDKError("forbidden:chat").toResponse();
    }

    const deletedProject = await deleteProjectById({ id });
    return NextResponse.json(deletedProject);
  } catch (error) {
    console.error("Error deleting project:", error);
    return new ChatSDKError("bad_request:database").toResponse();
  }
}