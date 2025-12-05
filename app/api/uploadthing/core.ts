// app/api/uploadthing/core.ts
import { toggleFileSelection } from "@/lib/db/file-queries";
import { createChatFile, getProjectById } from "@/lib/db/project-queries";
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
    
    let projectId: string | null = null;
    let chatId: string | null = null;

    if (metadata.projectId) {
      const project = await getProjectById({id:metadata.projectId})
      if(project) projectId = metadata.projectId
      
    }
    if(metadata.chatId) {
      const chat = await getChatById({id: metadata.chatId})
      if(chat) chatId = metadata.chatId
    }

    // Create file record
    const chatFileRecord = await createChatFile({
      userId: metadata.userId,
      chatId: chatId,
      projectId: projectId,
      fileName: file.name,
      fileUrl: file.ufsUrl,
      fileType: file.type,
      fileSize: file.size,
      uploadthingKey: file.key,
      metadata: {},
    });

    processDocument({
      fileId: chatFileRecord.id,
      fileName: file.name,
      fileUrl: file.ufsUrl,
      fileType: file.type,
    }).catch((error) => {
      console.error("Background processing error:", error);
      // Error handling is done inside processDocument
      // It will update the file status to 'failed'
    });

    // create file selection - select the file by default
    if(chatId) await toggleFileSelection({chatId, fileId: chatFileRecord.id})

    return { uploadedBy: metadata.userId, url: file.ufsUrl, key: file.key };
  }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;