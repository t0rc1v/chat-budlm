// artifacts/report/client.tsx
import { toast } from "sonner";
import { Artifact } from "@/components/create-artifact";
import { CopyIcon, RedoIcon, UndoIcon, DownloadIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import Markdown from "react-markdown";

type ReportSection = {
  title: string;
  content: string;
  subsections?: { title: string; content: string }[];
};

type ReportData = {
  title: string;
  subtitle?: string;
  author?: string;
  date?: string;
  summary: string;
  sections: ReportSection[];
  conclusion?: string;
  references?: string[];
};

export const reportArtifact = new Artifact<"report", any>({
  kind: "report",
  description: "Professional report with sections and formatting",
  initialize: () => null,
  onStreamPart: ({ streamPart, setArtifact }) => {
    if (streamPart.type === "data-reportDelta") {
      setArtifact((draftArtifact) => ({
        ...draftArtifact,
        content: streamPart.data,
        isVisible: true,
        status: "streaming",
      }));
    }
  },
  content: ({ content, status }) => {
    if (!content || status === "streaming") {
      return (
        <div className="flex h-[400px] items-center justify-center">
          <div className="text-center">
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-muted-foreground">Generating report...</p>
          </div>
        </div>
      );
    }

    let reportData: ReportData;
    try {
      reportData = JSON.parse(content);
    } catch {
      return (
        <div className="flex h-[400px] items-center justify-center">
          <p className="text-destructive">Error loading report data</p>
        </div>
      );
    }

    return (
      <div className="mx-auto max-w-4xl space-y-8 bg-white p-12 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
        {/* Header */}
        <div className="space-y-4 text-center">
          <h1 className="font-bold text-4xl">{reportData.title}</h1>
          {reportData.subtitle && (
            <p className="text-muted-foreground text-xl">
              {reportData.subtitle}
            </p>
          )}
          <div className="flex justify-center gap-4 text-muted-foreground text-sm">
            {reportData.author && <span>{reportData.author}</span>}
            {reportData.date && (
              <>
                {reportData.author && <span>•</span>}
                <span>{reportData.date}</span>
              </>
            )}
          </div>
        </div>

        <Separator />

        {/* Executive Summary */}
        {reportData.summary && (
          <Card className="border-l-4 border-l-primary bg-muted/50 p-6">
            <h2 className="mb-3 font-semibold text-xl">Executive Summary</h2>
            <div className="prose prose-sm dark:prose-invert">
                <Markdown>
                {reportData.summary}
                </Markdown>
            </div>
          </Card>
        )}

        {/* Sections */}
        <div className="space-y-8">
          {reportData.sections.map((section, idx) => (
            <section key={idx} className="space-y-4">
              <h2 className="font-bold text-2xl">
                {idx + 1}. {section.title}
              </h2>
              <div className="prose prose-sm dark:prose-invert">  
                <Markdown>
                    {section.content}
                </Markdown>
              </div>

              {section.subsections && section.subsections.length > 0 && (
                <div className="ml-6 space-y-4">
                  {section.subsections.map((subsection, subIdx) => (
                    <div key={subIdx}>
                      <h3 className="font-semibold text-xl">
                        {idx + 1}.{subIdx + 1} {subsection.title}
                      </h3>
                      <div className="prose prose-sm dark:prose-invert">
                        <Markdown>
                            {subsection.content}
                        </Markdown>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>

        {/* Conclusion */}
        {reportData.conclusion && (
          <>
            <Separator />
            <section className="space-y-4">
              <h2 className="font-bold text-2xl">Conclusion</h2>
              <div className="prose prose-sm dark:prose-invert">
                <Markdown>
                    {reportData.conclusion}
                </Markdown>
              </div>
            </section>
          </>
        )}

        {/* References */}
        {reportData.references && reportData.references.length > 0 && (
          <>
            <Separator />
            <section className="space-y-4">
              <h2 className="font-bold text-2xl">References</h2>
              <ol className="list-decimal space-y-2 pl-6 text-sm">
                {reportData.references.map((ref, idx) => (
                  <li key={idx} className="text-muted-foreground">
                    {ref}
                  </li>
                ))}
              </ol>
            </section>
          </>
        )}
      </div>
    );
  },
  actions: [
    {
      icon: <DownloadIcon size={18} />,
      description: "Download as PDF",
      onClick: () => {
        toast.info("PDF export coming soon!");
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
      description: "Copy report data",
      onClick: ({ content }) => {
        navigator.clipboard.writeText(content);
        toast.success("Report data copied to clipboard!");
      },
    },
  ],
  toolbar: [],
});