const LANGUAGE_ALIASES: Record<string, string> = {
  js: "javascript",
  jsx: "javascript",
  "c++": "cpp",
  htm: "html",
  md: "markdown",
};

const BRACE_LANGUAGES = new Set(["javascript", "java", "cpp", "c"]);

interface ScanState {
  quote: string | null;
  blockComment: boolean;
}

function normalizeLanguage(language: string): string {
  const value = language.trim().toLowerCase();
  return LANGUAGE_ALIASES[value] ?? value;
}

function scanLine(line: string, state: ScanState): { braces: number; parens: number } {
  let braces = 0;
  let parens = 0;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (state.blockComment) {
      if (char === "*" && next === "/") {
        state.blockComment = false;
        index += 1;
      }
      continue;
    }

    if (state.quote) {
      if (char === "\\") {
        index += 1;
      } else if (char === state.quote) {
        state.quote = null;
      }
      continue;
    }

    if (char === "/" && next === "*") {
      state.blockComment = true;
      index += 1;
      continue;
    }
    if (char === "/" && next === "/") break;
    if (char === '"' || char === "'" || char === "`") {
      state.quote = char;
      continue;
    }

    if (char === "{") braces += 1;
    else if (char === "}") braces -= 1;
    else if (char === "(" || char === "[") parens += 1;
    else if (char === ")" || char === "]") parens -= 1;
  }

  return { braces, parens };
}

function formatBraces(lines: string[]): string {
  const state: ScanState = { quote: null, blockComment: false };
  const output: string[] = [];

  let depth = 0;
  let continuation = 0;
  let blankRun = 0;

  for (const rawLine of lines) {
    if (state.quote) {
      output.push(rawLine);
      scanLine(rawLine, state);
      continue;
    }

    const raw = rawLine.replace(/[ \t]+$/g, "");
    const trimmed = raw.trim();

    if (!trimmed) {
      blankRun += 1;
      if (blankRun <= 2) output.push("");
      continue;
    }
    blankRun = 0;

    const inBlockComment = state.blockComment;

    if (!inBlockComment && trimmed.startsWith("#")) {
      output.push(trimmed);
      continue;
    }

    let indent = depth + continuation;

    if (!inBlockComment && trimmed.startsWith("}")) {
      indent = Math.max(0, depth - 1);
    } else if (!inBlockComment && (trimmed.startsWith(")") || trimmed.startsWith("]"))) {
      indent = Math.max(0, depth + continuation - 1);
    }

    output.push(`${"  ".repeat(indent)}${trimmed}`);

    const { braces, parens } = scanLine(trimmed, state);
    depth = Math.max(0, depth + braces);
    continuation = Math.max(0, continuation + parens);
  }

  return output.join("\n");
}

export function formatCode(source: string, language: string): string {
  const normalized = source.replace(/\r\n?/g, "\n").replace(/\t/g, "  ");
  const id = normalizeLanguage(language);
  const lines = normalized.split("\n");

  if (!BRACE_LANGUAGES.has(id)) {
    return lines.map((line) => line.replace(/[ \t]+$/g, "")).join("\n");
  }

  return formatBraces(lines);
}
