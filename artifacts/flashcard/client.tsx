// artifacts/flashcard/client.tsx
import { useState } from "react";
import { toast } from "sonner";
import { Artifact } from "@/components/create-artifact";
import {
  CopyIcon,
  RedoIcon,
  UndoIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ShuffleIcon,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Flashcard = {
  front: string;
  back: string;
  tags?: string[];
};

type FlashcardData = {
  title: string;
  cards: Flashcard[];
};

type Metadata = {
  currentCard: number;
  isFlipped: boolean;
  shuffledIndices: number[];
  masteredCards: Set<number>;
};

export const flashcardArtifact = new Artifact<"flashcard", Metadata>({
  kind: "flashcard",
  description: "Interactive flashcards for studying and memorization",
  initialize: ({ setMetadata }) => {
    setMetadata({
      currentCard: 0,
      isFlipped: false,
      shuffledIndices: [],
      masteredCards: new Set(),
    });
  },
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
  content: ({ content, status, metadata, setMetadata }) => {
    if (!content || status === "streaming") {
      return (
        <div className="flex h-[400px] items-center justify-center">
          <div className="text-center">
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-muted-foreground">Generating flashcards...</p>
          </div>
        </div>
      );
    }

    let flashcardData: FlashcardData;
    try {
      flashcardData = JSON.parse(content);
    } catch {
      return (
        <div className="flex h-[400px] items-center justify-center">
          <p className="text-destructive">Error loading flashcard data</p>
        </div>
      );
    }

    const { currentCard, isFlipped, shuffledIndices, masteredCards } = metadata;
    const totalCards = flashcardData.cards.length;
    
    // Use shuffled indices if available, otherwise use sequential
    const cardIndices = shuffledIndices.length > 0 
      ? shuffledIndices 
      : Array.from({ length: totalCards }, (_, i) => i);
    
    const actualIndex = cardIndices[currentCard];
    const card = flashcardData.cards[actualIndex];

    const handleShuffle = () => {
      const indices = Array.from({ length: totalCards }, (_, i) => i);
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }
      setMetadata({
        ...metadata,
        shuffledIndices: indices,
        currentCard: 0,
        isFlipped: false,
      });
      toast.success("Flashcards shuffled!");
    };

    const handleMastered = () => {
      const newMastered = new Set(masteredCards);
      newMastered.add(actualIndex);
      setMetadata({ ...metadata, masteredCards: newMastered });
      toast.success("Card marked as mastered!");
    };

    return (
      <div className="mx-auto max-w-3xl space-y-6 p-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-2xl">{flashcardData.title}</h2>
            <p className="text-muted-foreground text-sm">
              Card {currentCard + 1} of {totalCards}
              {masteredCards.size > 0 && (
                <span className="ml-2">
                  • {masteredCards.size} mastered
                </span>
              )}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleShuffle}>
            <ShuffleIcon size={16} />
            Shuffle
          </Button>
        </div>

        <div
          className="perspective-1000 group relative h-[400px] cursor-pointer"
          onClick={() =>
            setMetadata({ ...metadata, isFlipped: !isFlipped })
          }
        >
          <div
            className={cn(
              "absolute inset-0 transition-transform duration-500 transform-style-3d",
              isFlipped && "rotate-y-180"
            )}
          >
            {/* Front */}
            <Card
              className={cn(
                "absolute inset-0 backface-hidden flex items-center justify-center p-8 text-center",
                masteredCards.has(actualIndex) && "border-green-500 border-2"
              )}
            >
              <div>
                <p className="mb-4 font-medium text-xl">{card.front}</p>
                <p className="text-muted-foreground text-sm">
                  Click to flip
                </p>
              </div>
            </Card>

            {/* Back */}
            <Card
              className={cn(
                "absolute inset-0 backface-hidden rotate-y-180 flex items-center justify-center p-8 text-center bg-primary text-primary-foreground",
                masteredCards.has(actualIndex) && "border-green-500 border-2"
              )}
            >
              <div>
                <p className="mb-4 text-xl">{card.back}</p>
                {card.tags && card.tags.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-2">
                    {card.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="rounded-full bg-primary-foreground/20 px-3 py-1 text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            disabled={currentCard === 0}
            onClick={() =>
              setMetadata({
                ...metadata,
                currentCard: currentCard - 1,
                isFlipped: false,
              })
            }
          >
            <ChevronLeftIcon size={16} />
            Previous
          </Button>
          
          <Button
            variant="outline"
            onClick={handleMastered}
            disabled={masteredCards.has(actualIndex)}
          >
            {masteredCards.has(actualIndex) ? "✓ Mastered" : "Mark as Mastered"}
          </Button>

          <Button
            variant="outline"
            className="flex-1"
            disabled={currentCard === totalCards - 1}
            onClick={() =>
              setMetadata({
                ...metadata,
                currentCard: currentCard + 1,
                isFlipped: false,
              })
            }
          >
            Next
            <ChevronRightIcon size={16} />
          </Button>
        </div>

        <div className="flex justify-center gap-1">
          {cardIndices.map((idx, pos) => (
            <button
              key={pos}
              className={cn(
                "h-2 w-2 rounded-full transition-colors",
                pos === currentCard
                  ? "bg-primary"
                  : masteredCards.has(idx)
                    ? "bg-green-500"
                    : "bg-muted"
              )}
              onClick={() =>
                setMetadata({ ...metadata, currentCard: pos, isFlipped: false })
              }
            />
          ))}
        </div>
      </div>
    );
  },
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
      description: "Copy flashcard data",
      onClick: ({ content }) => {
        navigator.clipboard.writeText(content);
        toast.success("Flashcard data copied to clipboard!");
      },
    },
  ],
  toolbar: [],
});