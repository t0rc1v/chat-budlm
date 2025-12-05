// components/tools-dropdown.tsx
"use client";

import { memo, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Settings2,
  CheckCircle2,
  Sparkles,
  BookOpen,
  FileText,
  Briefcase,
  Zap,
  FileSpreadsheet,
  ImageIcon,
} from "lucide-react";
import { useToolsStore, type WritingStyle } from "@/lib/stores/use-tools-store";
import { cn } from "@/lib/utils";

const writingStyleConfig: Record<
  WritingStyle,
  { label: string; icon: React.ReactNode; description: string }
> = {
  normal: {
    label: "Normal",
    icon: <FileText className="h-4 w-4" />,
    description: "Conversational and clear",
  },
  learning: {
    label: "Learning",
    icon: <BookOpen className="h-4 w-4" />,
    description: "Educational and detailed",
  },
  formal: {
    label: "Formal",
    icon: <Briefcase className="h-4 w-4" />,
    description: "Professional and precise",
  },
  concise: {
    label: "Concise",
    icon: <Zap className="h-4 w-4" />,
    description: "Brief and direct",
  },
  explanatory: {
    label: "Explanatory",
    icon: <FileSpreadsheet className="h-4 w-4" />,
    description: "Comprehensive and thorough",
  },
};

function PureToolsDropdown() {
  const [open, setOpen] = useState(false);
  const {
    guidedLearningEnabled,
    toggleGuidedLearning,
    writingStyle,
    setWritingStyle,
    imageGenerationEnabled,
    toggleImageGeneration,
  } = useToolsStore();

  const currentWritingStyleConfig = writingStyleConfig[writingStyle];
  
  // Count active tools
  const activeToolsCount = [
    guidedLearningEnabled,
    writingStyle !== 'normal',
    imageGenerationEnabled,
  ].filter(Boolean).length;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "h-8 px-2 relative",
            activeToolsCount > 0 && "text-primary"
          )}
        >
          <Settings2 className="h-4 w-4" />
          <span className="hidden font-medium text-xs sm:block ml-1">Tools</span>
          {activeToolsCount > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center">
              {activeToolsCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-[280px]">
        <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
          AI Tools & Settings
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Guided Learning */}
        <DropdownMenuItem
          className="flex items-center justify-between cursor-pointer"
          onSelect={(e) => {
            e.preventDefault();
            toggleGuidedLearning();
          }}
        >
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            <div className="flex flex-col">
              <span className="text-sm font-medium">Guided Learning</span>
              <span className="text-xs text-muted-foreground">
                Socratic method teaching
              </span>
            </div>
          </div>
          <Switch
            checked={guidedLearningEnabled}
            onCheckedChange={toggleGuidedLearning}
            onClick={(e) => e.stopPropagation()}
          />
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Writing Style */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="cursor-pointer">
            <div className="flex items-center gap-2">
              {currentWritingStyleConfig.icon}
              <div className="flex flex-col">
                <span className="text-sm font-medium">Writing Style</span>
                <span className="text-xs text-muted-foreground">
                  {currentWritingStyleConfig.label}
                </span>
              </div>
            </div>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-60">
            {(Object.entries(writingStyleConfig) as [WritingStyle, typeof writingStyleConfig[WritingStyle]][]).map(
              ([style, config]) => (
                <DropdownMenuItem
                  key={style}
                  className="flex items-center justify-between cursor-pointer"
                  onSelect={() => {
                    setWritingStyle(style);
                  }}
                >
                  <div className="flex items-center gap-2">
                    {config.icon}
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{config.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {config.description}
                      </span>
                    </div>
                  </div>
                  {writingStyle === style && (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  )}
                </DropdownMenuItem>
              )
            )}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        {/* Image Generation */}
        <DropdownMenuItem
          className="flex items-center justify-between cursor-pointer"
          onSelect={(e) => {
            e.preventDefault();
            toggleImageGeneration();
          }}
        >
          <div className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4" />
            <div className="flex flex-col">
              <span className="text-sm font-medium">Image Generation</span>
              <span className="text-xs text-muted-foreground">
                Create images with AI
              </span>
            </div>
          </div>
          <Switch
            checked={imageGenerationEnabled}
            onCheckedChange={toggleImageGeneration}
            onClick={(e) => e.stopPropagation()}
          />
        </DropdownMenuItem>

        {activeToolsCount > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-xs text-muted-foreground justify-center"
              disabled
            >
              {activeToolsCount} tool{activeToolsCount > 1 ? 's' : ''} active
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export const ToolsDropdown = memo(PureToolsDropdown);