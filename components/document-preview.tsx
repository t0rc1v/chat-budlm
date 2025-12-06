"use client";

import equal from "fast-deep-equal";
import {
  type MouseEvent,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import useSWR from "swr";
import { useArtifact } from "@/hooks/use-artifact";
import type { Document } from "@/lib/db/schema";
import { cn, fetcher } from "@/lib/utils";
import type { ArtifactKind, UIArtifact } from "./artifact";
import { CodeEditor } from "./code-editor";
import { DocumentToolCall, DocumentToolResult } from "./document";
import { InlineDocumentSkeleton } from "./document-skeleton";
import { FileIcon, FullscreenIcon, ImageIcon, LoaderIcon } from "./icons";
import { ImageEditor } from "./image-editor";
import { SpreadsheetEditor } from "./sheet-editor";
import { Editor } from "./text-editor";

type DocumentPreviewProps = {
  isReadonly: boolean;
  result?: any;
  args?: any;
};

export function DocumentPreview({
  isReadonly,
  result,
  args,
}: DocumentPreviewProps) {
  const { artifact, setArtifact } = useArtifact();

  const { data: documents, isLoading: isDocumentsFetching } = useSWR<
    Document[]
  >(result ? `/api/document?id=${result.id}` : null, fetcher);

  const previewDocument = useMemo(() => documents?.[0], [documents]);
  const hitboxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const boundingBox = hitboxRef.current?.getBoundingClientRect();

    if (artifact.documentId && boundingBox) {
      setArtifact((currentArtifact) => ({
        ...currentArtifact,
        boundingBox: {
          left: boundingBox.x,
          top: boundingBox.y,
          width: boundingBox.width,
          height: boundingBox.height,
        },
      }));
    }
  }, [artifact.documentId, setArtifact]);

  if (artifact.isVisible) {
    if (result) {
      return (
        <DocumentToolResult
          isReadonly={isReadonly}
          result={{ id: result.id, title: result.title, kind: result.kind }}
          type="create"
        />
      );
    }

    if (args) {
      return (
        <DocumentToolCall
          args={{ title: args.title, kind: args.kind }}
          isReadonly={isReadonly}
          type="create"
        />
      );
    }
  }

  if (isDocumentsFetching) {
    return <LoadingSkeleton artifactKind={result.kind ?? args.kind} />;
  }

  const document: Document | null = previewDocument
    ? previewDocument
    : artifact.status === "streaming"
      ? {
          title: artifact.title,
          kind: artifact.kind,
          content: artifact.content,
          id: artifact.documentId,
          createdAt: new Date(),
          userId: "noop",
        }
      : null;

  if (!document) {
    return <LoadingSkeleton artifactKind={artifact.kind} />;
  }

  return (
    <div className="relative w-full cursor-pointer">
      <HitboxLayer
        hitboxRef={hitboxRef}
        result={result}
        setArtifact={setArtifact}
      />
      <DocumentHeader
        isStreaming={artifact.status === "streaming"}
        kind={document.kind}
        title={document.title}
      />
      <DocumentContent document={document} />
    </div>
  );
}

const LoadingSkeleton = ({ artifactKind }: { artifactKind: ArtifactKind }) => (
  <div className="w-full">
    <div className="flex h-[57px] flex-row items-center justify-between gap-2 rounded-t-2xl border border-b-0 p-4 dark:border-zinc-700 dark:bg-muted">
      <div className="flex flex-row items-center gap-3">
        <div className="text-muted-foreground">
          <div className="size-4 animate-pulse rounded-md bg-muted-foreground/20" />
        </div>
        <div className="h-4 w-24 animate-pulse rounded-lg bg-muted-foreground/20" />
      </div>
      <div>
        <FullscreenIcon />
      </div>
    </div>
    {artifactKind === "image" ? (
      <div className="overflow-y-scroll rounded-b-2xl border border-t-0 bg-muted dark:border-zinc-700">
        <div className="h-[257px] w-full animate-pulse bg-muted-foreground/20" />
      </div>
    ) : (
      <div className="overflow-y-scroll rounded-b-2xl border border-t-0 bg-muted p-8 pt-4 dark:border-zinc-700">
        <InlineDocumentSkeleton />
      </div>
    )}
  </div>
);

const PureHitboxLayer = ({
  hitboxRef,
  result,
  setArtifact,
}: {
  hitboxRef: React.RefObject<HTMLDivElement | null>;
  result: any;
  setArtifact: (
    updaterFn: UIArtifact | ((currentArtifact: UIArtifact) => UIArtifact)
  ) => void;
}) => {
  const handleClick = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      const boundingBox = event.currentTarget.getBoundingClientRect();

      setArtifact((artifact) =>
        artifact.status === "streaming"
          ? { ...artifact, isVisible: true }
          : {
              ...artifact,
              title: result.title,
              documentId: result.id,
              kind: result.kind,
              isVisible: true,
              boundingBox: {
                left: boundingBox.x,
                top: boundingBox.y,
                width: boundingBox.width,
                height: boundingBox.height,
              },
            }
      );
    },
    [setArtifact, result]
  );

  return (
    <div
      aria-hidden="true"
      className="absolute top-0 left-0 z-10 size-full rounded-xl"
      onClick={handleClick}
      ref={hitboxRef}
      role="presentation"
    >
      <div className="flex w-full items-center justify-end p-4">
        <div className="absolute top-[13px] right-[9px] rounded-md p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700">
          <FullscreenIcon />
        </div>
      </div>
    </div>
  );
};

const HitboxLayer = memo(PureHitboxLayer, (prevProps, nextProps) => {
  if (!equal(prevProps.result, nextProps.result)) {
    return false;
  }
  return true;
});

const PureDocumentHeader = ({
  title,
  kind,
  isStreaming,
}: {
  title: string;
  kind: ArtifactKind;
  isStreaming: boolean;
}) => (
  <div className="flex flex-row items-start justify-between gap-2 rounded-t-2xl border border-b-0 p-4 sm:items-center dark:border-zinc-700 dark:bg-muted">
    <div className="flex flex-row items-start gap-3 sm:items-center">
      <div className="text-muted-foreground">
        {isStreaming ? (
          <div className="animate-spin">
            <LoaderIcon />
          </div>
        ) : kind === "image" ? (
          <ImageIcon />
        ) : (
          <FileIcon />
        )}
      </div>
      <div className="-translate-y-1 font-medium sm:translate-y-0">{title}</div>
    </div>
    <div className="w-8" />
  </div>
);

const DocumentHeader = memo(PureDocumentHeader, (prevProps, nextProps) => {
  if (prevProps.title !== nextProps.title) {
    return false;
  }
  if (prevProps.isStreaming !== nextProps.isStreaming) {
    return false;
  }

  return true;
});

const DocumentContent = ({ document }: { document: Document }) => {
  const { artifact } = useArtifact();

  const containerClassName = cn(
    "h-[257px] overflow-y-scroll rounded-b-2xl border border-t-0 dark:border-zinc-700 dark:bg-muted",
    {
      "p-4 sm:px-14 sm:py-16": document.kind === "text",
      "p-0": document.kind === "code",
      "p-4": ["quiz", "flashcard", "report", "slides"].includes(document.kind),
    }
  );

  const commonProps = {
    content: document.content ?? "",
    isCurrentVersion: true,
    currentVersionIndex: 0,
    status: artifact.status,
    saveContent: () => null,
    suggestions: [],
  };

  const handleSaveContent = () => null;

  // Parse content for preview rendering
  const parseContent = (content: string) => {
    try {
      return JSON.parse(content);
    } catch {
      return null;
    }
  };

  return (
    <div className={containerClassName}>
      {document.kind === "text" ? (
        <Editor {...commonProps} onSaveContent={handleSaveContent} />
      ) : document.kind === "code" ? (
        <div className="relative flex w-full flex-1">
          <div className="absolute inset-0">
            <CodeEditor {...commonProps} onSaveContent={handleSaveContent} />
          </div>
        </div>
      ) : document.kind === "sheet" ? (
        <div className="relative flex size-full flex-1 p-4">
          <div className="absolute inset-0">
            <SpreadsheetEditor {...commonProps} />
          </div>
        </div>
      ) : document.kind === "image" ? (
        <ImageEditor
          content={document.content ?? ""}
          currentVersionIndex={0}
          isCurrentVersion={true}
          isInline={true}
          status={artifact.status}
          title={document.title}
        />
      ) : document.kind === "quiz" ? (
        <QuizPreview content={parseContent(document.content ?? "")} />
      ) : document.kind === "flashcard" ? (
        <FlashcardPreview content={parseContent(document.content ?? "")} />
      ) : document.kind === "report" ? (
        <ReportPreview content={parseContent(document.content ?? "")} />
      ) : document.kind === "slides" ? (
        <SlidesPreview content={parseContent(document.content ?? "")} />
      ) : null}
    </div>
  );
};

// Quiz Preview Component
const QuizPreview = ({ content }: { content: any }) => {
  if (!content || !content.questions) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Loading quiz...
      </div>
    );
  }

  const questionCount = content.questions.length;
  const firstQuestion = content.questions[0];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">
          {questionCount} Question{questionCount !== 1 ? 's' : ''}
        </div>
        <div className="text-xs text-muted-foreground">
          {content.difficulty && `Difficulty: ${content.difficulty}`}
        </div>
      </div>
      
      {firstQuestion && (
        <div className="space-y-2 rounded-lg border p-3 bg-background/50">
          <div className="text-sm font-medium">Q1. {firstQuestion.question}</div>
          <div className="space-y-1">
            {firstQuestion.options?.slice(0, 2).map((option: string, idx: number) => (
              <div key={idx} className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="size-4 rounded-full border" />
                <span>{option}</span>
              </div>
            ))}
            {firstQuestion.options?.length > 2 && (
              <div className="text-xs text-muted-foreground">
                +{firstQuestion.options.length - 2} more options
              </div>
            )}
          </div>
        </div>
      )}
      
      {questionCount > 1 && (
        <div className="text-xs text-muted-foreground text-center">
          +{questionCount - 1} more question{questionCount > 2 ? 's' : ''}
        </div>
      )}
    </div>
  );
};

// Flashcard Preview Component
const FlashcardPreview = ({ content }: { content: any }) => {
  if (!content || !content.cards) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Loading flashcards...
      </div>
    );
  }

  const cardCount = content.cards.length;
  const firstCard = content.cards[0];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">
          {cardCount} Flashcard{cardCount !== 1 ? 's' : ''}
        </div>
      </div>
      
      {firstCard && (
        <div className="space-y-3">
          <div className="rounded-lg border p-4 bg-background/50">
            <div className="text-xs text-muted-foreground mb-2">Front</div>
            <div className="text-sm font-medium line-clamp-3">
              {firstCard.front}
            </div>
          </div>
          
          <div className="rounded-lg border p-4 bg-background/50">
            <div className="text-xs text-muted-foreground mb-2">Back</div>
            <div className="text-sm line-clamp-3 text-muted-foreground">
              {firstCard.back}
            </div>
          </div>
        </div>
      )}
      
      {cardCount > 1 && (
        <div className="text-xs text-muted-foreground text-center">
          +{cardCount - 1} more card{cardCount > 2 ? 's' : ''}
        </div>
      )}
    </div>
  );
};

// Report Preview Component
const ReportPreview = ({ content }: { content: any }) => {
  if (!content) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Loading report...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {content.title && (
        <div className="font-semibold text-base line-clamp-2">
          {content.title}
        </div>
      )}
      
      {content.executive_summary && (
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground">
            Executive Summary
          </div>
          <div className="text-sm line-clamp-4 text-muted-foreground">
            {content.executive_summary}
          </div>
        </div>
      )}
      
      {content.sections && content.sections.length > 0 && (
        <div className="space-y-2 pt-2 border-t">
          <div className="text-xs font-medium text-muted-foreground">
            Sections ({content.sections.length})
          </div>
          {content.sections.slice(0, 3).map((section: any, idx: number) => (
            <div key={idx} className="text-xs text-muted-foreground">
              • {section.heading || section.title}
            </div>
          ))}
          {content.sections.length > 3 && (
            <div className="text-xs text-muted-foreground">
              +{content.sections.length - 3} more sections
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Slides Preview Component
const SlidesPreview = ({ content }: { content: any }) => {
  if (!content || !content.slides) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Loading slides...
      </div>
    );
  }

  const slideCount = content.slides.length;
  const firstSlide = content.slides[0];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">
          {slideCount} Slide{slideCount !== 1 ? 's' : ''}
        </div>
        {content.theme && (
          <div className="text-xs text-muted-foreground">
            Theme: {content.theme}
          </div>
        )}
      </div>
      
      {firstSlide && (
        <div className="rounded-lg border p-4 bg-background/50 space-y-2">
          <div className="flex items-center gap-2">
            <div className="size-1.5 rounded-full bg-primary" />
            <div className="text-xs text-muted-foreground">Slide 1</div>
          </div>
          
          {firstSlide.title && (
            <div className="font-semibold text-sm line-clamp-2">
              {firstSlide.title}
            </div>
          )}
          
          {firstSlide.content && (
            <div className="text-xs text-muted-foreground line-clamp-3">
              {Array.isArray(firstSlide.content) 
                ? firstSlide.content.slice(0, 2).join(' • ')
                : firstSlide.content}
            </div>
          )}
        </div>
      )}
      
      {slideCount > 1 && (
        <div className="flex items-center justify-center gap-1">
          {Array.from({ length: Math.min(slideCount, 5) }).map((_, idx) => (
            <div
              key={idx}
              className={cn(
                "size-1.5 rounded-full",
                idx === 0 ? "bg-primary" : "bg-muted-foreground/30"
              )}
            />
          ))}
          {slideCount > 5 && (
            <div className="text-xs text-muted-foreground ml-1">
              +{slideCount - 5}
            </div>
          )}
        </div>
      )}
    </div>
  );
};