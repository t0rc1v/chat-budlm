import { useState } from "react";
import { toast } from "sonner";
import { Artifact } from "@/components/create-artifact";
import { 
  CopyIcon, 
  RedoIcon, 
  UndoIcon, 
  ChevronLeftIcon, 
  ChevronRightIcon,
  RefreshIcon 
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Flashcard = {
  front: string;
  back: string;
  category?: string;
};

type FlashcardData = {
  title: string;
  cards: Flashcard[];
};

type FlashcardEditorProps = {
  content: string;
  isCurrentVersion: boolean;
  currentVersionIndex: number;
  status: string;
};

function FlashcardEditor({ content, status }: FlashcardEditorProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  if (status === "streaming" || !content) {
    return (
      <div className="flex h-full w-full items-center justify-center p-8">
        <div className="text-muted-foreground">Generating flashcards...</div>
      </div>
    );
  }

  let flashcardData: FlashcardData;
  try {
    flashcardData = JSON.parse(content);
  } catch {
    return (
      <div className="flex h-full w-full items-center justify-center p-8">
        <div className="text-red-500">Invalid flashcard format</div>
      </div>
    );
  }

  const currentCard = flashcardData.cards[currentIndex];

  const handleNext = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev + 1) % flashcardData.cards.length);
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setCurrentIndex(
      (prev) => (prev - 1 + flashcardData.cards.length) % flashcardData.cards.length
    );
  };

  const handleReset = () => {
    setCurrentIndex(0);
    setIsFlipped(false);
  };

  return (
    <div className="flex h-full min-h-[600px] w-full flex-col items-center justify-center p-8">
      <div className="mb-8 w-full max-w-2xl text-center">
        <h1 className="mb-2 font-bold text-2xl">{flashcardData.title}</h1>
        <p className="text-muted-foreground">
          Card {currentIndex + 1} of {flashcardData.cards.length}
        </p>
      </div>

      <div
        className="group relative mb-8 h-[400px] w-full max-w-2xl cursor-pointer"
        onClick={() => setIsFlipped(!isFlipped)}
        style={{ perspective: "1000px" }}
      >
        <div
          className={cn(
            "relative h-full w-full transition-transform duration-500",
            "transform-gpu",
            isFlipped && "transform-[rotateY(180deg)]"
          )}
          style={{ transformStyle: "preserve-3d" }}
        >
          {/* Front */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border-2 bg-background p-8 shadow-lg"
            style={{ backfaceVisibility: "hidden" }}
          >
            {currentCard.category && (
              <span className="mb-4 rounded-full bg-primary/10 px-4 py-1 font-medium text-primary text-sm">
                {currentCard.category}
              </span>
            )}
            <p className="text-center text-xl">{currentCard.front}</p>
            <p className="mt-4 text-muted-foreground text-sm">
              Click to reveal answer
            </p>
          </div>

          {/* Back */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border-2 bg-primary p-8 text-primary-foreground shadow-lg"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            {currentCard.category && (
              <span className="mb-4 rounded-full bg-primary-foreground/10 px-4 py-1 font-medium text-sm">
                {currentCard.category}
              </span>
            )}
            <p className="text-center text-xl">{currentCard.back}</p>
            <p className="mt-4 text-sm opacity-80">
              Click to see question
            </p>
          </div>
        </div>
      </div>

      <div className="flex w-full max-w-2xl items-center justify-between gap-4">
        <Button
          onClick={handlePrev}
          variant="outline"
          size="lg"
          disabled={flashcardData.cards.length <= 1}
        >
          <ChevronLeftIcon />
          Previous
        </Button>

        <Button onClick={handleReset} variant="ghost" size="sm">
          <RefreshIcon size={16} />
          Reset
        </Button>

        <Button
          onClick={handleNext}
          variant="outline"
          size="lg"
          disabled={flashcardData.cards.length <= 1}
        >
          Next
          <ChevronRightIcon />
        </Button>
      </div>

      <div className="mt-4 flex gap-2">
        {flashcardData.cards.map((_, index) => (
          <button
            key={index}
            onClick={() => {
              setCurrentIndex(index);
              setIsFlipped(false);
            }}
            className={cn(
              "size-2 rounded-full transition-all",
              index === currentIndex
                ? "w-6 bg-primary"
                : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
            )}
          />
        ))}
      </div>
    </div>
  );
}

export const flashcardArtifact = new Artifact({
  kind: "flashcard",
  description: "Useful for creating interactive flashcards for learning",
  onStreamPart: ({ streamPart, setArtifact }) => {
    if (streamPart.type === "data-flashcardDelta") {
      setArtifact((draftArtifact) => ({
        ...draftArtifact,
        content: streamPart.data,
        isVisible: true,
        status: "streaming",
      }));
    }
  },
  content: FlashcardEditor,
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
        toast.success("Flashcards copied to clipboard!");
      },
    },
  ],
  toolbar: [],
});