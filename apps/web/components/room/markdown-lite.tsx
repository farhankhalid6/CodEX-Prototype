"use client";

import { useMemo, useState, type ReactNode } from "react";
import { IconCheck, IconCopy } from "@/components/icons";
import { CodeBlockView } from "@/components/editor/code-block-view";
import { formatCode } from "@/lib/format-code";
import { parseMarkdown } from "@/lib/markdown-parse";

const MONACO_LANGUAGES: Record<string, string> = {
  js: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  py: "python",
  "c++": "cpp",
  cs: "csharp",
  "c#": "csharp",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  yml: "yaml",
  md: "markdown",
  rs: "rust",
  kt: "kotlin",
  rb: "ruby",
  htm: "html",
  text: "plaintext",
  txt: "plaintext",
};

function monacoLanguage(language: string): string {
  const value = language.trim().toLowerCase();
  return MONACO_LANGUAGES[value] ?? (value || "plaintext");
}

function inline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern =
    /(`[^`\n]+`|\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*|_[^_\n]+_|\[[^\]\n]+\]\(https?:\/\/[^)\s]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const token = match[0];

    if (token.startsWith("`")) {
      nodes.push(
        <code
          key={`${match.index}-c`}
          className="rounded bg-panel2 px-1 py-0.5 font-mono text-[0.85em] text-fg"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("**") || token.startsWith("__")) {
      nodes.push(
        <strong key={`${match.index}-b`} className="font-semibold text-fg">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith("[")) {
      const link = /^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/.exec(token);
      if (link) {
        nodes.push(
          <a
            key={`${match.index}-a`}
            href={link[2]}
            target="_blank"
            rel="noreferrer noopener"
            className="text-accent underline underline-offset-2"
          >
            {link[1]}
          </a>,
        );
      } else {
        nodes.push(token);
      }
    } else {
      nodes.push(
        <em key={`${match.index}-i`} className="italic">
          {token.slice(1, -1)}
        </em>,
      );
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

function withLineBreaks(text: string): ReactNode[] {
  const parts = text.split(/<br\s*\/?>/i);
  const nodes: ReactNode[] = [];

  parts.forEach((part, index) => {
    if (index > 0) nodes.push(<br key={`br-${index}`} />);
    nodes.push(...inline(part));
  });

  return nodes;
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [showFormatted, setShowFormatted] = useState(false);
  const [copied, setCopied] = useState(false);

  const formatted = useMemo(() => formatCode(code, language), [code, language]);
  const canFormat = formatted !== code;
  const display = showFormatted ? formatted : code;

  async function copy() {
    try {
      await navigator.clipboard.writeText(display);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {}
  }

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-bg">
      <div className="flex items-center justify-between gap-2 border-b border-line bg-panel2/60 px-3 py-1.5">
        <span className="font-mono text-[10px] tracking-wide text-muted uppercase">
          {language || "code"}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowFormatted((value) => !value)}
            disabled={!canFormat}
            className="rounded-md px-2 py-1 text-[11px] text-muted transition hover:bg-panel hover:text-fg disabled:cursor-not-allowed disabled:opacity-40"
            title={showFormatted ? "Show original" : "Pretty print this block"}
          >
            {showFormatted ? "Original" : "Format"}
          </button>
          <button
            type="button"
            onClick={() => void copy()}
            className="icon-btn size-6"
            title={copied ? "Copied" : "Copy code"}
            aria-label={copied ? "Copied" : "Copy code"}
          >
            {copied ? <IconCheck width={12} height={12} /> : <IconCopy width={12} height={12} />}
          </button>
        </div>
      </div>
      <CodeBlockView code={display} language={monacoLanguage(language)} />
    </div>
  );
}

const HEADING_CLASS: Record<number, string> = {
  1: "text-base font-semibold text-fg",
  2: "text-[15px] font-semibold text-fg",
  3: "text-sm font-semibold text-fg",
  4: "text-[13px] font-semibold text-fg",
};

export function MarkdownLite({ text }: { text: string }) {
  const blocks = useMemo(() => parseMarkdown(text), [text]);

  return (
    <div className="space-y-3 text-[13.5px] leading-relaxed text-fg/90">
      {blocks.map((block, index) => {
        if (block.kind === "heading") {
          return (
            <h3 key={index} className={`pt-1 ${HEADING_CLASS[block.level] ?? HEADING_CLASS[3]}`}>
              {inline(block.text)}
            </h3>
          );
        }

        if (block.kind === "list") {
          const Tag = block.ordered ? "ol" : "ul";
          return (
            <Tag
              key={index}
              className={`space-y-1.5 pl-4 ${block.ordered ? "list-decimal" : "list-disc"}`}
            >
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex} className="marker:text-muted">
                  {withLineBreaks(item)}
                </li>
              ))}
            </Tag>
          );
        }

        if (block.kind === "code") {
          return <CodeBlock key={index} code={block.code} language={block.language} />;
        }

        if (block.kind === "table") {
          return (
            <div key={index} className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full border-collapse text-left text-[12.5px]">
                <thead className="bg-panel2/70 text-[11px] uppercase tracking-wide text-muted">
                  <tr>
                    {block.header.map((cell, cellIndex) => (
                      <th
                        key={cellIndex}
                        className="border-b border-line px-2.5 py-1.5 font-medium"
                        style={{ textAlign: block.align[cellIndex] ?? "left" }}
                      >
                        {inline(cell)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-b border-line/60 last:border-0">
                      {block.header.map((_, cellIndex) => (
                        <td
                          key={cellIndex}
                          className="px-2.5 py-1.5 align-top"
                          style={{ textAlign: block.align[cellIndex] ?? "left" }}
                        >
                          {withLineBreaks(row[cellIndex] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        if (block.kind === "quote") {
          return (
            <blockquote key={index} className="border-l-2 border-line pl-3 text-muted italic">
              {withLineBreaks(block.text)}
            </blockquote>
          );
        }

        if (block.kind === "rule") {
          return <hr key={index} className="border-line" />;
        }

        return <p key={index}>{withLineBreaks(block.text)}</p>;
      })}
    </div>
  );
}
