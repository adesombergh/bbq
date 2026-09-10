# Grilling

A grilling is a relentless, multi-round interview in which Claude stress-tests a person's plan until both sides share the same understanding of it. grill-ui moves that interview from the terminal into a browser page.

## Language

### The interview

**Session**:
One grilling of one plan, from the first round to the shared understanding. A session is either open or closed.
_Avoid_: conversation, chat, interview

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
A request, made on one question, for Claude to explain that question differently. An aside is requested, then claimed by Claude, then resolved or failed. Three kinds exist: Wait what, Show me, ELI5.
_Avoid_: help, hint, clarification

**Wait what**:
The aside that re-pitches a question in plain words with a little context.
_Avoid_: rephrase, simplify

**Show me**:
The aside that answers with a visual: a comparison, a flow, a sketch.
_Avoid_: diagram, illustration

**ELI5**:
The aside that explains a question as if the reader knew nothing about the topic, with pictures and everyday analogies.
_Avoid_: beginner mode, simple explanation

**Note**:
A free-form message from Claude shown between rounds: what the last answers settled, a lookup in progress, the shared understanding.
_Avoid_: comment, message, status
