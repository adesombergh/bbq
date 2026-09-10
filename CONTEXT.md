# Grilling

A grilling is a relentless, multi-round interview in which Claude stress-tests a person's plan until both sides share the same understanding of it. grill-ui moves that interview from the terminal into a browser page.

## Language

### The interview

**Session**:
One grilling of one plan, from the first round to the shared understanding. A session is either open or closed.
_Avoid_: conversation, chat, interview

**Mode**:
Whether a session also tends the project's documents. Grill-me is the interview alone; grill-with-docs reads the glossary and the decision records to ground its questions, and writes new terms and decisions as they settle.
_Avoid_: profile, preset, docs mode

**Question budget**:
The maximum number of questions a session may put to the person. It counts questions inside rounds only: asides are free, the final confirmation round is free, and a decision genuinely reopened counts again. Spent in full, it ends the session by naming the remaining decisions and the recommendation assumed for each.
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
The end state of a session: a summary of every settled decision that the person confirms before any work starts.
_Avoid_: conclusion, spec

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

**Note**:
A free-form message from Claude shown between rounds: what the last answers settled, a lookup in progress, the shared understanding.
_Avoid_: comment, message, status

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
