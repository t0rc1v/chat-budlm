// components/app-sidebar.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { unstable_serialize } from "swr/infinite";
import { PlusIcon, TrashIcon } from "@/components/icons";
import { SidebarHistory, getChatHistoryPaginationKey } from "@/components/sidebar-history";
import { SidebarUserNav } from "@/components/sidebar-user-nav";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  useSidebar,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { SidebarProjects } from "./sidebar-projects";
import { CreateProjectModal } from "./create-project-modal";
import { FolderIcon } from "lucide-react";

interface AppSidebarProps {
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email?: string;
    imageUrl: string;
  } | null;
}

export function AppSidebar({ user }: AppSidebarProps) {
  const router = useRouter();
  const { setOpenMobile } = useSidebar();
  const { mutate } = useSWRConfig();
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);
  const [activeTab, setActiveTab] = useState<"projects" | "chats">("projects");
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);

  const handleDeleteAll = () => {
    const endpoint = activeTab === "chats" ? "/api/history" : "/api/project/delete-all";
    
    const deletePromise = fetch(endpoint, {
      method: "DELETE",
    });

    toast.promise(deletePromise, {
      loading: `Deleting all ${activeTab}...`,
      success: () => {
        mutate(unstable_serialize(getChatHistoryPaginationKey));
        mutate("/api/project"); // Refresh projects list
        router.push("/");
        setShowDeleteAllDialog(false);
        return `All ${activeTab} deleted successfully`;
      },
      error: `Failed to delete all ${activeTab}`,
    });
  };

  const handleNewChat = () => {
    setOpenMobile(false);
    router.push("/");
    router.refresh();
  };

  const handleNewProject = () => {
    setShowCreateProjectModal(true);
  };

  return (
    <>
      <Sidebar className="group-data-[side=left]:border-r-0">
        <SidebarHeader>
          <SidebarMenu>
            <div className="flex flex-row items-center justify-between">
              <Link
                className="flex flex-row items-center gap-3"
                href="/"
                onClick={() => setOpenMobile(false)}
              >
                <span className="cursor-pointer rounded-md px-2 font-semibold text-lg hover:bg-muted">
                  Chatbot
                </span>
              </Link>
              <div className="flex flex-row gap-1">
                {user && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        className="h-8 p-1 md:h-fit md:p-2"
                        onClick={() => setShowDeleteAllDialog(true)}
                        type="button"
                        variant="ghost"
                      >
                        <TrashIcon />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent align="end" className="hidden md:block">
                      Delete All {activeTab === "projects" ? "Projects" : "Chats"}
                    </TooltipContent>
                  </Tooltip>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      className="h-8 p-1 md:h-fit md:p-2"
                      onClick={activeTab === "projects" ? handleNewProject : handleNewChat}
                      type="button"
                      variant="ghost"
                    >
                      <PlusIcon />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent align="end" className="hidden md:block">
                    New {activeTab === "projects" ? "Project" : "Chat"}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "projects" | "chats")} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="projects" className="flex items-center gap-2">
                <FolderIcon size={14} />
                <span>Projects</span>
              </TabsTrigger>
              <TabsTrigger value="chats">Chats</TabsTrigger>
            </TabsList>
            
            <TabsContent value="projects" className="mt-0">
              <SidebarProjects userId={user?.id} />
            </TabsContent>
            
            <TabsContent value="chats" className="mt-0">
              <SidebarHistory userId={user?.id} />
            </TabsContent>
          </Tabs>
        </SidebarContent>

        <SidebarFooter>
          <SidebarUserNav user={user} />
        </SidebarFooter>
      </Sidebar>

      <AlertDialog onOpenChange={setShowDeleteAllDialog} open={showDeleteAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete all {activeTab}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete all your
              {" "}{activeTab} and remove them from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAll}>
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CreateProjectModal
        open={showCreateProjectModal}
        onOpenChange={setShowCreateProjectModal}
      />
    </>
  );
}