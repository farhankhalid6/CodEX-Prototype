import { describe, expect, it } from "vitest";
import { formatCode } from "./format-code";

describe("formatCode", () => {
  it("indents brace languages by two spaces", () => {
    const input = "function add(a,b){\nreturn a+b;\n}";
    expect(formatCode(input, "javascript")).toBe("function add(a,b){\n  return a+b;\n}");
  });

  it("dedents closing brackets and lines with several closers", () => {
    const input = "const x={\na:[1,2]\n});";
    expect(formatCode(input, "javascript")).toBe("const x={\n  a:[1,2]\n});");
  });

  it("does not count brackets inside strings or comments", () => {
    const input = 'const s="{"; // {\nconst n=1;';
    expect(formatCode(input, "javascript")).toBe('const s="{"; // {\nconst n=1;');
  });

  it("removes trailing whitespace from non-brace languages", () => {
    expect(formatCode("SELECT 1;   \n\nFROM t   ", "sql")).toBe("SELECT 1;\n\nFROM t");
  });

  it("keeps blank lines but removes trailing whitespace", () => {
    expect(formatCode("a() {   \n\n\nb()   \n}", "java")).toBe("a() {\n\n\n  b()\n}");
  });

  it("keeps preprocessor lines in column zero", () => {
    const input = '#include <stdio.h>\nint main(){\nprintf("hi");\nreturn 0;\n}';
    expect(formatCode(input, "c")).toBe(
      '#include <stdio.h>\nint main(){\n  printf("hi");\n  return 0;\n}',
    );
  });

  it("indents C bodies without merging or reordering lines", () => {
    const input = "int dfs(int v){\nif(v==0){\nreturn 1;\n}\nreturn dfs(v-1);\n}";
    expect(formatCode(input, "c")).toBe(
      "int dfs(int v){\n  if(v==0){\n    return 1;\n  }\n  return dfs(v-1);\n}",
    );
  });

  it("never changes the number of lines", () => {
    const input = "int main(){\n\n  int x = 1;\n\n  return x;\n}\n";
    const output = formatCode(input, "c");
    expect(output.split("\n").length).toBe(input.split("\n").length);
  });

  it("leaves the inside of a multi-line template literal untouched", () => {
    const input = "const s = `\n  keep   this\n`;";
    expect(formatCode(input, "javascript")).toBe(input);
  });
});
