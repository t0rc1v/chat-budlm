// lib/db/project-queries.ts
import "server-only";

import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { VisibilityType } from "@/components/visibility-selector";
import { ChatSDKError } from "../errors";
import { chat, document, project, source } from "./schema";
import { db } from ".";
import { SourceType } from "@/types";
import { ArtifactKind } from "@/components/artifact";

// ============== PROJECT QUERIES ==============

export async function createProject({
  userId,
  title,
  visibility = "private",
}: {
  userId: string;
  title: string;
  visibility?: VisibilityType;
}) {
  try {
    const [newProject] = await db
      .insert(project)
      .values({
        userId,
        title,
        visibility,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return newProject;
  } catch (error) {
    console.error("Error creating project:", error);
    throw new ChatSDKError("bad_request:database", "Failed to create project");
  }
}

export async function getProjectById({ id }: { id: string }) {
  try {
    const [selectedProject] = await db
      .select()
      .from(project)
      .where(eq(project.id, id));
    return selectedProject || null;
  } catch (error) {
    console.error("Error getting project by id:", error);
    throw new ChatSDKError("bad_request:database", "Failed to get project");
  }
}

export async function getProjectsByUserId({ userId }: { userId: string }) {
  try {
    const projects = await db
      .select()
      .from(project)
      .where(eq(project.userId, userId))
      .orderBy(desc(project.updatedAt));
    return projects;
  } catch (error) {
    console.error("Error getting projects by user id:", error);
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get user projects"
    );
  }
}

export async function updateProjectTitle({
  id,
  title,
}: {
  id: string;
  title: string;
}) {
  try {
    const [updatedProject] = await db
      .update(project)
      .set({ title, updatedAt: new Date() })
      .where(eq(project.id, id))
      .returning();
    return updatedProject;
  } catch (error) {
    console.error("Error updating project title:", error);
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to update project title"
    );
  }
}

export async function deleteProjectById({ id }: { id: string }) {
  try {
    // Get all chats for this project
    const projectChats = await db
      .select({ id: chat.id })
      .from(chat)
      .where(eq(chat.projectId, id));

    const chatIds = projectChats.map((c) => c.id);

    // Delete associated data (cascading is handled by FK constraints for sources and studio elements)
    if (chatIds.length > 0) {
      // This will be handled by the existing deleteChatById logic
      // But we need to set projectId to null for orphaned chats or delete them
      await db.delete(chat).where(inArray(chat.id, chatIds));
    }

    const [deletedProject] = await db
      .delete(project)
      .where(eq(project.id, id))
      .returning();
    return deletedProject;
  } catch (error) {
    console.error("Error deleting project:", error);
    throw new ChatSDKError("bad_request:database", "Failed to delete project");
  }
}

// ============== SOURCE QUERIES ==============

export async function addSourceToProject({
  projectId,
  sourceType,
  mediaType,
  filename,
  fileKey,
  url,
  chromaCollectionName,
}: {
  projectId: string;
  sourceType: SourceType;
  mediaType: string;
  filename: string;
  fileKey?: string;
  url: string;
  chromaCollectionName: string;
}) {
  try {
    const [newSource] = await db
      .insert(source)
      .values({
        projectId,
        sourceType,
        mediaType,
        filename,
        fileKey,
        url,
        chromaCollectionName,
        createdAt: new Date(),
      })
      .returning();
    return newSource;
  } catch (error) {
    console.error("Error adding source to project:", error);
    throw new ChatSDKError("bad_request:database", "Failed to add source");
  }
}

export async function getSourcesByProjectId({ projectId }: { projectId: string }) {
  try {
    const sources = await db
      .select()
      .from(source)
      .where(eq(source.projectId, projectId))
      .orderBy(desc(source.createdAt));
    return sources;
  } catch (error) {
    console.error("Error getting sources by project id:", error);
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get project sources"
    );
  }
}

export async function deleteSourceById({ id }: { id: string }) {
  try {
    const [deletedSource] = await db
      .delete(source)
      .where(eq(source.id, id))
      .returning();
    return deletedSource;
  } catch (error) {
    console.error("Error deleting source:", error);
    throw new ChatSDKError("bad_request:database", "Failed to delete source");
  }
}

// ============== STUDIO ELEMENT QUERIES ==============

export async function createStudioElement({
  projectId,
  userId,
  type,
  title,
  content,
}: {
  projectId: string;
  userId: string;
  type: ArtifactKind;
  title: string;
  content?: any;
}) {
  try {
    const [newElement] = await db
      .insert(document)
      .values({
        projectId,
        userId,
        kind: type,
        title,
        content,
        createdAt: new Date(),
      })
      .returning();
    return newElement;
  } catch (error) {
    console.error("Error creating studio element:", error);
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to create studio element"
    );
  }
}

export async function getStudioElementsByProjectId({
  projectId,
}: {
  projectId: string;
}) {
  try {
    const elements = await db
      .select()
      .from(document)
      .where(eq(document.projectId, projectId))
      .orderBy(desc(document.createdAt));
    return elements;
  } catch (error) {
    console.error("Error getting studio elements:", error);
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get studio elements"
    );
  }
}

export async function deleteStudioElementById({ id }: { id: string }) {
  try {
    const [deletedElement] = await db
      .delete(document)
      .where(eq(document.id, id))
      .returning();
    return deletedElement;
  } catch (error) {
    console.error("Error deleting studio element:", error);
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete studio element"
    );
  }
}

// ============== CHAT QUERIES (PROJECT RELATED) ==============

export async function getChatsByProjectId({ projectId }: { projectId: string }) {
  try {
    const chats = await db
      .select()
      .from(chat)
      .where(eq(chat.projectId, projectId))
      .orderBy(desc(chat.createdAt));
    return chats;
  } catch (error) {
    console.error("Error getting chats by project id:", error);
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get project chats"
    );
  }
}

export async function updateChatSources({
  chatId,
  sources,
}: {
  chatId: string;
  sources: string[];
}) {
  try {
    const [updatedChat] = await db
      .update(chat)
      .set({ sources })
      .where(eq(chat.id, chatId))
      .returning();
    return updatedChat;
  } catch (error) {
    console.error("Error updating chat sources:", error);
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to update chat sources"
    );
  }
}