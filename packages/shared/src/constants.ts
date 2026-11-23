export const ROOM_ID_LENGTH = 9;

export const ROOM_ID_PATTERN = /^[A-Za-z0-9_-]{6,64}$/;

export const MAX_CODE_CHARS = 200_000;

export const MAX_UPDATE_BYTES = 512 * 1024;

export const MAX_AI_INPUT_CHARS = 8_000;

export const AI_ACTIONS = ["explain", "bugs", "comments"] as const;
export type AiAction = (typeof AI_ACTIONS)[number];

export const AI_ACTION_LABELS: Record<AiAction, string> = {
  explain: "Explain",
  bugs: "Find bugs",
  comments: "Add comments",
};

export const AI_ACTION_HINTS: Record<AiAction, string> = {
  explain: "Walk through what this code does, step by step.",
  bugs: "Look for correctness bugs, edge cases and unsafe assumptions.",
  comments: "Suggest doc comments and inline comments worth adding.",
};

export const PRESENCE_COLORS = [
  "#0a84ff",
  "#32d74b",
  "#ff453a",
  "#bf5af2",
  "#ff9f0a",
  "#30d158",
  "#64d2ff",
  "#ff375f",
] as const;

export const ROOM_TOKEN_TTL_SECONDS = 2 * 60 * 60;

export const ANON_ROOM_TTL_DAYS = 7;
export const AI_REQUEST_RETENTION_DAYS = 90;

export const DEFAULT_ROOM_TITLE = "Untitled snippet";

export const Y_TEXT_KEY = "content";

export const Y_META_KEY = "meta";

export const Y_CHAT_KEY = "chat";

export const ROOM_ACCESS_LEVELS = ["viewer", "commentor", "editor"] as const;
export type RoomAccessLevel = (typeof ROOM_ACCESS_LEVELS)[number];

export const ACCESS_LEVEL_LABELS: Record<RoomAccessLevel, string> = {
  viewer: "Viewer — read only",
  commentor: "Commentor — chat only",
  editor: "Editor — can edit code",
};

export const SHARE_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

export const CHAT_MESSAGE_MAX_CHARS = 500;
export const CHAT_KEEP_PER_ROOM = 200;
