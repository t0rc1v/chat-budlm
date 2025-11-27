// components/project-studio-sidebar.tsx - Updated to create actual artifacts

"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { generateUUID } from "@/lib/utils";
import {
  BookOpenIcon,
  ClipboardIcon,
  CrossIcon,
  PresentationIcon,
  SparklesIcon,
} from "./icons";
import { FileTextIcon } from "lucide-react";

interface ProjectStudioSidebarProps {
  projectId: string;
  onClose: () => void;
}

const studioElementTypes = [
  { type: "quiz", label: "Quiz", icon: ClipboardIcon },
  { type: "flashcard", label: "Flashcards", icon: BookOpenIcon },
  { type: "report", label: "Report", icon: FileTextIcon },
  { type: "slides", label: "Slides", icon: PresentationIcon },
] as const;

export function ProjectStudioSidebar({
  projectId,
  onClose,
}: ProjectStudioSidebarProps) {
  const router = useRouter();
  const [creatingType, setCreatingType] = useState<string | null>(null);

  const handleCreateElement = async (type: string) => {
    setCreatingType(type);

    try {
      // Create a new chat with the studio element request
      const chatId = generateUUID();
      const prompt = `Create a ${type} about the project topic`;

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: chatId,
          message: {
            id: generateUUID(),
            role: "user",
            parts: [{ type: "text", text: prompt }],
          },
          selectedChatModel: "chat-model",
          selectedVisibilityType: "private",
          projectId,
        }),
      });

      if (!response.ok) throw new Error("Failed to create element");

      toast.success(`Creating ${type}...`);
      router.push(`/project/${projectId}/chat/${chatId}`);
    } catch (error) {
      toast.error(`Failed to create ${type}`);
    } finally {
      setCreatingType(null);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-80 border-l bg-background shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between border-b p-4">
        <div className="flex items-center gap-2">
          <SparklesIcon size={20} />
          <h2 className="font-semibold">Studio</h2>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <CrossIcon size={16} />
        </Button>
      </div>

      <ScrollArea className="h-[calc(100vh-65px)]">
        <div className="p-4">
          {/* Quick Actions */}
          <div className="mb-6">
            <h3 className="mb-3 font-medium text-sm text-muted-foreground">
              Quick Actions
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {studioElementTypes.map(({ type, label, icon: Icon }) => (
                <Button
                  key={type}
                  variant="outline"
                  className="h-auto flex-col gap-2 py-3"
                  onClick={() => handleCreateElement(type)}
                  disabled={creatingType === type}
                >
                  <Icon size={20} />
                  <span className="text-xs">{label}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Info */}
          <div className="rounded-lg border border-dashed p-4 text-center text-muted-foreground text-sm">
            Click any button above to generate a new studio element. It will create a chat with the generated artifact.
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}