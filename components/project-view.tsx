// components/project-view.tsx
"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { unstable_serialize } from "swr/infinite";
import { Button } from "@/components/ui/button";
import { MultimodalInput } from "@/components/multimodal-input";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { fetcher, fetchWithErrorHandlers, generateUUID } from "@/lib/utils";
import { PanelRightIcon, UploadIcon, PencilEditIcon } from "./icons";
import { ProjectChatsList } from "./project-chats-list";
import { ProjectStudioSidebar } from "./project-studio-sidebar";
import { SourcesModal } from "./sources-modal";
import { getChatHistoryPaginationKey } from "./sidebar-history";
import type { Chat, Source } from "@/lib/db/schema";
import type { Attachment, ChatMessage } from "@/lib/types";
import type { AppUsage } from "@/lib/usage";
import { ChatSDKError } from "@/lib/errors";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { Input } from "./ui/input";

interface ProjectViewProps {
  projectId: string;
  projectTitle: string;
  isOwner: boolean;
  userId: string;
  initialChatModel: string;
}

export function ProjectView({
  projectId,
  projectTitle,
  isOwner,
  userId,
  initialChatModel,
}: ProjectViewProps) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [showStudioSidebar, setShowStudioSidebar] = useState(false);
  const [showSourcesModal, setShowSourcesModal] = useState(false);
  const [showCreditCardAlert, setShowCreditCardAlert] = useState(false);
  const [usage, setUsage] = useState<AppUsage | undefined>(undefined);
  const [currentModelId, setCurrentModelId] = useState(initialChatModel);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState(projectTitle);
  
  const currentChatIdRef = useRef<string | null>(null);
  const hasNavigatedRef = useRef(false);

  const { data: chats, mutate: mutateChats } = useSWR<Chat[]>(
    `/api/project/chats?projectId=${projectId}`,
    fetcher
  );

  const { data: sources } = useSWR<Source[]>(
    `/api/project/sources?projectId=${projectId}`,
    fetcher
  );

  const {
    messages,
    setMessages,
    sendMessage,
    status,
    stop,
  } = useChat<ChatMessage>({
    id: `project-view-${projectId}`,
    messages: [],
    experimental_throttle: 100,
    generateId: generateUUID,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      fetch: fetchWithErrorHandlers,
      prepareSendMessagesRequest(request) {
        const chatId = generateUUID();
        currentChatIdRef.current = chatId;
        hasNavigatedRef.current = false;
        
        return {
          body: {
            id: chatId,
            message: request.messages.at(-1),
            selectedChatModel: currentModelId,
            selectedVisibilityType: "private",
            projectId: projectId,
            ...request.body,
          },
        };
      },
    }),
    onData: (dataPart) => {
      if (dataPart.type === "data-usage") {
        setUsage(dataPart.data);
      }
      
      // Navigate after first data chunk (chat is created)
      if (!hasNavigatedRef.current && currentChatIdRef.current) {
        hasNavigatedRef.current = true;
        router.push(`/project/${projectId}/chat/${currentChatIdRef.current}`);
      }
    },
    onFinish: () => {
      mutate(unstable_serialize(getChatHistoryPaginationKey));
      mutateChats();
      
      // Clear for next message
      setInput("");
      setAttachments([]);
      currentChatIdRef.current = null;
    },
    onError: (error) => {
      if (error instanceof ChatSDKError) {
        if (
          error.message?.includes("AI Gateway requires a valid credit card")
        ) {
          setShowCreditCardAlert(true);
        } else {
          toast.error(error.message);
        }
      }
      
      hasNavigatedRef.current = false;
      currentChatIdRef.current = null;
    },
  });

  const handleRename = async () => {
    if (!newTitle.trim() || newTitle === projectTitle) {
      setIsRenaming(false);
      setNewTitle(projectTitle);
      return;
    }

    try {
      const response = await fetch("/api/project", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: projectId, title: newTitle.trim() }),
      });

      if (!response.ok) throw new Error("Failed to rename project");

      toast.success("Project renamed successfully");
      mutate("/api/project");
      setIsRenaming(false);
      router.refresh();
    } catch (error) {
      toast.error("Failed to rename project");
      setNewTitle(projectTitle);
    }
  };

  return (
    <>
      <div className="flex h-dvh flex-col bg-background">
        {/* Header */}
        <header className="sticky top-0 flex items-center gap-2 border-b bg-background px-2 py-1.5 md:px-2">
          <SidebarToggle />
          
          {isRenaming ? (
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRename();
                if (e.key === "Escape") {
                  setIsRenaming(false);
                  setNewTitle(projectTitle);
                }
              }}
              autoFocus
              className="h-8 flex-1"
            />
          ) : (
            <h1 className="flex-1 truncate font-semibold text-lg group flex items-center gap-2">
              {projectTitle}
              {isOwner && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                  onClick={() => setIsRenaming(true)}
                >
                  <PencilEditIcon size={14} />
                </Button>
              )}
            </h1>
          )}

          {isOwner && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSourcesModal(true)}
              >
                <UploadIcon size={16} />
                <span className="hidden sm:inline">Sources</span>
                {sources && sources.length > 0 && (
                  <span className="ml-1 text-xs text-muted-foreground">
                    ({sources.length})
                  </span>
                )}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowStudioSidebar(!showStudioSidebar)}
              >
                <PanelRightIcon size={16} />
                <span className="hidden sm:inline">Studio</span>
              </Button>
            </>
          )}
        </header>

        {/* Main Content */}
        <div className="flex flex-1 overflow-hidden">
          <div
            className={`flex flex-1 flex-col transition-all duration-300 ${
              showStudioSidebar ? "mr-80" : ""
            }`}
          >
            {/* Chats List */}
            <div className="flex-1 overflow-y-auto">
              <ProjectChatsList
                projectId={projectId}
                chats={chats || []}
                isOwner={isOwner}
              />
            </div>

            {/* Input Area */}
            <div className="border-t p-4">
              <div className="mx-auto max-w-4xl">
                {isOwner && sources && sources.length === 0 && (
                  <div className="mb-4 rounded-lg border border-dashed bg-muted/50 p-4 text-center">
                    <p className="mb-2 text-muted-foreground text-sm">
                      No sources added yet
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowSourcesModal(true)}
                    >
                      <UploadIcon size={16} />
                      Add Your First Source
                    </Button>
                  </div>
                )}

                <MultimodalInput
                  chatId={`project-view-${projectId}`}
                  input={input}
                  setInput={setInput}
                  status={status}
                  stop={stop}
                  attachments={attachments}
                  setAttachments={setAttachments}
                  messages={messages}
                  setMessages={setMessages}
                  sendMessage={sendMessage}
                  selectedVisibilityType="private"
                  selectedModelId={currentModelId}
                  onModelChange={setCurrentModelId}
                  usage={usage}
                />
              </div>
            </div>
          </div>

          {/* Studio Sidebar */}
          {showStudioSidebar && (
            <ProjectStudioSidebar
              projectId={projectId}
              onClose={() => setShowStudioSidebar(false)}
            />
          )}
        </div>

        {/* Sources Modal */}
        <SourcesModal
          open={showSourcesModal}
          onOpenChange={setShowSourcesModal}
          projectId={projectId}
          sources={sources || []}
          selectedSources={[]}
          onSourcesChange={() => {}}
          isOwner={isOwner}
        />

        {/* Credit Card Alert */}
        <AlertDialog
          onOpenChange={setShowCreditCardAlert}
          open={showCreditCardAlert}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Activate AI Gateway</AlertDialogTitle>
              <AlertDialogDescription>
                This application requires{" "}
                {process.env.NODE_ENV === "production" ? "the owner" : "you"} to
                activate Vercel AI Gateway.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  window.open(
                    "https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai%3Fmodal%3Dadd-credit-card",
                    "_blank"
                  );
                  window.location.href = "/";
                }}
              >
                Activate
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  );
}