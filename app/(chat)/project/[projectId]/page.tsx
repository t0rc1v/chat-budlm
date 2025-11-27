// app/project/[id]/page.tsx
import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ProjectView } from "@/components/project-view";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { getProjectById } from "@/lib/db/project-queries";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const project = await getProjectById({ id: projectId });

  if (!project) {
    notFound();
  }

  if (project.userId !== userId && project.visibility === "private") {
    notFound();
  }

  const cookieStore = await cookies();
  const chatModelFromCookie = cookieStore.get("chat-model");
  const initialChatModel = chatModelFromCookie?.value || DEFAULT_CHAT_MODEL;

  return (
    <ProjectView
      projectId={projectId}
      projectTitle={project.title}
      isOwner={project.userId === userId}
      userId={userId}
      initialChatModel={initialChatModel}
    />
  );
}