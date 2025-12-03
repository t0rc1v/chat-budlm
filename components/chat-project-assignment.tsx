// components/chat-project-assignment-dialog.tsx
"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { fetcher } from "@/lib/utils";
import type { Project } from "@/lib/db/schema";

interface ChatProjectAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatId: string;
  currentProjectId?: string | null;
  onSuccess?: () => void;
}

export function ChatProjectAssignmentDialog({
  open,
  onOpenChange,
  chatId,
  currentProjectId,
  onSuccess,
}: ChatProjectAssignmentDialogProps) {
  const { data: projects } = useSWR<Project[]>("/api/projects", fetcher);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    currentProjectId || ""
  );
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleAssign = async () => {
    setIsLoading(true);
    try {
      let projectId = selectedProjectId;

      // Create new project if needed
      if (isCreatingNew) {
        if (!newProjectTitle.trim()) {
          toast.error("Please enter a project title");
          return;
        }

        const createResponse = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: newProjectTitle }),
        });

        if (!createResponse.ok) throw new Error();

        const newProject = await createResponse.json();
        projectId = newProject.id;
      }

      // Assign chat to project
      const response = await fetch("/api/chat/project", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId,
          projectId: projectId === "no-project" ? null : projectId,
        }),
      });

      if (!response.ok) throw new Error();

      toast.success(
        projectId !== "no-project"
          ? isCreatingNew
            ? "Chat added to new project"
            : "Chat assigned to project"
          : "Chat removed from project"
      );
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error("Failed to update chat project");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign to Project</DialogTitle>
          <DialogDescription>
            Add this chat to a project to use document context
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {!isCreatingNew ? (
            <>
              <div className="grid gap-2">
                <Label htmlFor="project">Project</Label>
                <Select
                  value={selectedProjectId}
                  onValueChange={setSelectedProjectId}
                >
                  <SelectTrigger id="project">
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no-project">No Project</SelectItem>
                    {projects?.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                variant="outline"
                onClick={() => setIsCreatingNew(true)}
                className="w-full"
              >
                Create New Project
              </Button>
            </>
          ) : (
            <>
              <div className="grid gap-2">
                <Label htmlFor="new-project">New Project Title</Label>
                <Input
                  id="new-project"
                  value={newProjectTitle}
                  onChange={(e) => setNewProjectTitle(e.target.value)}
                  placeholder="My Project"
                />
              </div>

              <Button
                variant="outline"
                onClick={() => {
                  setIsCreatingNew(false);
                  setNewProjectTitle("");
                }}
                className="w-full"
              >
                Back to Existing Projects
              </Button>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAssign} disabled={isLoading}>
            {isLoading ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}