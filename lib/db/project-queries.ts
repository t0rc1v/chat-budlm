// lib/db/project-queries.ts
import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { db } from ".";
import { chat, chatFile, fileSelection, project } from "./schema";
import { ChatSDKError } from "../errors";

export async function createProject({
  userId,
  title,
}: {
  userId: string;
  title: string;
}) {
  try {
    const [newProject] = await db
      .insert(project)
      .values({
        userId,
        title,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    
    return newProject;
  } catch (error) {
    throw new ChatSDKError("bad_request:database", "Failed to create project");
  }
}

export async function getProjectsByUserId({ userId }: { userId: string }) {
  try {
    return await db
      .select()
      .from(project)
      .where(eq(project.userId, userId))
      .orderBy(desc(project.updatedAt));
  } catch (error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get projects by user id"
    );
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
    throw new ChatSDKError("bad_request:database", "Failed to get project by id");
  }
}

export async function updateProject({
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
    throw new ChatSDKError("bad_request:database", "Failed to update project");
  }
}

export async function deleteProjectById({ id }: { id: string }) {
  try {
    // Files and selections will cascade delete
    const [deletedProject] = await db
      .delete(project)
      .where(eq(project.id, id))
      .returning();
    
    return deletedProject;
  } catch (error) {
    throw new ChatSDKError("bad_request:database", "Failed to delete project");
  }
}

export async function createChatFile({
  projectId,
  chatId,
  userId,
  fileName,
  fileUrl,
  fileType,
  fileSize,
  uploadthingKey,
  metadata,
}: {
  projectId?: string | null | undefined;
  chatId?: string | null | undefined;
  userId: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  uploadthingKey: string;
  metadata?: Record<string, any>;
}) {
  try {
    const [newFile] = await db
      .insert(chatFile)
      .values({
        userId,
        chatId: chatId || null,
        projectId: projectId || null,
        fileName,
        fileUrl,
        fileType,
        fileSize,
        uploadthingKey,
        metadata: metadata || {},
        embeddingStatus: "pending",
        createdAt: new Date(),
      })
      .returning();
    
    if (!newFile) {
      throw new Error("Failed to create file record");
    }
    
    return newFile;
  } catch (error: any) {
    console.error(error)
    // console.error("createChatFile error:", {
    //   message: error?.message,
    //   code: error?.code,
    //   detail: error?.detail,
    //   constraint: error?.constraint,
    // });
    
    // Re-throw with more context
    throw new Error(`Database error: ${error?.message || "Failed to create file"}`);
  }
}

export async function getProjectFiles({ projectId }: { projectId: string }) {
  try {
    return await db
      .select()
      .from(chatFile)
      .where(eq(chatFile.projectId, projectId))
      .orderBy(desc(chatFile.createdAt));
  } catch (error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get project files"
    );
  }
}

export async function deleteChatFile({ id }: { id: string }) {
  try {
    // Delete associated file selections
    await db.delete(fileSelection).where(eq(fileSelection.fileId, id));

    // Delete file
    const [deletedFile] = await db
      .delete(chatFile)
      .where(eq(chatFile.id, id))
      .returning();
    return deletedFile;
  } catch (error) {
    throw new ChatSDKError("bad_request:database", "Failed to delete file");
  }
}

export async function updateFileEmbeddingStatus({
  id,
  status,
  chromaCollectionId,
}: {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  chromaCollectionId?: string;
}) {
  try {
    const updateData: any = { embeddingStatus: status };
    if (chromaCollectionId) {
      updateData.chromaCollectionId = chromaCollectionId;
    }
    
    await db
      .update(chatFile)
      .set(updateData)
      .where(eq(chatFile.id, id));
  } catch (error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to update file embedding status"
    );
  }
}

export async function updateChatProject({
  chatId,
  projectId,
}: {
  chatId: string;
  projectId: string | null;
}) {
  try {
    await db
      .update(chat)
      .set({ projectId })
      .where(eq(chat.id, chatId));
  } catch (error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to update chat project"
    );
  }
}

export async function getChatsByProjectId({ projectId }: { projectId: string }) {
  try {
    return await db
      .select()
      .from(chat)
      .where(eq(chat.projectId, projectId))
      .orderBy(desc(chat.createdAt));
  } catch (error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get chats by project id"
    );
  }
}

export async function saveFileSelection({
  projectId,
  chatId,
  fileId,
  isSelected,
}: {
  projectId: string;
  chatId: string;
  fileId: string;
  isSelected: boolean;
}) {
  try {
    // Check if selection exists
    const [existing] = await db
      .select()
      .from(fileSelection)
      .where(
        and(
          eq(fileSelection.chatId, chatId),
          eq(fileSelection.fileId, fileId)
        )
      );
    
    if (existing) {
      // Update existing
      await db
        .update(fileSelection)
        .set({ isSelected })
        .where(eq(fileSelection.id, existing.id));
    } else {
      // Create new
      await db.insert(fileSelection).values({
        chatId,
        fileId,
        isSelected,
        createdAt: new Date(),
      });
    }
  } catch (error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to save file selection"
    );
  }
}

export async function getFileSelections({
  chatId,
}: {
  chatId: string;
}) {
  try {
    return await db
      .select()
      .from(fileSelection)
      .where(eq(fileSelection.chatId, chatId));
  } catch (error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get file selections"
    );
  }
}

export async function getChatFiles({ chatId }: { chatId: string }) {
  try {
    return await db
      .select()
      .from(chatFile)
      .where(eq(chatFile.chatId, chatId))
      .orderBy(desc(chatFile.createdAt));
  } catch (error) {
    throw new ChatSDKError("bad_request:database", "Failed to get chat files");
  }
}

export async function getChatFileById({ fileId }: { fileId: string }) {
  try {
    const [file] = await db
      .select()
      .from(chatFile)
      .where(eq(chatFile.id, fileId))
      .limit(1);
    return file
  } catch (error) {
    throw new ChatSDKError("bad_request:database", "Failed to get chat file");
  }
}

export async function deleteChatFileSelections({ chatId }: { chatId: string }) {
  try {
    await db.delete(fileSelection).where(eq(fileSelection.chatId, chatId));
  } catch (error) {
    throw new ChatSDKError("bad_request:database", "Failed to delete file selections");
  }
}

export async function updateFileMetadata({
  id,
  metadata,
}: {
  id: string;
  metadata: any;
}) {
  try {
    const [updatedFile] = await db
      .update(chatFile)
      .set({ metadata })
      .where(eq(chatFile.id, id))
      .returning();
    return updatedFile;
  } catch (error) {
    throw new ChatSDKError("bad_request:database", "Failed to update file metadata");
  }
}
// export async function getTotalProjectFileSize({ projectId }: { projectId: string }) {
//   try {
//     const files = await db
//       .select()
//       .from(projectFile)
//       .where(eq(projectFile.projectId, projectId));
    
//     return files.reduce((total, file) => total + file.fileSize, 0);
//   } catch (error) {
//     throw new ChatSDKError(
//       "bad_request:database",
//       "Failed to get total project file size"
//     );
//   }
// }