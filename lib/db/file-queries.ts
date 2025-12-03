// lib/db/file-queries.ts
import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from ".";
import { ChatSDKError } from "../errors";
import { fileSelection, chatFile } from "./schema";

export async function getSelectedFileIds({ chatId }: { chatId: string }): Promise<string[]> {
  try {
    const selections = await db
      .select({
        fileId: fileSelection.fileId,
      })
      .from(fileSelection)
      .where(
        and(
          eq(fileSelection.chatId, chatId),
          eq(fileSelection.isSelected, true)
        )
      );
    
    return selections.map(s => s.fileId);
  } catch (error) {
    throw new ChatSDKError("bad_request:database", "Failed to get selected file IDs");
  }
}

export async function toggleFileSelection({
  chatId,
  fileId,
}: {
  chatId: string;
  fileId: string;
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
      // Toggle existing selection
      const [updated] = await db
        .update(fileSelection)
        .set({ isSelected: !existing.isSelected })
        .where(
          and(
            eq(fileSelection.chatId, chatId),
            eq(fileSelection.fileId, fileId)
          )
        )
        .returning();
      return updated;
    } else {
      // Create new selection
      const [created] = await db
        .insert(fileSelection)
        .values({
          chatId,
          fileId,
          isSelected: true,
          createdAt: new Date(),
        })
        .returning();
      return created;
    }
  } catch (error) {
    console.error(error)
    throw new ChatSDKError("bad_request:database", "Failed to toggle file selection");
  }
}