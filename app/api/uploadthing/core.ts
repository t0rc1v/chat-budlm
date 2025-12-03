// app/api/uploadthing/core.ts
import { createChatFile } from "@/lib/db/project-queries";
import { getChatById } from "@/lib/db/queries";
import { processDocument } from "@/lib/services/document-processor";
import { auth } from "@clerk/nextjs/server";
import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import z from "zod";

const f = createUploadthing();

export const ourFileRouter = {
  documentUploader: f({
    pdf: { maxFileSize: "16MB", maxFileCount: 10 },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
      maxFileSize: "16MB",
      maxFileCount: 10,
    },
    "application/msword": { maxFileSize: "16MB", maxFileCount: 10 },
    "text/plain": { maxFileSize: "16MB", maxFileCount: 10 },
    "text/markdown": { maxFileSize: "16MB", maxFileCount: 10 },
    "text/csv": { maxFileSize: "16MB", maxFileCount: 10 },
  })
  .input(
      z.object({
        projectId: z.uuid().optional().nullable(),
        chatId: z.uuid().optional().nullable(),
      })
    )
  .middleware(async ({ input }) => {
    const { userId } = await auth();

    if (!userId) throw new UploadThingError("Unauthorized");

    return { userId, projectId: input.projectId, chatId: input.chatId };
  })
  .onUploadComplete(async ({ metadata, file }) => {
    console.log("Upload complete for userId:", metadata.userId);
    console.log("file url", file.ufsUrl);

    // Create file record
    const chatFileRecord = await createChatFile({
      userId: metadata.userId,
      chatId: metadata.chatId,
      projectId: metadata.projectId,
      fileName: file.name,
      fileUrl: file.ufsUrl,
      fileType: file.type,
      fileSize: file.size,
      uploadthingKey: file.key,
      metadata: {},
    });

    // in /project/[projectId] page only projectId is available
    if(metadata.projectId) {
      // Process document asynchronously
      processDocument({
        fileId: chatFileRecord.id,
        projectId: metadata.projectId,
        fileName: file.name,
        fileUrl: file.ufsUrl,
        fileType: file.type,
      }).catch((error) => {
        console.error("Background processing error:", error);
        // Error handling is done inside processDocument
        // It will update the file status to 'failed'
      });
    } else if (metadata.chatId) {
      // if on chat page check for project id and use that else use chat id since it is not a project chat
      const chat = await getChatById({id: metadata.chatId})
      let id = ""

      if (!chat) {
        throw new Error("Project not found")
      }

      if(chat && chat.projectId) {
        id = chat.projectId
      } else {
        id = chat.id
      }

      processDocument({
        fileId: chatFileRecord.id,
        projectId: id,
        fileName: file.name,
        fileUrl: file.ufsUrl,
        fileType: file.type,
      }).catch((error) => {
        console.error("Background processing error:", error);
      });
    }

    return { uploadedBy: metadata.userId, url: file.ufsUrl, key: file.key };
  }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;