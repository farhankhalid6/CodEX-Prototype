const CLIENT_ID_KEY = "codeshare:clientId";
const DISPLAY_NAME_KEY = "codeshare:name";
const THEME_KEY = "codeshare:theme";
const LANGUAGE_KEY_PREFIX = "codeshare:prototype-language:";

export function getClientId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(CLIENT_ID_KEY);
  if (!id) {
    id = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    window.localStorage.setItem(CLIENT_ID_KEY, id);
  }
  return id;
}

export function getDisplayName(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(DISPLAY_NAME_KEY) ?? "";
}

export function setDisplayName(name: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DISPLAY_NAME_KEY, name);
}

export function getStoredTheme(): "dark" | "light" {
  if (typeof window === "undefined") return "dark";
  return window.localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
}

export function setStoredTheme(theme: "dark" | "light"): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(THEME_KEY, theme);
}

export function getStoredLanguage(roomSlug: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(`${LANGUAGE_KEY_PREFIX}${roomSlug}`);
}

export function setStoredLanguage(roomSlug: string, language: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`${LANGUAGE_KEY_PREFIX}${roomSlug}`, language);
}
