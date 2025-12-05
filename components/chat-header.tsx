// components/chat-header.tsx (updated)
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { memo, useState } from "react";
import { useWindowSize } from "usehooks-ts";
import { Files } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VisibilitySelector, VisibilityType } from "./visibility-selector";
import { useSidebar } from "./ui/sidebar";
import { SidebarToggle } from "./sidebar-toggle";
import { PlusIcon } from "./icons";
import { SignedIn, UserButton } from "@clerk/nextjs";
import { FilesSidebar } from "./files-sidebar";

function PureChatHeader({
  chatId,
  selectedVisibilityType,
  isReadonly,
  projectId,
  filesHidden = false,
}: {
  chatId: string;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
  projectId?: string | null;
  filesHidden?: boolean;
}) {
  const router = useRouter();
  const { open } = useSidebar();
  const { width: windowWidth } = useWindowSize();
  const [isFilesSidebarOpen, setIsFilesSidebarOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 flex items-center gap-2 bg-background px-2 py-1.5 md:px-2">
        <SidebarToggle />

        {(!open || windowWidth < 768) && (
          <Button
            className="order-2 ml-auto h-8 px-2 md:order-1 md:ml-0 md:h-fit md:px-2"
            onClick={() => {
              if (projectId) {
                router.push(`/project/${projectId}`);
              } else {
                router.push("/");
              }
              router.refresh();
            }}
            variant="outline"
          >
            <PlusIcon />
            <span className="md:sr-only">New Chat</span>
          </Button>
        )}

        {!isReadonly && (
          <VisibilitySelector
            chatId={chatId}
            className="order-1 md:order-2"
            selectedVisibilityType={selectedVisibilityType}
          />
        )}

        <div className="order-3 flex items-center gap-2 md:ml-auto md:flex md:h-fit px-2">
          {!filesHidden && <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsFilesSidebarOpen(true)}
            title="Files"
          >
            <Files className="h-5 w-5" />
          </Button>}
          <SignedIn>
            <UserButton />
          </SignedIn>
        </div>
      </header>

      <FilesSidebar
        open={isFilesSidebarOpen}
        onOpenChange={setIsFilesSidebarOpen}
        chatId={chatId}
        projectId={projectId}
      />
    </>
  );
}

export const ChatHeader = memo(PureChatHeader, (prevProps, nextProps) => {
  return (
    prevProps.chatId === nextProps.chatId &&
    prevProps.selectedVisibilityType === nextProps.selectedVisibilityType &&
    prevProps.isReadonly === nextProps.isReadonly &&
    prevProps.projectId === nextProps.projectId && 
    prevProps.filesHidden === nextProps.filesHidden
  );
});