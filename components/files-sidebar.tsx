// components/files-sidebar.tsx
"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import useSWR, { useSWRConfig } from "swr";
import { toast } from "sonner";
import {
  Trash2,
  Upload,
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
  Eye,
  MoreVertical,
  Share2,
  Download,
  CheckCheck,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { fetcher, generateUUID } from "@/lib/utils";
import type { ChatFile } from "@/lib/db/schema";
import { FilePreviewDialog } from "./file-preview-dialog";
import { FileShareDialog } from "./file-share-dialog";
import { UploadButton } from "@/lib/uploadthing";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "./ui/sheet";
import { useSourceStore } from "@/lib/stores/use-source-store";

interface FilesSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatId?: string;
  projectId?: string | null;
}

interface UploadingFile {
  id: string;
  name: string;
  progress: number;
  status: "uploading" | "processing" | "complete" | "error";
}

export function FilesSidebar({
  open,
  onOpenChange,
  chatId,
  projectId,
}: FilesSidebarProps) {
  const { mutate } = useSWRConfig();
  const [uploadingFiles, setUploadingFiles] = useState<Map<string, UploadingFile>>(
    new Map()
  );

  // Fetch chat status from API
  const { data: chatStatus } = useSWR<{ isNewChat: boolean; chatExists: boolean }>(
    chatId ? `/api/chat/status?chatId=${chatId}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  const isNewChat = chatStatus?.isNewChat ?? true;

  // Use Zustand store for new chat selections
  const {
    selectedFileIds,
    toggleFile,
    selectAll: selectAllStore,
    deselectAll: deselectAllStore,
    isFileSelected: isFileSelectedStore,
    selectMultiple,
    getSelectedCount,
  } = useSourceStore();

  console.log("selectedFileIds", selectedFileIds)

  // Preview and share state
  const [previewFile, setPreviewFile] = useState<ChatFile | null>(null);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareFileId, setShareFileId] = useState<string | null>(null);
  const [shareEmail, setShareEmail] = useState("");

  // Batch operations state
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [batchSelectedFiles, setBatchSelectedFiles] = useState<string[]>([]);

  // Delete confirmation state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<{ id: string; name: string } | null>(null);

  // Fetch files - with dynamic polling based on processing files
  const { data: files, mutate: mutateFiles } = useSWR<ChatFile[]>(
    chatId || projectId
      ? `/api/files?${projectId ? `projectId=${projectId}` : `chatId=${chatId}`}`
      : null,
    fetcher,
    {
      // Poll while files are uploading OR while any files are still processing
      refreshInterval: (data) => {
        const hasUploadingFiles = uploadingFiles.size > 0;
        const hasProcessingFiles = data?.some(
          (file) => file.embeddingStatus === "pending" || file.embeddingStatus === "processing"
        );
        return hasUploadingFiles || hasProcessingFiles ? 2000 : 0; // Poll every 2 seconds
      },
    }
  );

  // Fetch file selections for existing chats
  const { data: selections, mutate: mutateSelections } = useSWR(
    chatId && !isNewChat ? `/api/files/selection?chatId=${chatId}` : null,
    fetcher
  );

  useEffect(() => {
    const syncSelectionsToAPI = async () => {
      // Only sync when transitioning from new chat to existing chat
      if (!isNewChat && chatId && selectedFileIds.length > 0) {
        try {
          // Send all selected files to the API
          const promises = selectedFileIds.map((fileId) =>
            fetch("/api/files/selection", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chatId, fileId }),
            })
          );
          
          await Promise.all(promises);
          mutateSelections();
          
          // Clear Zustand store after successful sync
          deselectAllStore();
        } catch (error) {
          console.error("Failed to sync selections:", error);
          toast.error("Failed to sync file selections");
        }
      }
    };

    syncSelectionsToAPI();
  }, [isNewChat, chatId, selectedFileIds, mutateSelections, deselectAllStore]);

  const handleDelete = async (fileId: string) => {
    try {
      await fetch(`/api/files?id=${fileId}&projectId=${projectId || chatId}`, {
        method: "DELETE",
      });
      toast.success("File deleted");
      mutateFiles();
      setDeleteDialogOpen(false);
      setFileToDelete(null);
    } catch (error) {
      toast.error("Failed to delete file");
    }
  };

  const confirmDelete = (file: ChatFile) => {
    setFileToDelete({ id: file.id, name: file.fileName });
    setDeleteDialogOpen(true);
  };

  const handleToggleSelection = async (fileId: string) => {
    // For new chats, use Zustand store
    if (isNewChat) {
      toggleFile(fileId);
      return;
    }

    // For existing chats, use API
    if (!chatId) return;

    try {
      await fetch("/api/files/selection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, fileId }),
      });
      mutateSelections();
    } catch (error) {
      toast.error("Failed to toggle file selection");
    }
  };

  const isFileSelected = (fileId: string) => {
    // For new chats, check Zustand store
    if (isNewChat) {
      return isFileSelectedStore(fileId);
    }

    // For existing chats, check API data
    if (!selections) return false;
    const selection = selections.find((s: any) => s.fileId === fileId);
    return selection?.isSelected ?? false;
  };

  // Get completed files that can be selected
  const completedFiles = useMemo(() => {
    return files?.filter((f) => f.embeddingStatus === "completed") || [];
  }, [files]);

  // Check if all completed files are selected
  const allCompletedSelected = useMemo(() => {
    if (completedFiles.length === 0) return false;

    if (isNewChat) {
      return completedFiles.every((f) => isFileSelectedStore(f.id));
    }

    if (!selections) return false;
    return completedFiles.every((f) => {
      const selection = selections.find((s: any) => s.fileId === f.id);
      return selection?.isSelected ?? false;
    });
  }, [completedFiles, isNewChat, isFileSelectedStore, selections]);

  // Toggle select all for context
  const handleToggleSelectAll = async () => {
    if (isNewChat) {
      // For new chats, use Zustand store
      if (allCompletedSelected) {
        deselectAllStore();
      } else {
        selectAllStore(completedFiles.map((f) => f.id));
      }
      return;
    }

    // For existing chats, use API
    if (!chatId) return;

    try {
      const promises = completedFiles.map((file) =>
        fetch("/api/files/selection", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chatId, fileId: file.id }),
        })
      );

      await Promise.all(promises);
      mutateSelections();
      toast.success(
        allCompletedSelected
          ? "Deselected all files"
          : "Selected all files for context"
      );
    } catch (error) {
      toast.error("Failed to update selections");
    }
  };

  // Batch operations
  const handleBatchDelete = async () => {
    if (batchSelectedFiles.length === 0) return;

    try {
      await Promise.all(
        batchSelectedFiles.map((fileId) =>
          fetch(`/api/files?id=${fileId}&projectId=${projectId || chatId}`, {
            method: "DELETE",
          })
        )
      );
      toast.success(`Deleted ${batchSelectedFiles.length} files`);
      setBatchSelectedFiles([]);
      setIsBatchMode(false);
      mutateFiles();
    } catch (error) {
      toast.error("Failed to delete files");
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
      case "processing":
        return <Loader2 className="h-3 w-3 animate-spin text-blue-500" />;
      case "completed":
        return <CheckCircle2 className="h-3 w-3 text-green-500" />;
      case "failed":
        return <XCircle className="h-3 w-3 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "pending":
        return "Pending";
      case "processing":
        return "Processing";
      case "completed":
        return "Ready";
      case "failed":
        return "Failed";
      default:
        return "";
    }
  };

  const getUploadStatusText = (status: UploadingFile["status"]) => {
    switch (status) {
      case "uploading":
        return "Uploading...";
      case "processing":
        return "Processing...";
      case "complete":
        return "Complete";
      case "error":
        return "Failed";
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-80 p-0 sm:w-96">

        <SheetHeader className="border-b px-4 py-3">
          <SheetTitle className="font-semibold text-lg">Files</SheetTitle>
          <p className="text-muted-foreground text-sm">
            Upload and manage files for context
          </p>
        </SheetHeader>

        <div className="px-4 py-3 space-y-4">
          {/* Upload Area */}
          <UploadButton
            endpoint="documentUploader"
            input={{ projectId, chatId }}
            onBeforeUploadBegin={(files) => {
              // Filter out images
              const nonImages = files.filter(
                (file) => !file.type.startsWith("image/")
              );
              
              if (nonImages.length !== files.length) {
                toast.error("Image uploads blocked on sources tab, attach in Chat input");
                throw new Error("Image uploads blocked on sources tab, attach in Chat input");
              }
              
              // Add files to uploading state
              nonImages.forEach((file) => {
                const id = generateUUID();
                setUploadingFiles((prev) =>
                  new Map(prev).set(id, {
                    id,
                    name: file.name,
                    progress: 0,
                    status: "uploading",
                  })
                );
              });

              return nonImages;
            }}
            onUploadProgress={(progress) => {
              // Update progress for all uploading files
              setUploadingFiles((prev) => {
                const next = new Map(prev);
                next.forEach((file) => {
                  if (file.status === "uploading") {
                    next.set(file.id, { ...file, progress });
                  }
                });
                return next;
              });
            }}
            onUploadBegin={(name) => {
              toast.info(`Uploading ${name}`);
            }}
            onUploadError={(error: Error) => {
              toast.error(`Upload failed! ${error.message}`);
              // Mark all uploading files as error
              setUploadingFiles((prev) => {
                const next = new Map(prev);
                next.forEach((file) => {
                  if (file.status === "uploading") {
                    next.set(file.id, { ...file, status: "error" });
                  }
                });
                return next;
              });
              
              // Clear error files after 3 seconds
              setTimeout(() => {
                setUploadingFiles((prev) => {
                  const next = new Map(prev);
                  Array.from(next.entries()).forEach(([id, file]) => {
                    if (file.status === "error") {
                      next.delete(id);
                    }
                  });
                  return next;
                });
              }, 3000);
            }}
            onClientUploadComplete={(res) => {
              // Mark files as processing
              setUploadingFiles((prev) => {
                const next = new Map(prev);
                next.forEach((file) => {
                  if (file.status === "uploading") {
                    next.set(file.id, { ...file, status: "processing", progress: 100 });
                  }
                });
                return next;
              });

              // Start polling for file status
              mutateFiles();
              
              // Auto-select newly uploaded files for new chats using Zustand
              if (isNewChat && res) {
                const newFileIds = res.map((file) => file.key);
                selectMultiple(newFileIds);
              }

              toast.success(`${res.length} file(s) uploaded successfully`);
              
              // Clear uploading files after a short delay
              setTimeout(() => {
                setUploadingFiles(new Map());
              }, 2000);
            }}
            appearance={{
              button:
              "ut-ready:bg-primary dark:ut-ready:bg-secondary ut-readying:bg-muted-foreground ut-uploading:bg-muted-foreground ut-uploading:cursor-not-allowed rounded-md bg-primary dark:bg-secondary text-primary-foreground px-4 py-2 text-sm hover:opacity-90 transition-opacity",
              container: "w-full",
              allowedContent: "hidden",
            }}
            className="w-full"
            />

          {/* Batch Mode Toggle */}
          {files && files.length > 0 && (
            <div className="flex items-center gap-2">
              <Button
                variant={isBatchMode ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setIsBatchMode(!isBatchMode);
                  setBatchSelectedFiles([]);
                }}
                className="h-8 text-xs"
              >
                {isBatchMode ? "Exit Batch Mode" : "Batch Mode"}
              </Button>
              {isBatchMode && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const allFileIds = files.map((f) => f.id);
                      setBatchSelectedFiles(
                        batchSelectedFiles.length === files.length
                          ? []
                          : allFileIds
                        );
                      }}
                      className="h-8 text-xs"
                      >
                    {batchSelectedFiles.length === files.length
                      ? "Deselect All"
                      : "Select All"}
                  </Button>
                  {batchSelectedFiles.length > 0 && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleBatchDelete}
                      className="h-8 text-xs"
                    >
                      Delete ({batchSelectedFiles.length})
                    </Button>
                  )}
                </>
              )}
            </div>
          )}

          <Separator />

          {/* Upload Progress */}
          {uploadingFiles.size > 0 && (
            <div className="space-y-2">
              {Array.from(uploadingFiles.entries()).map(([id, file]) => (
                <div
                  key={id}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-muted/50"
                >
                  {file.status === "error" ? (
                    <XCircle className="h-4 w-4 text-red-500" />
                  ) : file.status === "complete" ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-muted-foreground">
                        {getUploadStatusText(file.status)}
                      </p>
                      {file.status === "uploading" && (
                        <span className="text-xs text-muted-foreground">
                          {file.progress}%
                        </span>
                      )}
                    </div>
                    {file.status === "uploading" && (
                      <div className="mt-1 w-full bg-muted rounded-full h-1.5">
                        <div
                          className="bg-primary h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${file.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {completedFiles.length > 0 && !isBatchMode && (
            <Button
            variant="ghost"
            size="sm"
            onClick={handleToggleSelectAll}
            className="h-8 text-xs"
            >
              {allCompletedSelected ? (
                <>
                  <X className="h-3 w-3 mr-1" />
                  Deselect All
                </>
              ) : (
                <>
                  <CheckCheck className="h-3 w-3 mr-1" />
                  Select All
                </>
              )}
            </Button>
          )}

          {/* Files List */}
          <ScrollArea className="h-[calc(100vh-400px)]">
            <div className="space-y-2">
              {files?.length === 0 && uploadingFiles.size === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground/50 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    No files yet
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Upload files to use as context
                  </p>
                </div>
              )}

              {files?.map((file) => (
                <div
                key={file.id}
                className={`
                  group w-full grid grid-cols-[auto_1fr] items-center gap-2 p-2 font-mono text-sm cursor-pointer border bg-card hover:bg-accent/50 transition-all duration-200 rounded-lg 
                  ${isBatchMode && batchSelectedFiles.includes(file.id) ? "ring-2 ring-primary" : ""}
                  `}
                  onClick={() => {
                    if (isBatchMode) {
                      setBatchSelectedFiles((prev) =>
                        prev.includes(file.id)
                          ? prev.filter((id) => id !== file.id)
                          : [...prev, file.id]
                        );
                      }
                  }}
                >
                  {/* Selection Checkbox */}
                  {isBatchMode ? (
                    <Checkbox
                    checked={batchSelectedFiles.includes(file.id)}
                    onCheckedChange={(checked) => {
                      setBatchSelectedFiles((prev) =>
                          checked
                            ? [...prev, file.id]
                            : prev.filter((id) => id !== file.id)
                          );
                      }}
                      />
                  ) : (
                    (chatId || isNewChat) && (
                      <Checkbox
                        checked={isFileSelected(file.id)}
                        onCheckedChange={() => handleToggleSelection(file.id)}
                        onClick={(e) => e.stopPropagation()}
                        disabled={file.embeddingStatus !== "completed"}
                        />
                      )
                  )}

                  <div className="flex-1 min-w-0 flex items-center group">                      
                    {/* File Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {file.fileName}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">
                          {(file.fileSize / 1024).toFixed(1)} KB
                        </span>
                        {file.metadata?.pageCount && (
                          <>
                            <span className="text-[10px] text-muted-foreground">•</span>
                            <span className="text-[10px] text-muted-foreground">
                              {file.metadata.pageCount} pages
                            </span>
                          </>
                        )}
                        {file.metadata?.isScanned && (
                          <>
                            <span className="text-xs text-muted-foreground">•</span>
                            <span className="text-xs text-amber-600 font-medium">
                              OCR
                            </span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        {getStatusIcon(file.embeddingStatus)}
                        <span className="text-xs text-muted-foreground">
                          {getStatusText(file.embeddingStatus)}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    {!isBatchMode && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewFile(file);
                              }}
                              >
                              <Eye className="h-4 w-4 mr-2" />
                              view
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setShareFileId(file.id);
                                setShowShareDialog(true);
                              }}
                            >
                              <Share2 className="h-4 w-4 mr-2" />
                              Share
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => window.open(file.fileUrl, "_blank")}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Download
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                confirmDelete(file);
                              }}
                              >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                  </div>

                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        <SheetFooter className="border-t px-4 py-3">
          <div className="text-xs text-muted-foreground space-y-1">
            <div className="flex items-center justify-between">
              <span>Total files:</span>
              <span className="font-medium">{files?.length || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Selected:</span>
              <span className="font-medium text-primary">
                {isNewChat
                  ? getSelectedCount()
                  : selections?.filter((s: any) => s.isSelected).length || 0}
              </span>
            </div>
            {completedFiles.length > 0 && (
              <div className="flex items-center justify-between">
                <span>Ready:</span>
                <span className="font-medium text-green-600">
                  {completedFiles.length}
                </span>
              </div>
            )}
          </div>
        </SheetFooter>
      </SheetContent>
      </Sheet>

      {/* File Preview Dialog */}
      <FilePreviewDialog
        file={previewFile}
        open={!!previewFile}
        onOpenChange={(open) => !open && setPreviewFile(null)}
        />

      {/* Share Dialog */}
      <FileShareDialog
        fileId={shareFileId}
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
        shareEmail={shareEmail}
        setShareEmail={setShareEmail}
        />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete File?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-semibold">{fileToDelete?.name}</span>? 
              This action cannot be undone and will remove the file from all chats.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setFileToDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => fileToDelete && handleDelete(fileToDelete.id)}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}