---
status: accepted
---

# An aside is a piece of session state with a lifecycle, not a request to Claude

When the person presses Wait what, Show me or ELI5, the browser records an aside in the Store as `requested`; it does not call anything. `wait_for_answers` notices it, hands it to Claude and marks it `claimed`; `post_aside` marks it `resolved` (or `failed`). Two rules follow from treating it as state. First, requests are coalesced: while an aside for a given question and kind is requested or claimed, pressing the button again returns the existing one instead of queueing another, so an impatient click can never make Claude produce the same explanation twice. Second, only `requested` asides are handed out, so the same aside is never delivered to two consecutive polls, and the browser can show "Claude is on it" from the `claimed` status alone. The alternative (an RPC from browser to Claude with a callback) would break the seam in ADR-0001 and could not survive a browser reload mid-aside. Resolved asides stay in the session so a reopened panel shows them again without asking Claude.
