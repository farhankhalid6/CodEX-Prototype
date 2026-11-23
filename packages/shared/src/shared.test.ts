import { describe, expect, it } from "vitest";
import {
  createRoomSchema,
  detectLanguage,
  roomIdSchema,
  signRoomToken,
  slugify,
  verifyRoomToken,
} from "./index.js";

const SECRET = "test-secret-that-is-at-least-32-characters-long";

describe("detectLanguage", () => {
  it("recognises the supported languages", () => {
    expect(detectLanguage("import java.util.List;\npublic class Main {}")).toBe("java");
    expect(detectLanguage("<!doctype html><html><body></body></html>")).toBe("html");
    expect(detectLanguage("#include <stdio.h>")).toBe("c");
    expect(detectLanguage("#include <iostream>\nint main() {}")).toBe("cpp");
    expect(detectLanguage("const answer = items.map((item) => item.id);")).toBe("javascript");
    expect(detectLanguage("# Heading\nsome text")).toBe("markdown");
    expect(detectLanguage("SELECT id, title FROM rooms")).toBe("sql");
    expect(detectLanguage("random words with no syntax")).toBe("plaintext");
  });
});

describe("createRoomSchema", () => {
  it("applies safe defaults", () => {
    const parsed = createRoomSchema.parse({});

    expect(parsed.title).toBe("Untitled snippet");
    expect(parsed.language).toBe("javascript");
    expect(parsed.visibility).toBe("public-link");
    expect(parsed.expiresInDays).toBe(7);
  });

  it("rejects removed languages and bad expiry", () => {
    expect(createRoomSchema.safeParse({ language: "python" }).success).toBe(false);
    expect(createRoomSchema.safeParse({ language: "typescript" }).success).toBe(false);
    expect(createRoomSchema.safeParse({ expiresInDays: 0 }).success).toBe(false);
    expect(createRoomSchema.safeParse({ expiresInDays: 91 }).success).toBe(false);
  });
});

describe("roomIdSchema", () => {
  it("accepts URL-safe ids and rejects short or odd ids", () => {
    expect(roomIdSchema.safeParse("abcDEF123").success).toBe(true);
    expect(roomIdSchema.safeParse("short").success).toBe(false);
    expect(roomIdSchema.safeParse("has spaces").success).toBe(false);
    expect(roomIdSchema.safeParse("../etc/passwd").success).toBe(false);
  });
});

describe("room tokens", () => {
  it("round-trips claims", async () => {
    const token = await signRoomToken(
      SECRET,
      { sub: "guest-1", room: "abc123", role: "editor", name: "Ada" },
      120,
    );

    const claims = await verifyRoomToken(SECRET, token);
    expect(claims.sub).toBe("guest-1");
    expect(claims.room).toBe("abc123");
    expect(claims.role).toBe("editor");
    expect(claims.name).toBe("Ada");
    expect(claims.exp).toBeGreaterThan(claims.iat);
  });

  it("rejects a token signed with another secret", async () => {
    const token = await signRoomToken(
      SECRET,
      { sub: "guest-1", room: "abc123", role: "viewer" },
      120,
    );

    await expect(
      verifyRoomToken("another-secret-that-is-also-long-enough", token),
    ).rejects.toThrow();
  });

  it("refuses a short secret", async () => {
    await expect(
      signRoomToken("too-short", { sub: "a", room: "abc123", role: "editor" }, 60),
    ).rejects.toThrow(/at least 32/);
  });
});

describe("slugify", () => {
  it("produces download-safe names", () => {
    expect(slugify("Two-pointer review!")).toBe("two-pointer-review");
    expect(slugify("   ")).toBe("snippet");
  });
});
