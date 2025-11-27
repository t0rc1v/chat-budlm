// components/project-chats-list.tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { formatDistance } from "date-fns";
import { motion } from "framer-motion";
import { mutate } from "swr";
import type { Chat } from "@/lib/db/schema";
import { MessageSquareIcon, MoreHorizontalIcon, TrashIcon, ShareIcon } from "./icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
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
import { useRouter } from "next/navigation";

interface ProjectChatsListProps {
  projectId: string;
  chats: Chat[];
  isOwner: boolean;
}

export function ProjectChatsList({
  projectId,
  chats,
  isOwner,
}: ProjectChatsListProps) {
  const router = useRouter();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleDelete = async () => {
    if (!deleteId) return;

    const deletePromise = fetch(`/api/chat?id=${deleteId}`, {
      method: "DELETE",
    });

    toast.promise(deletePromise, {
      loading: "Deleting chat...",
      success: () => {
        mutate(`/api/project/chats?projectId=${projectId}`);
        setShowDeleteDialog(false);
        return "Chat deleted successfully";
      },
      error: "Failed to delete chat",
    });
  };

  if (chats.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center text-muted-foreground">
          <MessageSquareIcon size={48} className="mx-auto mb-4 opacity-20" />
          <p className="text-lg font-medium">No chats yet</p>
          <p className="text-sm">
            Start a conversation by typing a message below
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto max-w-2xl space-y-1 p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-lg">Chats</h2>
          <span className="text-muted-foreground text-sm">
            {chats.length} {chats.length === 1 ? "chat" : "chats"}
          </span>
        </div>

        <div className="space-y-1">
          {chats.map((chat, index) => (
            <motion.div
              key={chat.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <div className="group flex items-center gap-2 rounded-lg hover:bg-accent">
                <Link
                  href={`/project/${projectId}/chat/${chat.id}`}
                  className="flex-1 min-w-0 px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    <MessageSquareIcon
                      size={16}
                      className="shrink-0 text-muted-foreground"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium text-sm">
                        {chat.title}
                      </p>
                      <div className="flex items-center gap-2 text-muted-foreground text-xs">
                        <span>
                          {formatDistance(new Date(chat.createdAt), new Date(), {
                            addSuffix: true,
                          })}
                        </span>
                        {chat.sources && chat.sources.length > 0 && (
                          <>
                            <span>•</span>
                            <span>
                              {chat.sources.length} source
                              {chat.sources.length !== 1 ? "s" : ""}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>

                {isOwner && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 shrink-0 p-0 opacity-0 group-hover:opacity-100"
                      >
                        <MoreHorizontalIcon size={16} />
                        <span className="sr-only">More options</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          const url = `${window.location.origin}/project/${projectId}/chat/${chat.id}`;
                          navigator.clipboard.writeText(url);
                          toast.success("Link copied to clipboard");
                        }}
                      >
                        <ShareIcon size={14} />
                        <span>Share</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:bg-destructive/15 focus:text-destructive"
                        onClick={() => {
                          setDeleteId(chat.id);
                          setShowDeleteDialog(true);
                        }}
                      >
                        <TrashIcon size={14} />
                        <span>Delete</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <AlertDialog onOpenChange={setShowDeleteDialog} open={showDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this
              chat and all its messages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}