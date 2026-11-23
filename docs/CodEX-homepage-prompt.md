# CodEX Prototype home page — generator prompt

Copy the block below into any AI UI builder (v0, Lovable, Bolt, ChatGPT, Claude, etc.).

```text
Create a polished landing page for "CodEX Prototype", a minimal free code room with an AI explainer, email-free chat and explicit push/pull code sharing.

Style: dark, developer-first, modern SaaS. Deep navy/near-black background, subtle grid/glow, cyan + violet accents, Inter-like typography, generous whitespace, rounded cards, tasteful micro-interactions, responsive mobile-first. No stock-photo people; use a stylized code-editor mock UI instead.

Tone: confident but honest — "student-scale", free tier, no credit card, prototype scope.

Sections:
1. Sticky header: CodEX logo mark, links (Features, How it works, AI), "Sign in" and primary "Open a room" CTA.
2. Hero: headline "Code together. Share only when you're ready." Subtitle: "A private Monaco draft, live room chat, and a watsonx.ai side panel that explains any selection — the room code changes only when you push." CTA buttons: "Create a room" and "See how it works".
3. Product mock: a dark editor panel with one local draft labelled "Private", a right-hand panel with tabs AI / Chat / Push-Pull, and two large buttons "Push local code to room" and "Pull room code to local". Show read-only role badges: viewer, commentor, editor.
4. Feature grid (6 cards): Private local draft; Explicit push / pull; Live chat without email; AI explainer with per-user/IP limits; Expiring signed share links; Free stack — Vercel, Render, Supabase, IBM watsonx.ai.
5. "How it works" 3 steps: Open a link → Type locally → Push or pull when ready.
6. Safety strip: "AI output never auto-applies. Selected code is treated as untrusted. Rooms are scoped by signed tokens. RLS protects private data."
7. Language strip: "java · html · c · c++ · javascript · md · sql · text — 8 focused languages."
8. Scope strip: "No run button. No live preview. No versions. No branches or pull requests. Just the basics."
9. Stats row: "8 languages · 2 h room token · 1 realtime instance · $0/month to run".
10. Footer: CodEX · built on IBM Cloud · links to GitHub, docs and health status.

Constraints:
- Use the name "CodEX" in the product UI. The repository and infra identifiers may use codeshare-*.
- Buttons should link to the prototype deployment root, /login, /docs and /api/health. Do not invent a paid plan or custom domain.
- Do not claim coloured cursors, version history, snapshots, code execution, live preview, or automatic syncing.
- Keep copy factual; describe push/pull as manual and read-only AI output.
- Output a single responsive page with accessible semantics, keyboard-focus states and no external image dependencies.
```
