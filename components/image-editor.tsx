import cn from "classnames";
import { LoaderIcon } from "./icons";

type ImageEditorProps = {
  title: string;
  content: string;
  isCurrentVersion: boolean;
  currentVersionIndex: number;
  status: string;
  isInline?: boolean;
};

export function ImageEditor({
  title,
  content,
  status,
  isInline = false,
}: ImageEditorProps) {
  // Handle both formats: with or without data URL prefix
  const imageSrc = content.startsWith('data:image/')
    ? content
    : `data:image/png;base64,${content}`;

  console.log("ImageEditor rendering:", {
    hasContent: !!content,
    contentLength: content.length,
    contentPreview: content.substring(0, 50),
    isInline,
    status
  });

  return (
    <div
      className={cn("flex w-full flex-row items-center justify-center", {
        "h-[calc(100dvh-60px)]": !isInline,
        "h-[257px]": isInline,
      })}
    >
      {status === "streaming" ? (
        <div className="flex flex-row items-center gap-4">
          {!isInline && (
            <div className="animate-spin">
              <LoaderIcon />
            </div>
          )}
          <div>Generating Image...</div>
        </div>
      ) : content ? (
        <picture>
          {/** biome-ignore lint/nursery/useImageSize: "Generated image without explicit size" */}
          <img
            alt={title}
            className={cn("h-fit w-full max-w-[800px] object-contain", {
              "p-0 md:p-20": !isInline,
              "p-2": isInline,
            })}
            src={imageSrc}
            onError={(e) => {
              console.error("Image failed to load:", {
                src: imageSrc.substring(0, 100),
                error: e
              });
            }}
          />
        </picture>
      ) : (
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <div>No image data available</div>
          <div className="text-xs">Content length: {content?.length || 0}</div>
        </div>
      )}
    </div>
  );
}