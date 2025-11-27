// components/sidebar-projects.tsx
"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import useSWR, { mutate } from "swr";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { fetcher } from "@/lib/utils";
import { LoaderIcon, MoreHorizontalIcon, TrashIcon, PencilEditIcon } from "./icons";
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
import type { Project } from "@/lib/db/schema";
import { FolderIcon } from "lucide-react";

export function SidebarProjects({ userId }: { userId: string | undefined }) {
  const { setOpenMobile } = useSidebar();
  const { id: projectId } = useParams();
  const router = useRouter();

  const { data: projects, isLoading } = useSWR<Project[]>(
    userId ? "/api/project" : null,
    fetcher
  );

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");

  const handleDelete = async () => {
    if (!deleteId) return;

    const deletePromise = fetch(`/api/project?id=${deleteId}`, {
      method: "DELETE",
    });

    toast.promise(deletePromise, {
      loading: "Deleting project...",
      success: () => {
        mutate("/api/project");
        setShowDeleteDialog(false);
        
        if (deleteId === projectId) {
          router.push("/");
        }
        
        return "Project deleted successfully";
      },
      error: "Failed to delete project",
    });
  };

  const handleRename = async (id: string) => {
    if (!newTitle.trim()) {
      setRenamingId(null);
      return;
    }

    try {
      const response = await fetch("/api/project", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, title: newTitle.trim() }),
      });

      if (!response.ok) throw new Error("Failed to rename project");

      mutate("/api/project");
      toast.success("Project renamed successfully");
      setRenamingId(null);
      
      if (id === projectId) {
        router.refresh();
      }
    } catch (error) {
      toast.error("Failed to rename project");
    }
  };

  if (!userId) {
    return (
      <SidebarGroup>
        <SidebarGroupContent>
          <div className="flex w-full flex-row items-center justify-center gap-2 px-2 text-sm text-zinc-500">
            Login to create and manage projects!
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  if (isLoading) {
    return (
      <SidebarGroup>
        <SidebarGroupContent>
          <div className="flex flex-col">
            {[44, 32, 28, 64, 52].map((item) => (
              <div
                className="flex h-8 items-center gap-2 rounded-md px-2"
                key={item}
              >
                <div
                  className="h-4 max-w-(--skeleton-width) flex-1 rounded-md bg-sidebar-accent-foreground/10"
                  style={
                    {
                      "--skeleton-width": `${item}%`,
                    } as React.CSSProperties
                  }
                />
              </div>
            ))}
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  if (!projects || projects.length === 0) {
    return (
      <SidebarGroup>
        <SidebarGroupContent>
          <div className="flex w-full flex-row items-center justify-center gap-2 px-2 text-sm text-zinc-500">
            No projects yet. Create your first project!
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  return (
    <>
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            {projects.map((project) => (
              <SidebarMenuItem key={project.id}>
                {renamingId === project.id ? (
                  <div className="flex items-center gap-2 px-2">
                    <Input
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      onBlur={() => handleRename(project.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRename(project.id);
                        if (e.key === "Escape") {
                          setRenamingId(null);
                          setNewTitle("");
                        }
                      }}
                      autoFocus
                      className="h-8"
                    />
                  </div>
                ) : (
                  <>
                    <SidebarMenuButton asChild isActive={project.id === projectId}>
                      <Link
                        href={`/project/${project.id}`}
                        onClick={() => setOpenMobile(false)}
                      >
                        <FolderIcon size={16} />
                        <span>{project.title}</span>
                      </Link>
                    </SidebarMenuButton>

                    <DropdownMenu modal={true}>
                      <DropdownMenuTrigger asChild>
                        <SidebarMenuAction
                          className="mr-0.5 data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                          showOnHover={project.id !== projectId}
                        >
                          <MoreHorizontalIcon />
                          <span className="sr-only">More</span>
                        </SidebarMenuAction>
                      </DropdownMenuTrigger>

                      <DropdownMenuContent align="end" side="bottom">
                        <DropdownMenuItem
                          className="cursor-pointer"
                          onSelect={() => {
                            setRenamingId(project.id);
                            setNewTitle(project.title);
                          }}
                        >
                          <PencilEditIcon size={14} />
                          <span>Rename</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="cursor-pointer text-destructive focus:bg-destructive/15 focus:text-destructive dark:text-red-500"
                          onSelect={() => {
                            setDeleteId(project.id);
                            setShowDeleteDialog(true);
                          }}
                        >
                          <TrashIcon />
                          <span>Delete</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <AlertDialog onOpenChange={setShowDeleteDialog} open={showDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your
              project and all associated chats, sources, and studio elements.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}