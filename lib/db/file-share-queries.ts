// lib/db/file-share-queries.ts
import "server-only";
import { eq, and } from "drizzle-orm";
import { db } from ".";
import { ChatSDKError } from "../errors";
import { chatFile, fileShare } from "./schema";

export async function createFileShare({
  fileId,
  sharedWithEmail,
  permission,
  sharedBy,
  shareToken,
}: {
  fileId: string;
  sharedWithEmail: string | null;
  permission: "view" | "edit";
  sharedBy: string;
  shareToken?: string;
}) {
  try {
    const [share] = await db
      .insert(fileShare)
      .values({
        fileId,
        sharedWithEmail,
        permission,
        sharedBy,
        shareToken,
        createdAt: new Date(),
      })
      .returning();
    return share;
  } catch (error) {
    throw new ChatSDKError("bad_request:database", "Failed to create file share");
  }
}

export async function getFileShares({ fileId }: { fileId: string }) {
  try {
    return await db
      .select()
      .from(fileShare)
      .where(eq(fileShare.fileId, fileId));
  } catch (error) {
    throw new ChatSDKError("bad_request:database", "Failed to get file shares");
  }
}

export async function getFileByShareToken({ shareToken }: { shareToken: string }) {
  try {
    const [share] = await db
      .select({
        file: chatFile,
        permission: fileShare.permission,
      })
      .from(fileShare)
      .innerJoin(chatFile, eq(fileShare.fileId, chatFile.id))
      .where(eq(fileShare.shareToken, shareToken));
    
    return share;
  } catch (error) {
    throw new ChatSDKError("bad_request:database", "Failed to get shared file");
  }
}

export async function deleteFileShare({ id }: { id: string }) {
  try {
    await db.delete(fileShare).where(eq(fileShare.id, id));
  } catch (error) {
    throw new ChatSDKError("bad_request:database", "Failed to delete file share");
  }
}

export async function getFileById({ id }: { id: string }) {
  try {
    const [file] = await db
      .select()
      .from(chatFile)
      .where(eq(chatFile.id, id));
    return file;
  } catch (error) {
    throw new ChatSDKError("bad_request:database", "Failed to get file");
  }
}