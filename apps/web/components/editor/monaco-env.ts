export function configureMonacoEnvironment(): void {
  if (typeof window === "undefined") return;

  const scope = self as unknown as {
    MonacoEnvironment?: {
      getWorker: (moduleId: string, label: string) => Worker;
    };
  };

  if (scope.MonacoEnvironment) return;

  scope.MonacoEnvironment = {
    getWorker(_moduleId: string, label: string) {
      switch (label) {
        case "json":
          return new Worker(
            new URL("monaco-editor/language/json/json.worker.js", import.meta.url),
            { type: "module" },
          );
        case "css":
        case "scss":
        case "less":
          return new Worker(new URL("monaco-editor/language/css/css.worker.js", import.meta.url), {
            type: "module",
          });
        case "html":
        case "handlebars":
        case "razor":
          return new Worker(
            new URL("monaco-editor/language/html/html.worker.js", import.meta.url),
            { type: "module" },
          );
        case "typescript":
        case "javascript":
          return new Worker(
            new URL("monaco-editor/language/typescript/ts.worker.js", import.meta.url),
            { type: "module" },
          );
        default:
          return new Worker(new URL("monaco-editor/editor/editor.worker.js", import.meta.url), {
            type: "module",
          });
      }
    },
  };
}
