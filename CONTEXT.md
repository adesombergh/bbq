# Grilling

A grilling is a relentless, multi-round interview in which Claude stress-tests a person's plan until both sides share the same understanding of it. bbq moves that interview from the terminal into a browser page.

## Language

### The interview

**Session**:
One grilling of one plan, from the first round to the shared understanding — or, for an **offload**, the stretch of another skill's run whose questions are asked in the browser. A session is either open or closed.
_Avoid_: conversation, chat, interview

**Session kind**:
What a session is for, fixed when it opens: a grilling, or an **offload**. Everything this glossary says about the frontier, the shared understanding and the destination is true of a grilling only.
_Avoid_: session type, flavour, mode

**Offload**:
A session that carries the questions of whatever skill Claude is already running — a brainstorming, a custom interview — while that skill's own flow stays in the terminal. Questions arrive one at a time as the skill asks them, a round sends itself on the answer that completes it, and the running skill, not bbq, owns the ending: an offload has no frontier, no last round and no destination.
_Avoid_: delegate, proxy, passthrough, questions mode

**Mode**:
Whether a session also tends the project's documents. Grill-me is the interview alone; grill-with-docs reads the glossary and the decision records to ground its questions, and writes new terms and decisions as they settle.
_Avoid_: profile, preset, docs mode

**Question budget**:
The maximum number of questions a session may put to the person. It counts questions inside rounds only: asides are free, the last round — the one that confirms the shared understanding and names the **destination** — is free, and a decision genuinely reopened counts again. Spent in full, it ends the session by naming the remaining decisions and the recommendation assumed for each.
_Avoid_: limit, quota, max questions

**Session language**:
The language of everything Claude writes to the person: questions, options, recommendations, notes and asides. It reaches no further — the browser's own words, the project's documents and its code stay as they are.
_Avoid_: locale, translation, i18n

**Design tree**:
The set of decisions a plan contains, where each decision branches into the decisions that depend on it.
_Avoid_: plan, outline

**Frontier**:
The decisions whose prerequisites are already settled, so they can be asked now without guessing at answers not yet heard.
_Avoid_: next questions, batch

**Round**:
One frontier put to the person at once. A round is open until every question has an answer and the person sends it; it is then submitted and frozen.
_Avoid_: step, page, turn

**Shared understanding**:
The end state of a session: a summary of every settled decision that the person confirms before any work starts. The press that confirms it also names the **destination**.
_Avoid_: conclusion, spec

**Destination**:
Where a confirmed plan goes when a grilling ends; an offload has none. Four exist and the set never changes: Claude's hands, `/implement`, `/to-spec`, `/to-tickets`. A destination is chosen by the same press that confirms the shared understanding, so it is an ordinary **answer** and nothing about it reaches the Store, the protocol or a **snapshot**. Three of the four are commands only the person can type; choosing one tells Claude what to set them up for, never what to start.
_Avoid_: hand-off, next step, export, outcome

**Debrief**:
What a session shows once it is closed: a short, honest account of how it went. A record and not a scoreboard — every number in it was chosen because it says something about the session, not because it flatters. Most of it is derived from the **snapshot** and so reads the same in any **tab**; the part that is not — how long the person was **away**, how long they spent on the **pastime** — is watched by one page and shown only when that page has been open since the session started. Like the pastime, a debrief reaches no Store, no protocol and no snapshot, and Claude never receives one.
_Avoid_: statistics, stats, summary, scorecard

### Inside a round

**Question**:
One decision of the frontier, with a title, a body, optional options and always a recommendation.
_Avoid_: item, prompt

**Option**:
One of the closed choices a question offers, identified by a short letter. A question with no options is an open question.
_Avoid_: choice, answer

**Recommendation**:
Claude's preferred answer to a question, always present. When it matches an option, it is the recommended option.
_Avoid_: default, suggestion

**Answer**:
The person's decision on one question: a chosen option, the recommendation taken as is, or a manual answer.
_Avoid_: response, reply, selection

**Pick**:
The option the person has pointed at and not yet confirmed. It reaches no further than the tab: the Store never sees it, the next question stays locked, the answer footer stays empty and the round stays incomplete until a second, explicit press turns it into an **answer**. One pick exists at a time, on the active question; leaving that question forgets it. Only options are picked — the recommendation and the manual answer are already deliberate acts, and answer in one press.
_Avoid_: selection, choice, draft answer, tentative answer

**Manual answer**:
An answer written in the person's own words instead of picking an option or the recommendation.
_Avoid_: free text, custom answer, comment

**Locked question**:
A question that cannot be answered yet because an earlier question in the same round has no answer.
_Avoid_: disabled question, pending question

**Sending a round**:
The person's act of handing a fully answered round back to Claude. Until then any answer can still be changed.
_Avoid_: submit, confirm, finish

### Around the questions

**Aside**:
A request, made on one question, for Claude to explain that question differently. An aside is requested, then claimed by Claude, then resolved or failed. Three kinds exist: Wait what, Show me, ELI5. The kind is what the person asked for; the format the answer comes back in is Claude's choice for that one aside, not a property of the kind.
_Avoid_: help, hint, clarification

**Wait what**:
The aside that re-pitches a question in plain words with a little context.
_Avoid_: rephrase, simplify

**Show me**:
The aside that answers with a visual: a comparison, a flow, a sketch. It may contain a diagram, but the two are not the same word.
_Avoid_: illustration, drawing

**Diagram**:
A picture the browser draws from source text inside an aside, rather than one Claude drew itself. Only asides may contain one.
_Avoid_: chart, graph, mermaid

**ELI5**:
The aside that explains a question as if the reader knew nothing about the topic, with pictures and everyday analogies.
_Avoid_: beginner mode, simple explanation

**Brief**:
The instructions a tool result carries for one aside kind: what to produce and, where a skill applies, which one and the exact command that installs it. A brief is the floor, not a fallback — every kind has one, an aside is always answered from it, and a skill only ever improves on it.
_Avoid_: prompt, template, fallback, instructions

**Aside skill**:
An optional skill that answers one kind of aside better than its brief. Aside skills are third party and per machine; bbq bundles none. Available means invocable by Claude, which is narrower than installed: a skill can be present and enabled and still unreachable.
_Avoid_: helper, integration, dependency

**Note**:
A free-form message from Claude shown between rounds: what the last answers settled, a lookup in progress, the shared understanding.
_Avoid_: comment, message, status

### The lull

**Lull**:
The stretch of a session with no open round, when nothing is expected of the person and they are waiting on Claude. It covers the wait before the first round as much as every wait between rounds. It is named apart from **wait** on purpose: a wait is Claude's bounded pause on a round, a lull is the same moment seen from the person's side of the seam.
_Avoid_: waiting state, idle, downtime, dead time

**Pastime**:
The small game the browser offers during a lull, to pass the time and nothing more. It belongs to the browser and not to the grilling: it never reaches the Store, the protocol or a snapshot, and it ends the instant a round opens. Snake is today's only pastime, and the word stays for the slot rather than for the game in it.
_Avoid_: game, minigame, easter egg, feature

**Away**:
The stretch a **tab** spent off screen, as that tab alone can see it. It is the third point of view on the same time: a **wait** is Claude's bounded pause, a **lull** is the person's side of it, and away is whether the person was there for it at all. Being hidden is the whole of it — a tab sitting visible beside an editor counts as present — and it is counted by watching rather than by knowing, so it lives in one page's memory and starts again from zero on a reload.
_Avoid_: idle, absent, AFK, inactive

### The machinery

**Store**:
The single record of every session on this machine. It is the one thing Claude and the browser both touch, and neither touches the other.
_Avoid_: database, backend, state manager, server state

**Hub**:
The part of the server the browser talks to: it hands out the page and relays snapshots to every tab of a session.
_Avoid_: web server, API, socket server

**Tool**:
One of the six named actions Claude can take on a session: open it, ask a round, wait, post an aside, post a note, close it.
_Avoid_: endpoint, command, call

**Snapshot**:
The whole of one session as the browser sees it at one moment. A tab only ever receives complete snapshots and replaces what it had.
_Avoid_: state, update, delta, patch, event

**Tab**:
One connected browser page showing a session. A session can have several tabs at once, all showing the same snapshot, or none.
_Avoid_: client, connection, socket, viewer

**Short title**:
The terse name of a session, two to four words, written for the browser tab where a full title does not fit. It defaults to the title and is capped in length.
_Avoid_: tab title, label, slug

**Wait**:
Claude's bounded pause on an open round. A wait ends with an outcome or, at its timeout, with pending, and Claude then waits again.
_Avoid_: block, long poll, subscription, listen

**Outcome**:
What a wait reports back to Claude: answered (the round was sent), aside requested, pending (nothing happened yet) or closed.
_Avoid_: result, status, response, event

**Requested aside**:
An aside the person has asked for and Claude has not yet been handed. Asking again for the same kind on the same question returns this one.
_Avoid_: pending aside, queued aside, open aside

**Claimed aside**:
An aside that has been handed to Claude and is being worked on. The person sees it as in progress until it is resolved or failed.
_Avoid_: in-flight aside, active aside, processing

**Rejection**:
The hub's refusal of a browser action that breaks a round rule, answered with the reason and a fresh snapshot so the tab snaps back.
_Avoid_: error, validation failure, conflict

**Token**:
The secret minted when the server starts that every tab must present to see a session. It travels once in the session link, then in a cookie.
_Avoid_: password, key, auth, credential
