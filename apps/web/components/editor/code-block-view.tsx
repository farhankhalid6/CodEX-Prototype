"use client";

import { useEffect, useRef, useState } from "react";
import type * as Monaco from "monaco-editor";
import { activeTheme, loadMonaco } from "./monaco-setup";

type Editor = Monaco.editor.IStandaloneCodeEditor;

interface Props {
  code: string;
  language: string;
  maxHeight?: number;
  minHeight?: number;
}

export function CodeBlockView({ code, language, maxHeight = 640, minHeight = 54 }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const codeRef = useRef(code);
  const languageRef = useRef(language);
  const [height, setHeight] = useState(minHeight);

  codeRef.current = code;
  languageRef.current = language;

  useEffect(() => {
    let disposed = false;
    let observer: MutationObserver | null = null;
    let contentSub: { dispose(): void } | null = null;

    void (async () => {
      const monaco = await loadMonaco();
      if (disposed || !hostRef.current) return;

      const editor = monaco.editor.create(hostRef.current, {
        value: codeRef.current,
        language: languageRef.current || "plaintext",
        theme: activeTheme(),
        readOnly: true,
        domReadOnly: true,
        lineNumbers: "on",
        lineNumbersMinChars: 3,
        glyphMargin: false,
        folding: false,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        wordWrap: "off",
        fontSize: 12,
        lineHeight: 20,
        fontFamily: "JetBrains Mono, SFMono-Regular, Menlo, Consolas, monospace",
        fontLigatures: false,
        padding: { top: 10, bottom: 10 },
        renderLineHighlight: "none",
        contextmenu: false,
        overviewRulerLanes: 0,
        hideCursorInOverviewRuler: true,
        cursorBlinking: "solid",
        smoothScrolling: false,
        automaticLayout: true,
        scrollbar: {
          vertical: "auto",
          horizontal: "auto",
          alwaysConsumeMouseWheel: false,
          horizontalScrollbarSize: 8,
          verticalScrollbarSize: 8,
          useShadows: false,
        },
      });

      editorRef.current = editor;

      const syncHeight = () => {
        const content = editor.getContentHeight();
        setHeight(Math.min(Math.max(content, minHeight), maxHeight));
      };

      syncHeight();
      contentSub = editor.onDidContentSizeChange(syncHeight);

      observer = new MutationObserver(() => monaco.editor.setTheme(activeTheme()));
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
      });
    })();

    return () => {
      disposed = true;
      observer?.disconnect();
      contentSub?.dispose();
      editorRef.current?.dispose();
      editorRef.current = null;
    };
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    const model = editor?.getModel();
    if (!model) return;
    if (model.getValue() !== code) model.setValue(code);
  }, [code]);

  useEffect(() => {
    const editor = editorRef.current;
    const model = editor?.getModel();
    if (!editor || !model || !language) return;
    if (model.getLanguageId() !== language) {
      void loadMonaco().then((monaco) => {
        if (editorRef.current === editor) monaco.editor.setModelLanguage(model, language);
      });
    }
  }, [language]);

  return (
    <div
      ref={hostRef}
      className="w-full overflow-hidden"
      style={{ height }}
      aria-label="Code block"
    />
  );
}
