// components/sources-modal.tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { mutate } from "swr";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Source } from "@/lib/db/schema";
import { FileIcon, UploadIcon } from "./icons";
import { formatDistance } from "date-fns";

interface SourcesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  sources: Source[];
  selectedSources: string[];
  onSourcesChange: (sources: string[]) => void;
  isOwner: boolean;
  chatId?: string;
}

export function SourcesModal({
  open,
  onOpenChange,
  projectId,
  sources,
  selectedSources,
  onSourcesChange,
  isOwner,
  chatId,
}: SourcesModalProps) {
  const [localSelectedSources, setLocalSelectedSources] =
    useState<string[]>(selectedSources);
  const [selectAll, setSelectAll] = useState(false);

  const handleToggleSource = (sourceId: string) => {
    setLocalSelectedSources((prev) =>
      prev.includes(sourceId)
        ? prev.filter((id) => id !== sourceId)
        : [...prev, sourceId]
    );
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setLocalSelectedSources([]);
    } else {
      setLocalSelectedSources(sources.map((s) => s.id));
    }
    setSelectAll(!selectAll);
  };

  const handleSave = async () => {
    if (chatId) {
      // Update chat sources
      try {
        const response = await fetch("/api/chat/sources", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chatId,
            sources: localSelectedSources,
          }),
        });

        if (!response.ok) throw new Error("Failed to update sources");

        toast.success("Sources updated successfully");
        onSourcesChange(localSelectedSources);
        onOpenChange(false);
      } catch (error) {
        toast.error("Failed to update sources");
      }
    } else {
      // Just update local state for project view
      onSourcesChange(localSelectedSources);
      onOpenChange(false);
    }
  };

  const handleAddSource = () => {
    // TODO: Implement source upload functionality
    toast.info("Source upload functionality coming soon");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manage Sources</DialogTitle>
          <DialogDescription>
            Select sources to use in {chatId ? "this chat" : "your project"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Add Source Button */}
          {isOwner && (
            <Button
              variant="outline"
              className="w-full"
              onClick={handleAddSource}
            >
              <UploadIcon size={16} />
              Add Source
            </Button>
          )}

          {/* Sources List */}
          {sources.length > 0 ? (
            <>
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={selectAll}
                    onCheckedChange={handleSelectAll}
                  />
                  <span className="font-medium text-sm">Select All</span>
                </div>
                <span className="text-muted-foreground text-sm">
                  {localSelectedSources.length} of {sources.length} selected
                </span>
              </div>

              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {sources.map((source) => (
                    <div
                      key={source.id}
                      className="flex items-center gap-3 rounded-lg border p-3 hover:bg-accent"
                    >
                      <Checkbox
                        checked={localSelectedSources.includes(source.id)}
                        onCheckedChange={() => handleToggleSource(source.id)}
                      />
                      <FileIcon size={20} className="text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium text-sm">
                          {source.filename}
                        </p>
                        <div className="flex items-center gap-2 text-muted-foreground text-xs">
                          <span className="capitalize">{source.sourceType}</span>
                          <span>•</span>
                          <span>
                            {formatDistance(
                              new Date(source.createdAt),
                              new Date(),
                              { addSuffix: true }
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </>
          ) : (
            <div className="flex h-[200px] items-center justify-center rounded-lg border border-dashed">
              <div className="text-center text-muted-foreground">
                <FileIcon size={48} className="mx-auto mb-2 opacity-20" />
                <p className="font-medium">No sources yet</p>
                <p className="text-sm">Add sources to get started</p>
              </div>
            </div>
          )}

          {/* Actions */}
          {sources.length > 0 && (
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave}>Save</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}