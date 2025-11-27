// artifacts/slides/client.tsx
import { useState } from "react";
import { toast } from "sonner";
import { Artifact } from "@/components/create-artifact";
import {
  CopyIcon,
  RedoIcon,
  UndoIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MaximizeIcon,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import Markdown from "react-markdown";

type Slide = {
  type: "title" | "content" | "image" | "two-column" | "quote";
  title?: string;
  subtitle?: string;
  content?: string;
  leftContent?: string;
  rightContent?: string;
  quote?: string;
  author?: string;
  imageUrl?: string;
  bulletPoints?: string[];
};

type SlidesData = {
  title: string;
  author?: string;
  date?: string;
  slides: Slide[];
};

type Metadata = {
  currentSlide: number;
  isFullscreen: boolean;
};

export const slidesArtifact = new Artifact<"slides", Metadata>({
  kind: "slides",
  description: "Interactive presentation slides",
  initialize: ({ setMetadata }) => {
    setMetadata({
      currentSlide: 0,
      isFullscreen: false,
    });
  },
  onStreamPart: ({ streamPart, setArtifact }) => {
    if (streamPart.type === "data-slidesDelta") {
      setArtifact((draftArtifact) => ({
        ...draftArtifact,
        content: streamPart.data,
        isVisible: true,
        status: "streaming",
      }));
    }
  },
  content: ({ content, status, metadata, setMetadata }) => {
    if (!content || status === "streaming") {
      return (
        <div className="flex h-[400px] items-center justify-center">
          <div className="text-center">
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-muted-foreground">Generating slides...</p>
          </div>
        </div>
      );
    }

    let slidesData: SlidesData;
    try {
      slidesData = JSON.parse(content);
    } catch {
      return (
        <div className="flex h-[400px] items-center justify-center">
          <p className="text-destructive">Error loading slides data</p>
        </div>
      );
    }

    const { currentSlide } = metadata;
    const slide = slidesData.slides[currentSlide];
    const totalSlides = slidesData.slides.length;

    const renderSlide = () => {
      switch (slide.type) {
        case "title":
          return (
            <div className="flex h-full flex-col items-center justify-center space-y-6 text-center">
              <h1 className="font-bold text-5xl">{slide.title}</h1>
              {slide.subtitle && (
                <p className="text-muted-foreground text-2xl">
                  {slide.subtitle}
                </p>
              )}
              {slidesData.author && (
                <div className="mt-8 space-y-1 text-muted-foreground">
                  <p>{slidesData.author}</p>
                  {slidesData.date && <p className="text-sm">{slidesData.date}</p>}
                </div>
              )}
            </div>
          );

        case "content":
          return (
            <div className="space-y-6">
              {slide.title && (
                <h2 className="border-b pb-4 font-bold text-3xl">
                  {slide.title}
                </h2>
              )}
              {slide.content && (
                <div className="prose prose-lg dark:prose-invert">
                    <Markdown>
                    {slide.content}
                    </Markdown>
                </div>
              )}
              {slide.bulletPoints && slide.bulletPoints.length > 0 && (
                <ul className="space-y-3 text-xl">
                  {slide.bulletPoints.map((point, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );

        case "two-column":
          return (
            <div className="space-y-6">
              {slide.title && (
                <h2 className="border-b pb-4 font-bold text-3xl">
                  {slide.title}
                </h2>
              )}
              <div className="grid grid-cols-2 gap-8">
                <div className="prose dark:prose-invert">
                  <Markdown>
                    {slide.leftContent || ""}
                  </Markdown>
                </div>
                <div className="prose dark:prose-invert">
                  <Markdown>
                    {slide.rightContent || ""}
                  </Markdown>
                </div>
              </div>
            </div>
          );

        case "quote":
          return (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <blockquote className="relative space-y-4 px-12">
                <span className="absolute top-0 left-0 font-serif text-8xl text-muted-foreground opacity-20">
                  "
                </span>
                <p className="relative font-serif text-3xl italic">
                  {slide.quote}
                </p>
                {slide.author && (
                  <footer className="text-muted-foreground text-xl">
                    — {slide.author}
                  </footer>
                )}
              </blockquote>
            </div>
          );

        case "image":
          return (
            <div className="space-y-6">
              {slide.title && (
                <h2 className="border-b pb-4 font-bold text-3xl">
                  {slide.title}
                </h2>
              )}
              {slide.imageUrl ? (
                <div className="flex items-center justify-center">
                  <img
                    src={slide.imageUrl}
                    alt={slide.title || "Slide image"}
                    className="max-h-[500px] rounded-lg object-contain"
                  />
                </div>
              ) : (
                <div className="flex h-[400px] items-center justify-center rounded-lg border-2 border-dashed">
                  <p className="text-muted-foreground">Image placeholder</p>
                </div>
              )}
              {slide.content && (
                <p className="text-center text-muted-foreground">
                  {slide.content}
                </p>
              )}
            </div>
          );

        default:
          return (
            <div className="flex h-full items-center justify-center">
              <p className="text-muted-foreground">Unknown slide type</p>
            </div>
          );
      }
    };

    return (
      <div className="flex h-full flex-col">
        {/* Slide Container */}
        <Card className="relative flex-1 overflow-hidden">
          <div className="flex h-full flex-col p-12">
            {renderSlide()}
          </div>

          {/* Slide Number */}
          <div className="absolute right-4 bottom-4 text-muted-foreground text-sm">
            {currentSlide + 1} / {totalSlides}
          </div>
        </Card>

        {/* Controls */}
        <div className="mt-4 flex items-center justify-between">
          <Button
            variant="outline"
            disabled={currentSlide === 0}
            onClick={() =>
              setMetadata({ ...metadata, currentSlide: currentSlide - 1 })
            }
          >
            <ChevronLeftIcon size={16} />
            Previous
          </Button>

          <div className="flex gap-1">
            {slidesData.slides.map((_, idx) => (
              <button
                key={idx}
                className={cn(
                  "h-2 w-2 rounded-full transition-colors",
                  idx === currentSlide ? "bg-primary" : "bg-muted"
                )}
                onClick={() =>
                  setMetadata({ ...metadata, currentSlide: idx })
                }
              />
            ))}
          </div>

          <Button
            variant="outline"
            disabled={currentSlide === totalSlides - 1}
            onClick={() =>
              setMetadata({ ...metadata, currentSlide: currentSlide + 1 })
            }
          >
            Next
            <ChevronRightIcon size={16} />
          </Button>
        </div>
      </div>
    );
  },
  actions: [
    {
      icon: <MaximizeIcon size={18} />,
      description: "Fullscreen mode",
      onClick: () => {
        toast.info("Fullscreen mode coming soon!");
      },
    },
    {
      icon: <UndoIcon size={18} />,
      description: "View Previous version",
      onClick: ({ handleVersionChange }) => {
        handleVersionChange("prev");
      },
      isDisabled: ({ currentVersionIndex }) => currentVersionIndex === 0,
    },
    {
      icon: <RedoIcon size={18} />,
      description: "View Next version",
      onClick: ({ handleVersionChange }) => {
        handleVersionChange("next");
      },
      isDisabled: ({ isCurrentVersion }) => isCurrentVersion,
    },
    {
      icon: <CopyIcon size={18} />,
      description: "Copy slides data",
      onClick: ({ content }) => {
        navigator.clipboard.writeText(content);
        toast.success("Slides data copied to clipboard!");
      },
    },
  ],
  toolbar: [],
});