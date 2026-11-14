# Cyberpunk Story Sandbox

A local page for reading, playing, checking and judging uma-cyberpunk's story: the worlds, the chapters and their
scenes, the battles' briefs, the cast, the Log and the Calls. It's the sibling of uma-quest's and uma-farm's Story
Sandboxes. The design and its calls (SX1–SX12) are in [docs/design/story-sandbox.md](../../docs/design/story-sandbox.md).

```bash
pnpm stories:import-cast   # once, and after a Ranker pass: names and faces by id (private)
pnpm stories               # http://127.0.0.1:4322
```

- **The game's own code:** the server reads `content/stories/` with `packages/domain/src/story/` (the parser, the
  check, the stand-in) and `scripts/story/files.ts`, so the page shows exactly what `pnpm story:check` reports and what
  the game plays. With no story there yet, it shows the game's invented stand-in.
- **Edit and come back:** the server reads the files on every request, and the page reloads them when it regains focus.
- **Private content only:** the story, the cast pack (`content/stories/cast-pack/`) and the verdicts
  (`content/stories/reviews.json`) are in the ignored `content/`. The code holds no name or line of story.
- **Safety:** binds to 127.0.0.1, refuses other hosts, a same-origin content policy, images served only when the cast
  pack lists them, and the only write is `reviews.json`, from the page itself.
- **Bibles** (`#/bibles`, D30): the story session's private `content/stories/bibles/*.md` (the casting's reasons, each
  world's bible), the casting first and then the worlds in the Circuit's order, rendered by the page's small Markdown
  reader as DOM nodes, each with a verdict box.
- **Sprites** (`#/sprites`, D24): ChatGPT's combat sprite sheets from `content/design/character-looks/combat-masters/`,
  cut by the request's grid and measured, on a night tile at the phone's size beside her approved chibi (read from
  uma-platform's private `content/authoring/sprites/`). `UMA_CYBER_SPRITES` and `UMA_PLATFORM_SPRITES` move them.
- **Tests:** `lib/model.test.mjs`, `lib/sprites.test.mjs` and `import-cast.test.mjs` (invented records), part of `pnpm test`.

`UMA_CYBER_STORY_PORT` changes the port and `UMA_CYBER_STORIES` the story folder; the import reads
`UMA_RANKER_PLAN` (default `../uma-platform/content/authoring/tiers/plan.json`, from `pnpm ranker:pull` there) and
`UMA_QUEST_STORIES` (default `../uma-quest/content/stories`).
