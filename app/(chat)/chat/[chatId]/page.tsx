// app/(chat)/chat/[id]/page.tsx
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { Chat } from "@/components/chat";
import { DataStreamHandler } from "@/components/data-stream-handler";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { getChatById, getMessagesByChatId } from "@/lib/db/queries";
import { convertToUIMessages } from "@/lib/utils";
import { auth } from "@clerk/nextjs/server";

export default async function Page(props: { params: Promise<{ chatId: string }> }) {
  const params = await props.params;
  const { chatId } = params;
  const chat = await getChatById({ id: chatId });

  if (!chat) {
    notFound();
  }

  const {userId} = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  if (chat.visibility === "private") {
    if (!userId) {
      return notFound();
    }

    if (userId !== chat.userId) {
      return notFound();
    }
  }

  const messagesFromDb = await getMessagesByChatId({
    id: chatId,
  });

  const uiMessages = convertToUIMessages(messagesFromDb);

  const cookieStore = await cookies();
  const chatModelFromCookie = cookieStore.get("chat-model");

  if (!chatModelFromCookie) {
    return (
      <>
        <Chat
          autoResume={true}
          id={chat.id}
          initialChatModel={DEFAULT_CHAT_MODEL}
          initialLastContext={chat.lastContext ?? undefined}
          initialMessages={uiMessages}
          initialVisibilityType={chat.visibility}
          isReadonly={userId !== chat.userId}
          projectId={chat.projectId}
        />
        <DataStreamHandler />
      </>
    );
  }

  return (
    <>
      <Chat
        autoResume={true}
        id={chat.id}
        initialChatModel={chatModelFromCookie.value}
        initialLastContext={chat.lastContext ?? undefined}
        initialMessages={uiMessages}
        initialVisibilityType={chat.visibility}
        isReadonly={userId !== chat.userId}
        projectId={chat.projectId}
      />
      <DataStreamHandler />
    </>
  );
}
