import type * as Monaco from "monaco-editor";
import { configureMonacoEnvironment } from "./monaco-env";

type MonacoModule = typeof import("monaco-editor");

let loading: Promise<MonacoModule> | null = null;

function defineThemes(monaco: MonacoModule): void {
  monaco.editor.defineTheme("codex-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "6f7280", fontStyle: "italic" },
      { token: "keyword", foreground: "7ab8ff" },
      { token: "string", foreground: "8fd694" },
      { token: "number", foreground: "ffc46b" },
    ],
    colors: {
      "editor.background": "#0b0b0f",
      "editor.foreground": "#e8e8ee",
      "editorLineNumber.foreground": "#4a4a55",
      "editorLineNumber.activeForeground": "#9a9aa4",
      "editor.lineHighlightBackground": "#14141b",
      "editor.selectionBackground": "#264f78",
      "editor.inactiveSelectionBackground": "#1d3550",
      "editorCursor.foreground": "#6ea8fe",
      "editorIndentGuide.background1": "#1c1c24",
      "editorWidget.background": "#14141a",
      "editorWidget.border": "#2a2a34",
      "editorSuggestWidget.background": "#14141a",
      "editorSuggestWidget.border": "#2a2a34",
      "editorHoverWidget.background": "#14141a",
      "editorHoverWidget.border": "#2a2a34",
      "scrollbarSlider.background": "#ffffff14",
      "scrollbarSlider.hoverBackground": "#ffffff24",
      "minimap.background": "#0b0b0f",
    },
  });

  monaco.editor.defineTheme("codex-light", {
    base: "vs",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": "#ffffff",
      "editor.lineHighlightBackground": "#f5f5f9",
      "editorLineNumber.foreground": "#a0a0aa",
      "editorCursor.foreground": "#0066d6",
      "editorWidget.background": "#ffffff",
      "editorWidget.border": "#e2e2ea",
    },
  });
}

export function loadMonaco(): Promise<MonacoModule> {
  if (!loading) {
    loading = import("monaco-editor").then((monaco) => {
      configureMonacoEnvironment();
      defineThemes(monaco);
      return monaco;
    });
  }
  return loading;
}

export function activeTheme(): string {
  if (typeof document === "undefined") return "codex-dark";
  return document.documentElement.classList.contains("light") ? "codex-light" : "codex-dark";
}

export type { Monaco };
