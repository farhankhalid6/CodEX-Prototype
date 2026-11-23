export type Align = "left" | "center" | "right";

export type Block =
  | { kind: "paragraph"; text: string }
  | { kind: "heading"; level: number; text: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "code"; language: string; code: string }
  | { kind: "table"; header: string[]; align: Align[]; rows: string[][] }
  | { kind: "quote"; text: string }
  | { kind: "rule" };

function normalizeInlineTables(markdown: string): string {
  const output: string[] = [];

  for (const line of markdown.split("\n")) {
    if (!/\|\s*:?-{3,}/.test(line)) {
      output.push(line);
      continue;
    }

    let fixed = line.replace(/\|\s*\|(?=\s*:?-{3,})/g, "|\n|");
    const separator = fixed.search(/\|\s*:?-{3,}/);

    if (separator >= 0) {
      const head = fixed.slice(0, separator);
      let tail = fixed.slice(separator);

      tail = tail.replace(/\|\s*(?=\d+\s*\|\s*(?:\*\*|[A-Za-z`]))/g, "|\n");
      fixed = head + tail;
    }

    output.push(...fixed.split("\n"));
  }

  return output.join("\n");
}

function dedent(value: string): string {
  const lines = value.split("\n");
  while (lines.length > 0 && lines[0]?.trim() === "") lines.shift();
  while (lines.length > 0 && lines[lines.length - 1]?.trim() === "") lines.pop();

  const indents = lines
    .filter((line) => line.trim())
    .map((line) => /^ */.exec(line)?.[0].length ?? 0);
  const common = indents.length > 0 ? Math.min(...indents) : 0;

  return lines.map((line) => line.slice(common)).join("\n");
}

function isTableSeparator(line: string): boolean {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function splitRow(line: string): string[] {
  let value = line.trim();
  if (value.startsWith("|")) value = value.slice(1);
  if (value.endsWith("|")) value = value.slice(0, -1);
  return value.split("|").map((cell) => cell.trim());
}

function parseAlign(line: string): Align[] {
  return splitRow(line).map((cell) => {
    const left = cell.startsWith(":");
    const right = cell.endsWith(":");
    if (left && right) return "center";
    if (right) return "right";
    return "left";
  });
}

function startsBlock(line: string): boolean {
  return (
    /^\s*(```|~~~)/.test(line) ||
    /^\s*#{1,4}\s+/.test(line) ||
    /^\s*[-*+]\s+/.test(line) ||
    /^\s*\d+[.)]\s+/.test(line) ||
    /^\s*>\s?/.test(line) ||
    /^\s*([-*_])\1{2,}\s*$/.test(line)
  );
}

export function parseMarkdown(markdown: string): Block[] {
  const lines = normalizeInlineTables(markdown.replace(/\r\n?/g, "\n")).split("\n");
  const blocks: Block[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fence = /^\s*(```|~~~)\s*([\w+#.-]*)\s*$/.exec(line);
    if (fence) {
      const marker = fence[1] ?? "```";
      const language = fence[2] ?? "";
      const codeLines: string[] = [];
      index += 1;

      while (index < lines.length && !new RegExp(`^\\s*${marker}\\s*$`).test(lines[index] ?? "")) {
        codeLines.push(lines[index] ?? "");
        index += 1;
      }
      index += 1;

      blocks.push({ kind: "code", language, code: dedent(codeLines.join("\n")) });
      continue;
    }

    if (/^( {4}|\t)\S/.test(line)) {
      const codeLines: string[] = [];
      while (index < lines.length && /^( {4}|\t)/.test(lines[index] ?? "")) {
        codeLines.push((lines[index] ?? "").replace(/^( {4}|\t)/, ""));
        index += 1;
      }
      blocks.push({ kind: "code", language: "", code: codeLines.join("\n") });
      continue;
    }

    const heading = /^\s*(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push({
        kind: "heading",
        level: heading[1]?.length ?? 1,
        text: heading[2] ?? "",
      });
      index += 1;
      continue;
    }

    if (
      line.includes("|") &&
      index + 1 < lines.length &&
      isTableSeparator(lines[index + 1] ?? "")
    ) {
      const header = splitRow(line);
      const align = parseAlign(lines[index + 1] ?? "");
      const rows: string[][] = [];
      index += 2;

      while (index < lines.length) {
        const row = lines[index] ?? "";
        if (!row.trim() || !row.includes("|")) break;
        rows.push(splitRow(row));
        index += 1;
      }

      blocks.push({ kind: "table", header, align, rows });
      continue;
    }

    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      blocks.push({ kind: "rule" });
      index += 1;
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const quote: string[] = [];
      while (index < lines.length && /^\s*>\s?/.test(lines[index] ?? "")) {
        quote.push((lines[index] ?? "").replace(/^\s*>\s?/, ""));
        index += 1;
      }
      blocks.push({ kind: "quote", text: quote.join(" ") });
      continue;
    }

    const bullet = /^\s*[-*+]\s+(.*)$/.exec(line);
    const ordered = /^\s*\d+[.)]\s+(.*)$/.exec(line);

    if (bullet || ordered) {
      const isOrdered = Boolean(ordered);
      const items: string[] = [];

      while (index < lines.length) {
        const current = lines[index] ?? "";
        const match = isOrdered
          ? /^\s*\d+[.)]\s+(.*)$/.exec(current)
          : /^\s*[-*+]\s+(.*)$/.exec(current);
        if (!match) break;
        items.push((match[1] ?? "").trim());
        index += 1;
      }

      blocks.push({ kind: "list", ordered: isOrdered, items });
      continue;
    }

    const paragraph: string[] = [];
    while (index < lines.length) {
      const current = lines[index] ?? "";
      if (!current.trim() || (paragraph.length > 0 && startsBlock(current))) break;
      if (paragraph.length === 0 && startsBlock(current)) break;
      paragraph.push(current.trim());
      index += 1;
    }

    if (paragraph.length > 0) {
      blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
    } else {
      index += 1;
    }
  }

  return blocks;
}
