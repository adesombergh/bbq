---
status: accepted
---

# A session has at most one open round, and its questions are answered in order

Claude cannot publish a round while another is open, question N cannot be answered until questions 1..N-1 have answers, any answer can be changed until the round is sent, and a sent round is frozen for good. These rules are enforced in the Store, not only in the browser, and the pure predicates behind them (`canAnswer`, `isComplete`) are shared with the UI so both sides agree. We chose this strictness because a round _is_ a frontier: its questions are ordered so that a later one may lean on the answer to an earlier one, and Claude's next frontier is computed from a whole round, never from a trickle of single answers. Allowing parallel rounds or out-of-order answers would make "what has the user settled so far" ambiguous for both Claude and the person. The cost is that a person who wants to skip ahead cannot, and that Claude must wait for the round before asking anything new.
