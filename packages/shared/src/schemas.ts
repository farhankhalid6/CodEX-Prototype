import { z } from "zod";
import {
  AI_ACTIONS,
  DEFAULT_ROOM_TITLE,
  MAX_AI_INPUT_CHARS,
  ROOM_ACCESS_LEVELS,
  ROOM_ID_PATTERN,
} from "./constants.js";
import { DEFAULT_LANGUAGE, isLanguage, type Language } from "./languages.js";

export const roomIdSchema = z
  .string()
  .regex(ROOM_ID_PATTERN, "Room ids are 6-64 URL-safe characters");

export const languageSchema = z.custom<Language>((value) => isLanguage(value), {
  message: "Unsupported language",
});

export const visibilitySchema = z.enum(["public-link", "private"]);

export const createRoomSchema = z.object({
  title: z.string().trim().min(1).max(120).default(DEFAULT_ROOM_TITLE),
  language: languageSchema.default(DEFAULT_LANGUAGE),
  visibility: visibilitySchema.default("public-link"),
  expiresInDays: z.number().int().min(1).max(90).nullable().default(7),
  displayName: z.string().trim().min(1).max(40).optional(),
});

export const updateRoomSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    language: languageSchema,
    visibility: visibilitySchema,
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Nothing to update");

export const aiRequestSchema = z.object({
  roomId: roomIdSchema,
  code: z.string().min(1).max(MAX_AI_INPUT_CHARS),
  action: z.enum(AI_ACTIONS),
  language: languageSchema,
});

export const forkRoomSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
});

export const shareRequestSchema = z.object({
  access: z.enum(ROOM_ACCESS_LEVELS),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;
export type AiRequestInput = z.infer<typeof aiRequestSchema>;
