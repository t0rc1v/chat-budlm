// app/project/[projectId]/chat/[chatId]/page.tsx
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { Chat } from "@/components/chat";
import { DataStreamHandler } from "@/components/data-stream-handler";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { getChatById, getMessagesByChatId } from "@/lib/db/queries";
import { getProjectById, getSourcesByProjectId } from "@/lib/db/project-queries";
import { convertToUIMessages } from "@/lib/utils";

export default async function ProjectChatPage({
  params,
}: {
  params: Promise<{ projectId: string; chatId: string }>;
}) {
  const { projectId, chatId } = await params;
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  // Verify project exists and user has access
  const project = await getProjectById({ id: projectId });
  if (!project) {
    notFound();
  }

  if (project.userId !== userId && project.visibility === "private") {
    notFound();
  }

  // Get chat
  const chat = await getChatById({ id: chatId });
  if (!chat) {
    notFound();
  }

  // Verify chat belongs to this project
  if (chat.projectId !== projectId) {
    notFound();
  }

  if (chat.visibility === "private") {
    if (userId !== chat.userId) {
      return notFound();
    }
  }

  const messagesFromDb = await getMessagesByChatId({ id: chatId });
  const uiMessages = convertToUIMessages(messagesFromDb);

  // Get project sources for context
  const sources = await getSourcesByProjectId({ projectId });

  const cookieStore = await cookies();
  const chatModelFromCookie = cookieStore.get("chat-model");

  const initialChatModel = chatModelFromCookie?.value || DEFAULT_CHAT_MODEL;

  return (
    <>
      <Chat
        autoResume={true}
        id={chat.id}
        initialChatModel={initialChatModel}
        initialLastContext={chat.lastContext ?? undefined}
        initialMessages={uiMessages}
        initialVisibilityType={chat.visibility}
        isReadonly={userId !== chat.userId}
        projectId={projectId}
        chatSources={chat.sources || []}
        projectSources={sources}
      />
      <DataStreamHandler />
    </>
  );
}