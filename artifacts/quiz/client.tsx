import { useState } from "react";
import { toast } from "sonner";
import { Artifact } from "@/components/create-artifact";
import { CopyIcon, RedoIcon, UndoIcon, RefreshIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Question = {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
};

type QuizData = {
  title: string;
  questions: Question[];
};

type QuizEditorProps = {
  content: string;
  isCurrentVersion: boolean;
  currentVersionIndex: number;
  status: string;
};

function QuizEditor({ content, status }: QuizEditorProps) {
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [showResults, setShowResults] = useState(false);

  if (status === "streaming" || !content) {
    return (
      <div className="flex h-full w-full items-center justify-center p-8">
        <div className="text-muted-foreground">Generating quiz...</div>
      </div>
    );
  }

  let quizData: QuizData;
  try {
    quizData = JSON.parse(content);
  } catch {
    return (
      <div className="flex h-full w-full items-center justify-center p-8">
        <div className="text-red-500">Invalid quiz format</div>
      </div>
    );
  }

  const handleSubmit = () => {
    setShowResults(true);
  };

  const handleReset = () => {
    setSelectedAnswers({});
    setShowResults(false);
  };

  const score = showResults
    ? Object.entries(selectedAnswers).filter(
        ([index, answer]) => answer === quizData.questions[Number(index)].correctAnswer
      ).length
    : 0;

  return (
    <div className="mx-auto w-full max-w-3xl p-8">
      <div className="mb-8">
        <h1 className="mb-2 font-bold text-2xl">{quizData.title}</h1>
        {showResults && (
          <div className="rounded-lg border bg-muted p-4">
            <p className="font-semibold text-lg">
              Score: {score} / {quizData.questions.length}
            </p>
          </div>
        )}
      </div>

      <div className="space-y-8">
        {quizData.questions.map((q, qIndex) => {
          const isCorrect = showResults && selectedAnswers[qIndex] === q.correctAnswer;
          const isIncorrect = showResults && selectedAnswers[qIndex] !== q.correctAnswer && selectedAnswers[qIndex] !== undefined;

          return (
            <div
              key={qIndex}
              className={cn("rounded-lg border p-6", {
                "border-green-500 bg-green-50 dark:bg-green-950/20": isCorrect,
                "border-red-500 bg-red-50 dark:bg-red-950/20": isIncorrect,
              })}
            >
              <h3 className="mb-4 font-semibold text-lg">
                {qIndex + 1}. {q.question}
              </h3>

              <RadioGroup
                disabled={showResults}
                onValueChange={(value) => {
                  setSelectedAnswers((prev) => ({
                    ...prev,
                    [qIndex]: Number(value),
                  }));
                }}
                value={selectedAnswers[qIndex]?.toString()}
              >
                <div className="space-y-3">
                  {q.options.map((option, oIndex) => {
                    const isThisCorrect = showResults && oIndex === q.correctAnswer;
                    const isThisSelected = selectedAnswers[qIndex] === oIndex;

                    return (
                      <div
                        key={oIndex}
                        className={cn(
                          "flex items-center space-x-3 rounded-md border p-3 transition-colors",
                          {
                            "border-green-500 bg-green-100 dark:bg-green-900/30": isThisCorrect,
                            "border-red-500": showResults && isThisSelected && !isThisCorrect,
                          }
                        )}
                      >
                        <RadioGroupItem value={oIndex.toString()} id={`q${qIndex}-o${oIndex}`} />
                        <Label
                          htmlFor={`q${qIndex}-o${oIndex}`}
                          className="flex-1 cursor-pointer"
                        >
                          {option}
                        </Label>
                        {isThisCorrect && showResults && (
                          <span className="text-green-600 text-sm">✓ Correct</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </RadioGroup>

              {showResults && q.explanation && (
                <div className="mt-4 rounded-md bg-blue-50 p-3 dark:bg-blue-950/20">
                  <p className="font-medium text-sm">Explanation:</p>
                  <p className="text-muted-foreground text-sm">{q.explanation}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-8 flex gap-4">
        {!showResults ? (
          <Button
            onClick={handleSubmit}
            disabled={Object.keys(selectedAnswers).length !== quizData.questions.length}
          >
            Submit Quiz
          </Button>
        ) : (
          <Button onClick={handleReset} variant="outline">
            <RefreshIcon size={16} />
            Retry Quiz
          </Button>
        )}
      </div>
    </div>
  );
}

export const quizArtifact = new Artifact({
  kind: "quiz",
  description: "Useful for creating interactive quizzes and assessments",
  onStreamPart: ({ streamPart, setArtifact }) => {
    if (streamPart.type === "data-quizDelta") {
      setArtifact((draftArtifact) => ({
        ...draftArtifact,
        content: streamPart.data,
        isVisible: true,
        status: "streaming",
      }));
    }
  },
  content: QuizEditor,
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
        toast.success("Quiz copied to clipboard!");
      },
    },
  ],
  toolbar: [],
});