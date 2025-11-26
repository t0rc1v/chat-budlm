"use client";

import { defaultMarkdownSerializer, MarkdownParser } from "prosemirror-markdown";
import { type Node } from "prosemirror-model";
import { Decoration, DecorationSet, type EditorView } from "prosemirror-view";
import MarkdownIt from "markdown-it";
import { documentSchema } from "./config";
import { createSuggestionWidget, type UISuggestion } from "./suggestions";

// Lazy initialization - create parser only when first needed
let markdownParser: MarkdownParser | null = null;

const getMarkdownParser = () => {
  if (!markdownParser) {
    markdownParser = new MarkdownParser(
      documentSchema,
      new MarkdownIt(),
      {
        blockquote: { block: "blockquote" },
        paragraph: { block: "paragraph" },
        list_item: { block: "list_item" },
        bullet_list: { block: "bullet_list" },
        ordered_list: { 
          block: "ordered_list", 
          getAttrs: (tok: any) => ({ order: +tok.attrGet("start") || 1 }) 
        },
        heading: { 
          block: "heading", 
          getAttrs: (tok: any) => ({ level: +tok.tag.slice(1) }) 
        },
        code_block: { block: "code_block", noCloseToken: true },
        fence: { 
          block: "code_block", 
          getAttrs: (tok: any) => ({ params: tok.info || "" }), 
          noCloseToken: true 
        },
        hr: { node: "horizontal_rule" },
        image: { 
          node: "image", 
          getAttrs: (tok: any) => ({ 
            src: tok.attrGet("src"), 
            title: tok.attrGet("title") || null, 
            alt: tok.children?.[0]?.content || null 
          }) 
        },
        hardbreak: { node: "hard_break" },
        em: { mark: "em" },
        strong: { mark: "strong" },
        link: { 
          mark: "link", 
          getAttrs: (tok: any) => ({ 
            href: tok.attrGet("href"), 
            title: tok.attrGet("title") || null 
          }) 
        },
        code_inline: { mark: "code", noCloseToken: true },
      }
    );
  }
  return markdownParser;
};

export const buildDocumentFromContent = (content: string) => {
  console.log('🔧 buildDocumentFromContent called with:', {
    contentLength: content.length,
    contentPreview: content.substring(0, 100)
  });

  try {
    // Get parser lazily to avoid circular dependency
    const parser = getMarkdownParser();
    const doc = parser.parse(content);
    
    console.log('✅ Parsed document:', {
      contentSize: doc?.content.size,
      childCount: doc?.childCount,
      nodeType: doc?.type.name,
      textContent: doc?.textContent.substring(0, 100)
    });
    
    return doc || documentSchema.node("doc", null, [documentSchema.node("paragraph")]);
  } catch (error) {
    console.error('❌ Error parsing markdown:', error);
    // Return empty document on error
    return documentSchema.node("doc", null, [documentSchema.node("paragraph")]);
  }
};

export const buildContentFromDocument = (document: Node) => {
  return defaultMarkdownSerializer.serialize(document);
};

export const createDecorations = (
  suggestions: UISuggestion[],
  view: EditorView
) => {
  const decorations: Decoration[] = [];

  for (const suggestion of suggestions) {
    decorations.push(
      Decoration.inline(
        suggestion.selectionStart,
        suggestion.selectionEnd,
        {
          class: "suggestion-highlight",
        },
        {
          suggestionId: suggestion.id,
          type: "highlight",
        }
      )
    );

    decorations.push(
      Decoration.widget(
        suggestion.selectionStart,
        (currentView) => {
          const { dom } = createSuggestionWidget(suggestion, currentView);
          return dom;
        },
        {
          suggestionId: suggestion.id,
          type: "widget",
        }
      )
    );
  }

  return DecorationSet.create(view.state.doc, decorations);
};