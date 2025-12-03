// app/(chat)/projects/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontalIcon, PlusIcon } from "@/components/icons";
import { Plus, Folder, Trash2, Edit2 } from "lucide-react";
import { fetcher } from "@/lib/utils";
import type { Project } from "@/lib/db/schema";

export default function ProjectsPage() {
  const router = useRouter();
  const { data: projects, mutate } = useSWR<Project[]>("/api/projects", fetcher);
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState("");
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const handleCreateProject = async () => {
    if (!newProjectTitle.trim()) {
      toast.error("Please enter a project title");
      return;
    }

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newProjectTitle }),
      });

      if (!response.ok) throw new Error();

      const newProject = await response.json();
      toast.success("Project created successfully");
      setIsCreateDialogOpen(false);
      setNewProjectTitle("");
      mutate();
      router.push(`/project/${newProject.id}`);
    } catch (error) {
      toast.error("Failed to create project");
    }
  };

  const handleUpdateProject = async () => {
    if (!editingProject || !editingProject.title.trim()) {
      toast.error("Please enter a project title");
      return;
    }

    try {
      const response = await fetch("/api/projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingProject.id,
          title: editingProject.title,
        }),
      });

      if (!response.ok) throw new Error();

      toast.success("Project updated successfully");
      setIsEditDialogOpen(false);
      setEditingProject(null);
      mutate();
    } catch (error) {
      toast.error("Failed to update project");
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!confirm("Are you sure you want to delete this project?")) return;

    try {
      const response = await fetch(`/api/projects?id=${projectId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error();

      toast.success("Project deleted successfully");
      mutate();
    } catch (error) {
      toast.error("Failed to delete project");
    }
  };

  return (
    <div className="flex h-full w-full flex-col items-center p-8">
      <div className="w-full max-w-4xl">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="font-bold text-3xl">Projects</h1>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <PlusIcon />
            New Project
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {projects?.map((project) => (
            <div
              key={project.id}
              className="group relative cursor-pointer rounded-lg border bg-card p-6 transition-colors hover:bg-accent"
              onClick={() => router.push(`/project/${project.id}`)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Folder size={24} />
                  <div>
                    <h3 className="font-semibold">{project.title}</h3>
                    <p className="text-muted-foreground text-sm">
                      Updated {new Date(project.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100">
                      <MoreHorizontalIcon />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingProject(project);
                        setIsEditDialogOpen(true);
                      }}
                    >
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteProject(project.id);
                      }}
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>

        {projects?.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Folder size={48} className="mb-4 text-muted-foreground" />
            <h3 className="mb-2 font-semibold text-lg">No projects yet</h3>
            <p className="mb-4 text-muted-foreground">
              Create your first project to get started
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <PlusIcon />
              Create Project
            </Button>
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>
              Enter a name for your new project
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Project Title</Label>
              <Input
                id="title"
                value={newProjectTitle}
                onChange={(e) => setNewProjectTitle(e.target.value)}
                placeholder="My Project"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateProject}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-title">Project Title</Label>
              <Input
                id="edit-title"
                value={editingProject?.title || ""}
                onChange={(e) =>
                  setEditingProject((prev) =>
                    prev ? { ...prev, title: e.target.value } : null
                  )
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateProject}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}