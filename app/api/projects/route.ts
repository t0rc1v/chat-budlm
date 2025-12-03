// app/api/projects/route.ts
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  createProject,
  getProjectsByUserId,
  updateProject,
  deleteProjectById,
  getProjectById,
} from "@/lib/db/project-queries";
import { ChatSDKError } from "@/lib/errors";

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    const projects = await getProjectsByUserId({ userId });
    return NextResponse.json(projects, { status: 200 });
  } catch (error) {
    console.error("Error getting projects:", error);
    return NextResponse.json(
      { error: "Failed to get projects" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    const { title } = await request.json();

    if (!title || title.trim() === "") {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    const project = await createProject({ userId, title: title.trim() });
    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error("Error creating project:", error);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    const { id, title } = await request.json();

    if (!id || !title || title.trim() === "") {
      return NextResponse.json(
        { error: "Project ID and title are required" },
        { status: 400 }
      );
    }

    const project = await getProjectById({ id });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    if (project.userId !== userId) {
      return new ChatSDKError("forbidden:chat").toResponse();
    }

    const updatedProject = await updateProject({ id, title: title.trim() });
    return NextResponse.json(updatedProject, { status: 200 });
  } catch (error) {
    console.error("Error updating project:", error);
    return NextResponse.json(
      { error: "Failed to update project" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      );
    }

    const project = await getProjectById({ id });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    if (project.userId !== userId) {
      return new ChatSDKError("forbidden:chat").toResponse();
    }

    await deleteProjectById({ id });
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error deleting project:", error);
    return NextResponse.json(
      { error: "Failed to delete project" },
      { status: 500 }
    );
  }
}