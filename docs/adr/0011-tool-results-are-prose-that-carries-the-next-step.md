---
status: accepted
---

# Tool results are prose for Claude: an `outcome:` line, the facts, then the next step to take

Every MCP tool returns plain text rather than structured JSON. The text opens with an `outcome:` line Claude can branch on (`answered`, `aside_requested`, `pending`, `closed`), then the facts in a readable form (answers with their titles, the question an aside is about, progress and tab count), then an explicit "Next: call …" instruction. An aside request even embeds a full brief for producing the aside when the named skill is not installed. We chose this over structured output because the reader is a language model, not a program: the skill file stays short, a new Claude session can drive a grilling from the tool results alone, and adjusting the protocol (the order of steps, the fallback briefs) is a copy edit in `src/mcp.ts` instead of a schema change on both sides. The price is that the tool results are not machine-parseable; anything that must be parsed (the browser protocol) stays in `src/protocol.ts` and `src/types.ts`.
