// components/file-preview-dialog.tsx
"use client";

import { useState, useEffect } from "react";
import { Download, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ChatFile } from "@/lib/db/schema";

interface FilePreviewDialogProps {
  file: ChatFile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FilePreviewDialog({
  file,
  open,
  onOpenChange,
}: FilePreviewDialogProps) {
  const [previewContent, setPreviewContent] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!file || !open) return;

    const loadPreview = async () => {
      setIsLoading(true);
      try {
        // For text files, fetch and display content
        if (
          file.fileType.includes("text") ||
          file.fileType.includes("markdown") ||
          file.fileType.includes("csv")
        ) {
          const response = await fetch(file.fileUrl);
          const text = await response.text();
          setPreviewContent(text);
        }
        // For PDFs and other types, we'll show iframe or download option
      } catch (error) {
        console.error("Error loading preview:", error);
        setPreviewContent("Failed to load preview");
      } finally {
        setIsLoading(false);
      }
    };

    loadPreview();
  }, [file, open]);

  if (!file) return null;

  const isPDF = file.fileType === "application/pdf";
  const isText =
    file.fileType.includes("text") ||
    file.fileType.includes("markdown") ||
    file.fileType.includes("csv");
  const isDoc =
    file.fileType.includes("word") || file.fileType.includes("msword");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col overflow-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>{file.fileName}</DialogTitle>
              <DialogDescription>
                {(file.fileSize / 1024).toFixed(1)} KB •{" "}
                {new Date(file.createdAt).toLocaleDateString()}
              </DialogDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(file.fileUrl, "_blank")}
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>
        </DialogHeader>

        <Tabs defaultValue="preview" className="flex-1 flex flex-col">
          <TabsList>
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="metadata">Metadata</TabsTrigger>
            {file.embeddingStatus === "completed" && (
              <TabsTrigger value="chunks">Chunks</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="preview" className="flex-1 mt-4">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-muted-foreground">Loading preview...</div>
              </div>
            ) : isPDF ? (
              <iframe
                src={file.fileUrl}
                className="w-full h-full border rounded-lg"
                title={file.fileName}
              />
            ) : isText ? (
              <ScrollArea className="h-full border rounded-lg p-4">
                <pre className="text-sm whitespace-pre-wrap font-mono">
                  {previewContent}
                </pre>
              </ScrollArea>
            ) : isDoc ? (
              <div className="flex flex-col items-center justify-center h-full gap-4">
                <p className="text-muted-foreground">
                  Preview not available for this file type
                </p>
                <Button onClick={() => window.open(file.fileUrl, "_blank")}>
                  <Download className="h-4 w-4 mr-2" />
                  Download to View
                </Button>
              </div>
            ) : null}
          </TabsContent>

          <TabsContent value="metadata" className="flex-1 mt-4">
            <ScrollArea className="h-full">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      File Name
                    </p>
                    <p className="text-sm">{file.fileName}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      File Size
                    </p>
                    <p className="text-sm">
                      {(file.fileSize / 1024).toFixed(2)} KB
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      File Type
                    </p>
                    <p className="text-sm">{file.fileType}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Uploaded
                    </p>
                    <p className="text-sm">
                      {new Date(file.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Embedding Status
                    </p>
                    <p className="text-sm capitalize">{file.embeddingStatus}</p>
                  </div>
                  {file.metadata?.pageCount && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Pages
                      </p>
                      <p className="text-sm">{file.metadata.pageCount}</p>
                    </div>
                  )}
                  {file.metadata?.isScanned && (
                    <div className="col-span-2">
                      <p className="text-sm font-medium text-muted-foreground">
                        Document Type
                      </p>
                      <p className="text-sm">
                        Scanned Document (OCR Processed)
                      </p>
                    </div>
                  )}
                </div>

                {file.chromaCollectionId && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Collection ID
                    </p>
                    <p className="text-xs font-mono break-all">
                      {file.chromaCollectionId}
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {file.embeddingStatus === "completed" && (
            <TabsContent value="chunks" className="flex-1 mt-4">
              <ChunksViewer fileId={file.id} projectId={file.projectId || file.chatId} />
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// Component to view document chunks
function ChunksViewer({
  fileId,
  projectId,
}: {
  fileId: string;
  projectId: string | null;
}) {
  const [chunks, setChunks] = useState<
    Array<{ text: string; index: number; metadata: any }>
  >([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadChunks = async () => {
      if (!projectId) return;

      try {
        const response = await fetch(
          `/api/files/chunks?fileId=${fileId}&projectId=${projectId}`
        );
        if (response.ok) {
          const data = await response.json();
          setChunks(data.chunks || []);
        }
      } catch (error) {
        console.error("Error loading chunks:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadChunks();
  }, [fileId, projectId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading chunks...</div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4">
        {chunks.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            No chunks available
          </p>
        ) : (
          chunks.map((chunk, index) => (
            <div key={index} className="border rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Chunk {chunk.index + 1} of {chunks.length}
                </span>
                <span className="text-xs text-muted-foreground">
                  {chunk.text.length} characters
                </span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{chunk.text}</p>
            </div>
          ))
        )}
      </div>
    </ScrollArea>
  );
}