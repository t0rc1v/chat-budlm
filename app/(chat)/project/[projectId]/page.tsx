// app/(projects)/project/[projectId]/page.tsx
import { notFound, redirect } from "next/navigation";
import { Chat } from "@/components/chat";
import { generateUUID } from "@/lib/utils";
import { DataStreamHandler } from "@/components/data-stream-handler";
import { getProjectById } from "@/lib/db/project-queries";
import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";

export default async function ProjectDetailPage(props: { params: Promise<{ projectId: string }> }) {
  const params = await props.params;

  const { projectId } = params;
  const project = await getProjectById({id: projectId})

  if (!project) {
    notFound();
  }

  const {userId} = await auth();
  
  if (!userId) {
    redirect("/sign-in");
  }

  const currentChatId = generateUUID();

  const cookieStore = await cookies();
  const chatModelFromCookie = cookieStore.get("chat-model");
  

  return (
    <div className="flex h-screen">
      {/* Main chat area */}
      <div className="flex-1">
        <Chat
          id={currentChatId}
          initialMessages={[]}
          initialChatModel={chatModelFromCookie?.value || DEFAULT_CHAT_MODEL}
          initialVisibilityType="private"
          isReadonly={false}
          autoResume={false}
          projectId={projectId}
        />
        <DataStreamHandler />
      </div>
    </div>
  );
}