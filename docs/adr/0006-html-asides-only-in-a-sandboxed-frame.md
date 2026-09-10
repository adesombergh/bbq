---
status: accepted
---

# Claude-produced HTML renders only inside a script-less sandboxed frame; markdown never carries raw HTML

Show me and ELI5 asides are HTML fragments written by Claude. The browser renders them in an `<iframe sandbox="allow-same-origin">` with its own stylesheet and no scripts, and the markdown renderer used for everything else keeps raw HTML escaped. This is a boundary decision, not a rendering detail: the aside `format` is part of the tool protocol, and any future richer aside (interactive, scripted) must stay inside the frame or get a new format rather than loosening either rule.

Amended: the aside _kind_ no longer fixes the format. When `show-me` became an external, markdown-first skill, a Show me stopped being reliably HTML, so Claude names the format on each `post_aside` call to match what it actually produced. The boundary is untouched — HTML still renders only in the frame, and markdown still escapes raw HTML; what changed is who chooses, not where HTML is allowed to go.
