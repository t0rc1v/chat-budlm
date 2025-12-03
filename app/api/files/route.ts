// app/api/files/route.ts
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { UTApi } from "uploadthing/server";
import { 
  createChatFile, 
  deleteChatFile, 
  getChatFileById, 
  getChatFiles,
  getProjectFiles,
} from "@/lib/db/project-queries";
import { ChatSDKError } from "@/lib/errors";
import { processDocument } from "@/lib/services/document-processor";
import { deleteFileFromCollection } from "@/lib/services/chroma";
import { ALLOWED_FILE_TYPES } from "@/lib/constants";
import { getChatById } from "@/lib/db/queries";

const utapi = new UTApi();

export async function GET(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new ChatSDKError("unauthorized:api").toResponse();
    }

    const { searchParams } = new URL(request.url);
    const chatId = searchParams.get("chatId");
    const projectId = searchParams.get("projectId");

    console.log("projectId", projectId, chatId)

    if (projectId) {
      const files = await getProjectFiles({ projectId });
      return NextResponse.json(files, { status: 200 });
    }

    if (chatId) {
      const files = await getChatFiles({ chatId });
      return NextResponse.json(files, { status: 200 });
    }

    return NextResponse.json(
      { error: "chatId or projectId required" },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return NextResponse.json(
      { error: "Failed to fetch files" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new ChatSDKError("unauthorized:api").toResponse();
    }

    const { searchParams } = new URL(request.url);
    const chatId = searchParams.get("chatId");
    const projectId = searchParams.get("projectId");

    console.log(" projectId", projectId)

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      console.error("no file")
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Check file type
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `File type ${file.type} not allowed. Supported types: PDF, DOCX, DOC, TXT, MD, CSV` },
        { status: 400 }
      );
    }

    // Upload to UploadThing
    const uploadedFile = await utapi.uploadFiles([file]);

    if (!uploadedFile[0] || uploadedFile[0].error) {
      console.error("UploadThing error:", uploadedFile[0]?.error);
      return NextResponse.json(
        { error: "Failed to upload file to storage" },
        { status: 500 }
      );
    }

    const { key, ufsUrl } = uploadedFile[0].data;

    // Create file record
    const chatFileRecord = await createChatFile({
      userId,
      chatId,
      projectId,
      fileName: file.name,
      fileUrl: ufsUrl,
      fileType: file.type,
      fileSize: file.size,
      uploadthingKey: key,
      metadata: {},
    });

    // in /project/[projectId] page only projectId is available
    if(projectId) {
      // Process document asynchronously
      processDocument({
        fileId: chatFileRecord.id,
        projectId: projectId,
        fileName: file.name,
        fileUrl: ufsUrl,
        fileType: file.type,
      }).catch((error) => {
        console.error("Background processing error:", error);
        // Error handling is done inside processDocument
        // It will update the file status to 'failed'
      });
    } else if (chatId) {
      // if on chat page check for project id and use that else use chat id since it is not a project chat
      const chat = await getChatById({id: chatId})
      let id = ""

      if (!chat) {
        return NextResponse.json(
          { error: "Project not found" },
          { status: 404 }
        );
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
        fileUrl: ufsUrl,
        fileType: file.type,
      }).catch((error) => {
        console.error("Background processing error:", error);
      });
    }


    return NextResponse.json(file, { status: 201 });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return NextResponse.json(
      { error: "Failed to create file" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new ChatSDKError("unauthorized:api").toResponse();
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const projectId = searchParams.get("projectId");

    if (!id || !projectId) {
      return NextResponse.json(
        { error: "File ID and projectId are required" },
        { status: 400 }
      );
    }

    // Get file details before deleting
    const file = await getChatFileById({ fileId: id });

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Delete from UploadThing
    if (file.uploadthingKey) {
      try {
        await utapi.deleteFiles(file.uploadthingKey);
      } catch (error) {
        console.error("Error deleting from UploadThing:", error);
        // Continue even if UploadThing delete fails
      }
    }

    // Delete from ChromaDB
    try {
      await deleteFileFromCollection({ projectId, fileId: id });
    } catch (error) {
      console.error("Error deleting from ChromaDB:", error);
    }

    // Delete file record from db
    const deletedFile = await deleteChatFile({ id });
    return NextResponse.json(deletedFile, { status: 200 });
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 }
    );
  }
}