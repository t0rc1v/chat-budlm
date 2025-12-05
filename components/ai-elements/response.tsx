"use client";

import { type ComponentProps, memo, useMemo } from "react";
import { Streamdown } from "streamdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { cn } from "@/lib/utils";
import 'katex/dist/katex.min.css'

type ResponseProps = ComponentProps<typeof Streamdown>;

export const Response = memo(
  ({ className, children, ...props }: ResponseProps) => {
    // Process the content to convert various LaTeX delimiters to standard markdown math format
    const processedContent = useMemo(() => {
      if (typeof children === 'string') {
        let content = children;
        
        // First, protect already-correct delimiters by temporarily replacing them
        const dollarPlaceholder = '___DOLLAR___';
        const doubleDollarPlaceholder = '___DOUBLE_DOLLAR___';
        
        // Protect existing $...$ and $$...$$ from being modified
        content = content.replace(/\$\$([\s\S]*?)\$\$/g, (match, inner) => {
          return `${doubleDollarPlaceholder}${inner}${doubleDollarPlaceholder}`;
        });
        content = content.replace(/\$([^\$\n]+?)\$/g, (match, inner) => {
          return `${dollarPlaceholder}${inner}${dollarPlaceholder}`;
        });
        
        // Convert \[...\] to $$...$$ for display math (must come before \(...\) conversion)
        content = content.replace(/\\\[([\s\S]*?)\\\]/g, (match, inner) => {
          return `${doubleDollarPlaceholder}${inner.trim()}${doubleDollarPlaceholder}`;
        });
        
        // Convert \(...\) to $...$ for inline math
        content = content.replace(/\\\((.*?)\\\)/g, (match, inner) => {
          return `${dollarPlaceholder}${inner}${dollarPlaceholder}`;
        });
        
        // Restore the protected delimiters
        content = content.replace(new RegExp(doubleDollarPlaceholder, 'g'), '$$');
        content = content.replace(new RegExp(dollarPlaceholder, 'g'), '$');
        
        return content;
      }
      return children;
    }, [children]);

    return (
      <>
        <Streamdown
          className={cn(
            "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
            "[&_code]:whitespace-pre-wrap [&_code]:wrap-break-word",
            "[&_pre]:max-w-full [&_pre]:overflow-x-auto",
            // KaTeX display math styling
            "[&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden",
            "[&_.katex-display]:my-4 [&_.katex-display]:text-center",
            // KaTeX inline math styling
            "[&_.katex]:text-inherit [&_.katex]:text-[1em]",
            // Prevent KaTeX from breaking layout
            "[&_.katex-html]:whitespace-normal",
            // Better spacing for matrices and arrays
            "[&_.katex_.arraycolsep]:px-1",
            className
          )}
          remarkPlugins={[remarkMath]}
          rehypePlugins={[
            [
              rehypeKatex,
              {
                strict: false,
                trust: true,
                throwOnError: false,
                output: 'html',
                displayMode: false,
                // Better error handling
                errorColor: '#cc0000',
                macros: {
                  // Add any custom LaTeX macros here if needed
                  "\\RR": "\\mathbb{R}",
                  "\\NN": "\\mathbb{N}",
                },
              },
            ],
          ]}
          {...props}
        >
          {processedContent}
        </Streamdown>
      </>
    );
  },
  (prevProps, nextProps) => prevProps.children === nextProps.children
);

Response.displayName = "Response";