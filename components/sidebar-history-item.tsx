// components/sidebar-history-item.tsx (updated)
import Link from "next/link";
import { memo, useState } from "react";
import { Folder, FolderPlus, FolderMinus } from "lucide-react";
import useSWR from "swr";
import { useChatVisibility } from "@/hooks/use-chat-visibility";
import type { Chat, Project } from "@/lib/db/schema";
import { fetcher } from "@/lib/utils";
import {
  CheckCircleFillIcon,
  GlobeIcon,
  LockIcon,
  MoreHorizontalIcon,
  ShareIcon,
  TrashIcon,
} from "./icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "./ui/dropdown-menu";
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "./ui/sidebar";
import { ChatProjectAssignmentDialog } from "./chat-project-assignment";

const PureChatItem = ({
  chat,
  isActive,
  onDelete,
  setOpenMobile,
}: {
  chat: Chat;
  isActive: boolean;
  onDelete: (chatId: string) => void;
  setOpenMobile: (open: boolean) => void;
}) => {
  const { visibilityType, setVisibilityType } = useChatVisibility({
    chatId: chat.id,
    initialVisibilityType: chat.visibility,
  });

  const [showProjectDialog, setShowProjectDialog] = useState(false);

  return (
    <>
      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive={isActive}>
          <Link
            href={`/chat/${chat.id}`}
            onClick={() => setOpenMobile(false)}
            className="flex items-center gap-2"
          >
            {chat.projectId && <Folder className="h-4 w-4 text-muted-foreground" />}
            <span className="flex-1 truncate">{chat.title}</span>
          </Link>
        </SidebarMenuButton>

        <DropdownMenu modal={true}>
          <DropdownMenuTrigger asChild>
            <SidebarMenuAction
              className="mr-0.5 data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              showOnHover={!isActive}
            >
              <MoreHorizontalIcon />
              <span className="sr-only">More</span>
            </SidebarMenuAction>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" side="bottom">
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => setShowProjectDialog(true)}
            >
              {chat.projectId ? (
                <>
                  <FolderMinus className="h-4 w-4" />
                  <span>Remove from Project</span>
                </>
              ) : (
                <>
                  <FolderPlus className="h-4 w-4" />
                  <span>Add to Project</span>
                </>
              )}
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="cursor-pointer">
                <ShareIcon />
                <span>Share</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent>
                  <DropdownMenuItem
                    className="cursor-pointer flex-row justify-between"
                    onClick={() => {
                      setVisibilityType("private");
                    }}
                  >
                    <div className="flex flex-row items-center gap-2">
                      <LockIcon size={12} />
                      <span>Private</span>
                    </div>
                    {visibilityType === "private" ? (
                      <CheckCircleFillIcon />
                    ) : null}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer flex-row justify-between"
                    onClick={() => {
                      setVisibilityType("public");
                    }}
                  >
                    <div className="flex flex-row items-center gap-2">
                      <GlobeIcon />
                      <span>Public</span>
                    </div>
                    {visibilityType === "public" ? <CheckCircleFillIcon /> : null}
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>

            <DropdownMenuItem
              className="cursor-pointer text-destructive focus:bg-destructive/15 focus:text-destructive dark:text-red-500"
              onSelect={() => onDelete(chat.id)}
            >
              <TrashIcon />
              <span>Delete</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>

      <ChatProjectAssignmentDialog
        open={showProjectDialog}
        onOpenChange={setShowProjectDialog}
        chatId={chat.id}
        currentProjectId={chat.projectId}
        onSuccess={() => {
          // Refresh the chat history
          window.location.reload();
        }}
      />
    </>
  );
};

export const ChatItem = memo(PureChatItem, (prevProps, nextProps) => {
  if (prevProps.isActive !== nextProps.isActive) {
    return false;
  }
  return true;
});