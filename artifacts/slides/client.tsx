import { useState } from "react";
import { toast } from "sonner";
import { Artifact } from "@/components/create-artifact";
import { 
  CopyIcon, 
  RedoIcon, 
  UndoIcon, 
  ChevronLeftIcon, 
  ChevronRightIcon,
  PresentationIcon 
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Slide = {
  title: string;
  content: string[];
  notes?: string;
};

type SlidesData = {
  title: string;
  subtitle?: string;
  slides: Slide[];
};

type SlidesEditorProps = {
  content: string;
  isCurrentVersion: boolean;
  currentVersionIndex: number;
  status: string;
};

function SlidesEditor({ content, status }: SlidesEditorProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showNotes, setShowNotes] = useState(false);

  if (status === "streaming" || !content) {
    return (
      <div className="flex h-full w-full items-center justify-center p-8">
        <div className="text-muted-foreground">Generating slides...</div>
      </div>
    );
  }

  let slidesData: SlidesData;
  try {
    slidesData = JSON.parse(content);
  } catch {
    return (
      <div className="flex h-full w-full items-center justify-center p-8">
        <div className="text-red-500">Invalid slides format</div>
      </div>
    );
  }

  const handleNext = () => {
    if (currentSlide < slidesData.slides.length) {
      setCurrentSlide((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentSlide > 0) {
      setCurrentSlide((prev) => prev - 1);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") handleNext();
    if (e.key === "ArrowLeft") handlePrev();
    if (e.key === "n" || e.key === "N") setShowNotes(!showNotes);
  };

  // Title slide
  if (currentSlide === 0) {
    return (
      <div
        className="flex h-full min-h-[600px] w-full flex-col"
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        <div className="flex flex-1 items-center justify-center bg-linear-to-br from-primary to-primary/70 p-12 text-primary-foreground">
          <div className="text-center">
            <h1 className="mb-4 font-bold text-5xl md:text-6xl">{slidesData.title}</h1>
            {slidesData.subtitle && (
              <p className="text-2xl opacity-90">{slidesData.subtitle}</p>
            )}
          </div>
        </div>
        <SlideControls
          currentSlide={currentSlide}
          totalSlides={slidesData.slides.length + 1}
          onNext={handleNext}
          onPrev={handlePrev}
          onSlideSelect={setCurrentSlide}
          showNotes={showNotes}
          onToggleNotes={() => setShowNotes(!showNotes)}
        />
      </div>
    );
  }

  const slide = slidesData.slides[currentSlide - 1];

  return (
    <div
      className="flex h-full min-h-[600px] w-full flex-col"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div className="flex flex-1 flex-col justify-center bg-background p-12">
        <div className="mx-auto w-full max-w-4xl">
          <h2 className="mb-8 border-b-4 border-primary pb-4 font-bold text-4xl">
            {slide.title}
          </h2>
          <ul className="space-y-4">
            {slide.content.map((point, index) => (
              <li key={index} className="flex items-start text-xl">
                <span className="mr-4 mt-1 size-3 shrink-0 rounded-full bg-primary" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {showNotes && slide.notes && (
        <div className="border-t bg-muted p-6">
          <p className="font-semibold text-sm">Speaker Notes:</p>
          <p className="mt-2 text-muted-foreground text-sm">{slide.notes}</p>
        </div>
      )}

      <SlideControls
        currentSlide={currentSlide}
        totalSlides={slidesData.slides.length + 1}
        onNext={handleNext}
        onPrev={handlePrev}
        onSlideSelect={setCurrentSlide}
        showNotes={showNotes}
        onToggleNotes={() => setShowNotes(!showNotes)}
      />
    </div>
  );
}

function SlideControls({
  currentSlide,
  totalSlides,
  onNext,
  onPrev,
  onSlideSelect,
  showNotes,
  onToggleNotes,
}: {
  currentSlide: number;
  totalSlides: number;
  onNext: () => void;
  onPrev: () => void;
  onSlideSelect: (slide: number) => void;
  showNotes: boolean;
  onToggleNotes: () => void;
}) {
  return (
    <div className="flex items-center justify-between border-t bg-background p-4">
      <Button onClick={onPrev} variant="outline" size="sm" disabled={currentSlide === 0}>
        <ChevronLeftIcon />
        Previous
      </Button>

      <div className="flex items-center gap-4">
        <span className="text-muted-foreground text-sm">
          {currentSlide + 1} / {totalSlides}
        </span>

        <div className="flex gap-1">
          {Array.from({ length: totalSlides }).map((_, index) => (
            <button
              key={index}
              onClick={() => onSlideSelect(index)}
              className={cn(
                "size-2 rounded-full transition-all",
                index === currentSlide
                  ? "w-6 bg-primary"
                  : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
              )}
            />
          ))}
        </div>

        <Button onClick={onToggleNotes} variant="ghost" size="sm">
          <PresentationIcon size={16} />
          {showNotes ? "Hide" : "Show"} Notes
        </Button>
      </div>

      <Button
        onClick={onNext}
        variant="outline"
        size="sm"
        disabled={currentSlide === totalSlides - 1}
      >
        Next
        <ChevronRightIcon />
      </Button>
    </div>
  );
}

export const slidesArtifact = new Artifact({
  kind: "slides",
  description: "Useful for creating presentation slides and slide decks",
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
  content: SlidesEditor,
  actions: [
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
      description: "Copy to clipboard",
      onClick: ({ content }) => {
        navigator.clipboard.writeText(content);
        toast.success("Slides copied to clipboard!");
      },
    },
  ],
  toolbar: [],
});