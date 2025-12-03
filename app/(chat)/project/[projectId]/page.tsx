// app/(projects)/project/[projectId]/page.tsx
"use client";

import { useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import { useDropzone } from "react-dropzone";
import { Chat } from "@/components/chat";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  PlusIcon,
  FileIcon,
  TrashIcon,
  MoreHorizontalIcon,
  ShareIcon,
  LoaderIcon,
} from "@/components/icons";
import { fetcher, generateUUID } from "@/lib/utils";
import type { Project, ChatFile, Chat as ChatType } from "@/lib/db/schema";
import { ALLOWED_FILE_TYPES, MAX_PROJECT_SIZE } from "@/lib/constants";
import { DataStreamHandler } from "@/components/data-stream-handler";
import { AlertCircleIcon, CheckCircleIcon, Loader2, UploadIcon } from "lucide-react";

export default function ProjectDetailPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.projectId as string;

  const [currentChatId] = useState(generateUUID());

  return (
    <div className="flex h-screen">


      {/* Main chat area */}
      <div className="flex-1">
        <Chat
          id={currentChatId}
          initialMessages={[]}
          initialChatModel="chat-model"
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