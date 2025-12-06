// components/image-generation-result.tsx
"use client";

import { memo, useState } from "react";
import { toast } from "sonner";
import { useArtifact } from "@/hooks/use-artifact";
import { DownloadIcon, LoaderIcon } from "./icons";
import { Button } from "./ui/button";
import Image from "next/image";

type ImageGenerationResultProps = {
  type: "generate";
  result?: { id: string; title: string; kind: "image"; imageData?: string };
  args?: { prompt: string; aspectRatio?: string };
  isReadonly: boolean;
};

function PureImageGenerationResult({
  type,
  result,
  args,
  isReadonly,
}: ImageGenerationResultProps) {
  const { setArtifact } = useArtifact();
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    if (!result?.imageData) return;
    
    setIsDownloading(true);
    try {
      // Convert base64 to blob
      const byteCharacters = atob(result.imageData);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "image/png" });
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `generated-image-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success("Image downloaded!");
    } catch (error) {
      console.error("Error downloading image:", error);
      toast.error("Failed to download image");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleViewFullSize = () => {
    if (isReadonly) {
      toast.error("Viewing images in shared chats is currently not supported.");
      return;
    }

    if (!result) return;

    setArtifact((currentArtifact) => ({
      documentId: result.id,
      kind: "image",
      content: result.imageData || "",
      title: result.title,
      isVisible: true,
      status: "idle",
      boundingBox: {
        top: 0,
        left: 0,
        width: 0,
        height: 0,
      },
    }));
  };

  // Show loading state
  if (!result && args) {
    return (
      <div className="flex w-fit flex-row items-center gap-3 rounded-xl border bg-background px-3 py-2">
        <div className="animate-spin text-zinc-500">
          <LoaderIcon />
        </div>
        <div>
          <div className="font-medium">Generating image...</div>
          <div className="text-muted-foreground text-sm max-w-md truncate">
            {args.prompt}
          </div>
        </div>
      </div>
    );
  }

  // Show result
  if (result) {
    return (
      <div className="flex flex-col gap-2 rounded-xl border bg-background p-3 w-full max-w-md">
        <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-muted">
          {result.imageData ? (
            <Image
              src={`data:image/png;base64,${result.imageData}`}
              alt={result.title}
              fill
              className="object-cover cursor-pointer hover:opacity-90 transition-opacity"
              onClick={handleViewFullSize}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              No image data
            </div>
          )}
        </div>
        
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm">{result.title}</div>
            <div className="text-muted-foreground text-xs truncate">
              Click image to view full size
            </div>
          </div>
          
          {result.imageData && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleDownload}
              disabled={isDownloading}
            >
              {isDownloading ? (
                <div className="animate-spin">
                  <LoaderIcon size={16} />
                </div>
              ) : (
                <DownloadIcon size={16} />
              )}
            </Button>
          )}
        </div>
      </div>
    );
  }

  return null;
}

export const ImageGenerationResult = memo(PureImageGenerationResult, () => true);