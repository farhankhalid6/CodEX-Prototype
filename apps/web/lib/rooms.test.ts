import { describe, expect, it } from "vitest";
import { resolveAccess, type RoomRow } from "./rooms";

const room: Pick<RoomRow, "owner_id" | "visibility" | "read_only_slug" | "expires_at"> = {
  owner_id: null,
  visibility: "public-link",
  read_only_slug: "abc123def456abc123def456",
  expires_at: null,
};

describe("resolveAccess", () => {
  it("grants viewer for a valid read-only view key", () => {
    expect(resolveAccess(room, null, room.read_only_slug)).toBe("viewer");
  });

  it("denies a wrong view key on a read-only public link", () => {
    expect(resolveAccess(room, null, "tampered-view-key")).toBeNull();
  });

  it("grants editor on a public-link room without a view key", () => {
    expect(resolveAccess(room, null, null)).toBe("editor");
  });

  it("grants owner to the signed-in owner", () => {
    expect(resolveAccess({ ...room, owner_id: "user-1" }, "user-1", null)).toBe("owner");
  });
});
