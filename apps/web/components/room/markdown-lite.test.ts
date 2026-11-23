import { describe, expect, it } from "vitest";
import { parseMarkdown } from "../../lib/markdown-parse";

describe("parseMarkdown", () => {
  it("parses a normal table", () => {
    const blocks = parseMarkdown("| Step | Action |\n| --- | --- |\n| 1 | Read |");
    expect(blocks).toEqual([
      {
        kind: "table",
        header: ["Step", "Action"],
        align: ["left", "left"],
        rows: [["1", "Read"]],
      },
    ]);
  });

  it("repairs a table that the model put on one line", () => {
    const blocks = parseMarkdown(
      "| Step | Action | Details | |------|----------|----------| 1 | **Read** | Prompts | 2 | **Init** | Marks |",
    );

    expect(blocks).toHaveLength(1);
    const table = blocks[0];
    expect(table.kind).toBe("table");
    if (table.kind !== "table") return;

    expect(table.header).toEqual(["Step", "Action", "Details"]);
    expect(table.rows).toEqual([
      ["1", "**Read**", "Prompts"],
      ["2", "**Init**", "Marks"],
    ]);
  });

  it("preserves fenced code indentation", () => {
    const blocks = parseMarkdown("```c\nint main() {\n  return 0;\n}\n```");
    expect(blocks).toEqual([{ kind: "code", language: "c", code: "int main() {\n  return 0;\n}" }]);
  });

  it("keeps inline formatting tokens for the renderer", () => {
    const blocks = parseMarkdown("This is **bold** and `code`.");
    expect(blocks).toEqual([{ kind: "paragraph", text: "This is **bold** and `code`." }]);
  });
});
