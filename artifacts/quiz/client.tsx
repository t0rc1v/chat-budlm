// artifacts/quiz/client.tsx
import { useState } from "react";
import { toast } from "sonner";
import { Artifact } from "@/components/create-artifact";
import {
  CheckCircleFillIcon,
  CopyIcon,
  RedoIcon,
  UndoIcon,
  CrossIcon,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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

type Metadata = {
  currentQuestion: number;
  answers: (number | null)[];
  showResults: boolean;
  score: number;
};

export const quizArtifact = new Artifact<"quiz", Metadata>({
  kind: "quiz",
  description: "Interactive quiz with multiple choice questions",
  initialize: ({ setMetadata }) => {
    setMetadata({
      currentQuestion: 0,
      answers: [],
      showResults: false,
      score: 0,
    });
  },
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
  content: ({ content, status, metadata, setMetadata }) => {
    if (!content || status === "streaming") {
      return (
        <div className="flex h-[400px] items-center justify-center">
          <div className="text-center">
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-muted-foreground">Generating quiz...</p>
          </div>
        </div>
      );
    }

    let quizData: QuizData;
    try {
      quizData = JSON.parse(content);
    } catch {
      return (
        <div className="flex h-[400px] items-center justify-center">
          <p className="text-destructive">Error loading quiz data</p>
        </div>
      );
    }

    const { currentQuestion, answers, showResults } = metadata;
    const totalQuestions = quizData.questions.length;

    if (showResults) {
      const correctCount = answers.filter(
        (answer, idx) => answer === quizData.questions[idx].correctAnswer
      ).length;
      const percentage = (correctCount / totalQuestions) * 100;

      return (
        <div className="mx-auto max-w-3xl space-y-6 p-8">
          <div className="text-center">
            <h2 className="mb-2 font-bold text-3xl">Quiz Complete! 🎉</h2>
            <p className="text-muted-foreground">
              You scored {correctCount} out of {totalQuestions}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Your Score</span>
              <span className="font-medium">{percentage.toFixed(0)}%</span>
            </div>
            <Progress value={percentage} className="h-3" />
          </div>

          <div className="space-y-4">
            {quizData.questions.map((question, idx) => {
              const userAnswer = answers[idx];
              const isCorrect = userAnswer === question.correctAnswer;

              return (
                <Card key={idx} className="p-4">
                  <div className="mb-2 flex items-start gap-2">
                    {isCorrect ? (
                      <CheckCircleFillIcon className="mt-1 text-green-500" />
                    ) : (
                      <CrossIcon className="mt-1 text-red-500" />
                    )}
                    <div className="flex-1">
                      <p className="mb-2 font-medium">
                        {idx + 1}. {question.question}
                      </p>
                      <div className="space-y-1 text-sm">
                        <p className="text-muted-foreground">
                          Your answer:{" "}
                          <span
                            className={cn(
                              isCorrect ? "text-green-600" : "text-red-600"
                            )}
                          >
                            {question.options[userAnswer!]}
                          </span>
                        </p>
                        {!isCorrect && (
                          <p className="text-muted-foreground">
                            Correct answer:{" "}
                            <span className="text-green-600">
                              {question.options[question.correctAnswer]}
                            </span>
                          </p>
                        )}
                        {question.explanation && (
                          <p className="mt-2 text-muted-foreground">
                            💡 {question.explanation}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          <Button
            className="w-full"
            onClick={() =>
              setMetadata({
                currentQuestion: 0,
                answers: [],
                showResults: false,
                score: 0,
              })
            }
          >
            Retake Quiz
          </Button>
        </div>
      );
    }

    const question = quizData.questions[currentQuestion];
    const progress = ((currentQuestion + 1) / totalQuestions) * 100;

    return (
      <div className="mx-auto max-w-3xl space-y-6 p-8">
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Question {currentQuestion + 1} of {totalQuestions}</span>
            <span>{progress.toFixed(0)}%</span>
          </div>
          <Progress value={progress} />
        </div>

        <Card className="p-6">
          <h3 className="mb-6 font-medium text-xl">{question.question}</h3>

          <div className="space-y-3">
            {question.options.map((option, idx) => (
              <Button
                key={idx}
                variant={
                  answers[currentQuestion] === idx ? "default" : "outline"
                }
                className="h-auto w-full justify-start p-4 text-left"
                onClick={() => {
                  const newAnswers = [...answers];
                  newAnswers[currentQuestion] = idx;
                  setMetadata({ ...metadata, answers: newAnswers });
                }}
              >
                <span className="mr-3 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border">
                  {String.fromCharCode(65 + idx)}
                </span>
                <span>{option}</span>
              </Button>
            ))}
          </div>
        </Card>

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            disabled={currentQuestion === 0}
            onClick={() =>
              setMetadata({
                ...metadata,
                currentQuestion: currentQuestion - 1,
              })
            }
          >
            Previous
          </Button>
          <Button
            className="flex-1"
            disabled={answers[currentQuestion] === undefined}
            onClick={() => {
              if (currentQuestion === totalQuestions - 1) {
                const correctCount = answers.filter(
                  (answer, idx) =>
                    answer === quizData.questions[idx].correctAnswer
                ).length;
                setMetadata({
                  ...metadata,
                  showResults: true,
                  score: correctCount,
                });
              } else {
                setMetadata({
                  ...metadata,
                  currentQuestion: currentQuestion + 1,
                });
              }
            }}
          >
            {currentQuestion === totalQuestions - 1 ? "Finish" : "Next"}
          </Button>
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
      description: "Copy quiz data",
      onClick: ({ content }) => {
        navigator.clipboard.writeText(content);
        toast.success("Quiz data copied to clipboard!");
      },
    },
  ],
  toolbar: [],
});