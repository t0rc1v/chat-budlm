// components/file-share-dialog.tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, Mail, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FileShareDialogProps {
  fileId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shareEmail: string;
  setShareEmail: (email: string) => void;
}

export function FileShareDialog({
  fileId,
  open,
  onOpenChange,
  shareEmail,
  setShareEmail,
}: FileShareDialogProps) {
  const [permission, setPermission] = useState<"view" | "edit">("view");
  const [isSharing, setIsSharing] = useState(false);
  const [shareLink, setShareLink] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);

  const handleShare = async () => {
    if (!fileId || !shareEmail) {
      toast.error("Please enter an email address");
      return;
    }

    setIsSharing(true);
    try {
      const response = await fetch("/api/files/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileId,
          email: shareEmail,
          permission,
        }),
      });

      if (!response.ok) throw new Error();

      const data = await response.json();
      toast.success(`File shared with ${shareEmail}`);
      setShareEmail("");
      
      if (data.shareLink) {
        setShareLink(data.shareLink);
      }
    } catch (error) {
      toast.error("Failed to share file");
    } finally {
      setIsSharing(false);
    }
  };

  const handleGenerateLink = async () => {
    if (!fileId) return;

    try {
      const response = await fetch("/api/files/share-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId, permission }),
      });

      if (!response.ok) throw new Error();

      const data = await response.json();
      setShareLink(data.link);
      toast.success("Share link generated");
    } catch (error) {
      toast.error("Failed to generate share link");
    }
  };

  const handleCopyLink = () => {
    if (shareLink) {
      navigator.clipboard.writeText(shareLink);
      setLinkCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share File</DialogTitle>
          <DialogDescription>
            Share this file with other users or generate a shareable link
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Email sharing */}
          <div className="space-y-2">
            <Label htmlFor="email">Share with user</Label>
            <div className="flex gap-2">
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
              />
              <Select value={permission} onValueChange={(v: any) => setPermission(v)}>
                <SelectTrigger className="w-[110px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="view">View</SelectItem>
                  <SelectItem value="edit">Edit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleShare}
              disabled={isSharing || !shareEmail}
              className="w-full"
            >
              <Mail className="h-4 w-4 mr-2" />
              {isSharing ? "Sharing..." : "Share"}
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or generate link
              </span>
            </div>
          </div>

          {/* Link sharing */}
          <div className="space-y-2">
            {!shareLink ? (
              <Button
                variant="outline"
                onClick={handleGenerateLink}
                className="w-full"
              >
                Generate Share Link
              </Button>
            ) : (
              <div className="flex gap-2">
                <Input value={shareLink} readOnly className="flex-1" />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={handleCopyLink}
                >
                  {linkCopied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}