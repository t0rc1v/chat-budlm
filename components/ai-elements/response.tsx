"use client";

import { type ComponentProps, memo, useMemo } from "react";
import { Streamdown } from "streamdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { cn } from "@/lib/utils";
import 'katex/dist/katex.min.css'

type ResponseProps = ComponentProps<typeof Streamdown>;

export const Response = memo(
  ({ className, children, ...props }: ResponseProps) => {
    // Process the content to convert \(...\) to $...$ for inline math
    const processedContent = useMemo(() => {
      if (typeof children === 'string') {
        return children
          // Convert \(...\) to $...$
          .replace(/\\\((.*?)\\\)/g, '$$$1$$')
          // Convert \[...\] to $$...$$ ([\s\S] matches any character including newlines)
          .replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$$1$$$$');
      }
      return children;
    }, [children]);

    return (
      <Streamdown
        className={cn(
          "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_code]:whitespace-pre-wrap [&_code]:wrap-break-word [&_pre]:max-w-full [&_pre]:overflow-x-auto",
          // KaTeX styling for math expressions
          "[&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden [&_.katex-display]:my-4",
          "[&_.katex]:text-inherit [&_.katex]:text-[1em]",
          className
        )}
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[
          [
            rehypeKatex,
            rehypeRaw,
            {
              strict: false,
              trust: true,
              throwOnError: false,
              output: 'html',
            },
          ],
        ]}
        {...props}
      >
        {processedContent}
      </Streamdown>
    );
  },
  (prevProps, nextProps) => prevProps.children === nextProps.children
);

Response.displayName = "Response";