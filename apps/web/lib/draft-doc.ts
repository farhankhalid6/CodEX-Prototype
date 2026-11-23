const DRAFT_KEY_PREFIX = "codeshare:prototype-draft:";

function draftKey(roomSlug: string, clientId: string): string {
  return `${DRAFT_KEY_PREFIX}${roomSlug}:${clientId}`;
}

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadLocalCode(roomSlug: string, clientId: string): string {
  const store = clientId ? storage() : null;
  if (!store) return "";

  try {
    return store.getItem(draftKey(roomSlug, clientId)) ?? "";
  } catch {
    return "";
  }
}

export function saveLocalCode(roomSlug: string, clientId: string, code: string): void {
  const store = clientId ? storage() : null;
  if (!store) return;

  try {
    store.setItem(draftKey(roomSlug, clientId), code);
  } catch {}
}
