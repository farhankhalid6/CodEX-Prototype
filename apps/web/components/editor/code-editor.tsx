"use client";

import { useEffect, useRef, useState } from "react";
import type * as Monaco from "monaco-editor";
import { activeTheme, loadMonaco } from "./monaco-setup";

type Editor = Monaco.editor.IStandaloneCodeEditor;

interface Props {
  language: string;
  readOnly: boolean;
  value: string;
  onReady: (editor: Editor) => void;
  onSelectionChange: (text: string) => void;
  onChange: (text: string) => void;
}

export function CodeEditor({
  language,
  readOnly,
  value,
  onReady,
  onSelectionChange,
  onChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const monacoRef = useRef<typeof import("monaco-editor") | null>(null);
  const readyRef = useRef(onReady);
  const selectionRef = useRef(onSelectionChange);
  const changeRef = useRef(onChange);
  const valueRef = useRef(value);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  readyRef.current = onReady;
  selectionRef.current = onSelectionChange;
  changeRef.current = onChange;
  valueRef.current = value;

  useEffect(() => {
    let disposed = false;

    (async () => {
      try {
        const monaco = await loadMonaco();

        if (disposed || !containerRef.current) return;

        const editor = monaco.editor.create(containerRef.current, {
          value: valueRef.current,
          language,
          theme: activeTheme(),
          automaticLayout: true,
          fontFamily: "JetBrains Mono, SFMono-Regular, Menlo, Consolas, monospace",
          fontLigatures: false,
          fontSize: 14,
          lineHeight: 22,
          minimap: { enabled: window.innerWidth > 1100 },
          scrollBeyondLastLine: false,
          padding: { top: 18, bottom: 18 },
          smoothScrolling: true,
          cursorBlinking: "smooth",
          cursorSmoothCaretAnimation: "on",
          renderLineHighlight: "all",
          wordWrap: "off",
          tabSize: 2,
          fixedOverflowWidgets: true,
          contextmenu: true,
          quickSuggestions: { other: true, comments: false, strings: false },
        });

        editorRef.current = editor;
        monacoRef.current = monaco;

        editor.onDidChangeCursorSelection(() => {
          const model = editor.getModel();
          const selection = editor.getSelection();
          if (!model || !selection || selection.isEmpty()) {
            selectionRef.current("");
            return;
          }
          selectionRef.current(model.getValueInRange(selection).slice(0, 8000));
        });

        editor.onDidChangeModelContent(() => {
          const model = editor.getModel();
          if (model) changeRef.current(model.getValue());
        });

        setLoading(false);
        readyRef.current(editor);
      } catch (error) {
        console.error("[editor] failed to initialise Monaco", error);
        if (!disposed) {
          setLoading(false);
          setFailed(true);
        }
      }
    })();

    return () => {
      disposed = true;
      editorRef.current?.dispose();
      editorRef.current = null;
      monacoRef.current = null;
    };
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;
    const model = editor.getModel();
    if (model && model.getLanguageId() !== language) {
      monaco.editor.setModelLanguage(model, language);
    }
  }, [language]);

  useEffect(() => {
    const model = editorRef.current?.getModel();
    if (model && model.getValue() !== value) model.setValue(value);
  }, [value]);

  useEffect(() => {
    editorRef.current?.updateOptions({ readOnly, domReadOnly: readOnly });
  }, [readOnly]);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const monaco = monacoRef.current;
      if (!monaco) return;
      monaco.editor.setTheme(activeTheme());
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="h-full w-full" />

      {loading ? (
        <div className="absolute inset-0 grid place-items-center bg-bg text-sm text-muted">
          <div className="flex items-center gap-2">
            <span className="size-2 animate-pulse rounded-full bg-accent" />
            Loading editor…
          </div>
        </div>
      ) : null}

      {failed ? (
        <div className="absolute inset-0 grid place-items-center bg-bg px-6 text-center">
          <div>
            <p className="text-sm font-medium">The editor could not load.</p>
            <p className="mt-1 text-sm text-muted">
              Check the browser console, then reload the page.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
