export const LANGUAGES = [
  "java",
  "html",
  "c",
  "cpp",
  "javascript",
  "markdown",
  "sql",
  "plaintext",
] as const;

export type Language = (typeof LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = "javascript";

export const LANGUAGE_LABELS: Record<Language, string> = {
  java: "Java",
  html: "HTML",
  c: "C",
  cpp: "C++",
  javascript: "JavaScript",
  markdown: "md",
  sql: "SQL",
  plaintext: "text",
};

export const FILE_EXTENSIONS: Record<Language, string> = {
  java: "java",
  html: "html",
  c: "c",
  cpp: "cpp",
  javascript: "js",
  markdown: "md",
  sql: "sql",
  plaintext: "txt",
};

export function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && (LANGUAGES as readonly string[]).includes(value);
}

export function detectLanguage(code: string): Language {
  const sample = code.slice(0, 4000);
  const trimmed = sample.trim();

  if (/^<(!doctype|html)/i.test(trimmed) || /<html[\s>]/i.test(trimmed)) return "html";
  if (/^#include\s*</m.test(sample)) return /std::|iostream|vector\s*</.test(sample) ? "cpp" : "c";
  if (/^\s*(public|private|protected)\s+(class|interface)\s+\w+/m.test(sample)) return "java";
  if (/^\s*(const|let|var|function|=>|import\s+.*from)/m.test(sample)) return "javascript";
  if (/^\s*SELECT\s+.+\s+FROM\s+/im.test(sample)) return "sql";
  if (/^#{1,6}\s+\S/m.test(sample)) return "markdown";

  return "plaintext";
}
