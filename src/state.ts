/**
 * In-memory session state. This is the seam of the whole design:
 * - the MCP tools (src/mcp.ts) only ever read/mutate state and `waitFor` changes,
 * - the WS hub (src/hub.ts) only subscribes to state and applies client messages.
 * Neither side knows about the other.
 */
import type {
  Answer,
  Aside,
  AsideKind,
  ClientMessage,
  Note,
  Question,
  Round,
  Session,
} from "./types.ts";

export class StateError extends Error {}

type Listener = (session: Session) => void;

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

export interface QuestionInput {
  id?: string;
  title: string;
  body: string;
  options?: { id?: string; label: string; description?: string }[];
  recommendation: string;
  recommendedOptionId?: string;
}

export class Store {
  private sessions = new Map<string, Session>();
  private listeners = new Map<string, Set<Listener>>();

  /* ---------- sessions ---------- */

  createSession(title: string): Session {
    const session: Session = {
      id: newId("s"),
      title,
      status: "open",
      createdAt: Date.now(),
      rounds: [],
      asides: [],
      notes: [],
      clients: 0,
    };
    this.sessions.set(session.id, session);
    return session;
  }

  get(sessionId: string): Session {
    const s = this.sessions.get(sessionId);
    if (!s) throw new StateError(`Unknown session ${sessionId}`);
    return s;
  }

  has(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  list(): Session[] {
    return [...this.sessions.values()];
  }

  closeSession(sessionId: string): Session {
    const s = this.get(sessionId);
    if (s.status === "open") {
      s.status = "closed";
      s.closedAt = Date.now();
      this.emit(s);
    }
    return s;
  }

  setClients(sessionId: string, delta: number): Session {
    const s = this.get(sessionId);
    s.clients = Math.max(0, s.clients + delta);
    this.emit(s);
    return s;
  }

  /* ---------- rounds ---------- */

  addRound(sessionId: string, questions: QuestionInput[], intro?: string): Round {
    const s = this.get(sessionId);
    if (s.status !== "open") throw new StateError("Session is closed");
    if (questions.length === 0) throw new StateError("A round needs at least one question");
    const open = s.rounds.find((r) => r.status === "open");
    if (open) throw new StateError(`Round ${open.id} is still open; wait for it before asking another`);

    const roundIndex = s.rounds.length + 1;
    const qs: Question[] = questions.map((q, i) => {
      const options = (q.options ?? []).map((o, j) => ({
        id: o.id ?? String.fromCharCode(97 + j), // a, b, c...
        label: o.label,
        description: o.description,
      }));
      const ids = new Set(options.map((o) => o.id));
      if (ids.size !== options.length) throw new StateError(`Duplicate option ids in question ${i + 1}`);
      if (q.recommendedOptionId && !ids.has(q.recommendedOptionId)) {
        throw new StateError(
          `Question ${i + 1}: recommendedOptionId "${q.recommendedOptionId}" is not one of the options`,
        );
      }
      return {
        id: q.id ?? `r${roundIndex}q${i + 1}`,
        title: q.title,
        body: q.body,
        options,
        recommendation: q.recommendation,
        recommendedOptionId: q.recommendedOptionId,
      };
    });
    const qids = new Set(qs.map((q) => q.id));
    if (qids.size !== qs.length) throw new StateError("Duplicate question ids");

    const round: Round = {
      id: newId("r"),
      index: roundIndex,
      intro,
      questions: qs,
      answers: {},
      status: "open",
      createdAt: Date.now(),
    };
    s.rounds.push(round);
    this.emit(s);
    return round;
  }

  getRound(sessionId: string, roundId: string): Round {
    const r = this.get(sessionId).rounds.find((r) => r.id === roundId);
    if (!r) throw new StateError(`Unknown round ${roundId}`);
    return r;
  }

  /** Find the session owning a round. */
  findRound(roundId: string): { session: Session; round: Round } {
    for (const session of this.sessions.values()) {
      const round = session.rounds.find((r) => r.id === roundId);
      if (round) return { session, round };
    }
    throw new StateError(`Unknown round ${roundId}`);
  }

  /**
   * Gating rule: question N can be answered only once every earlier question
   * in the round has an answer. Changing an already-answered question is
   * always allowed while the round is open.
   */
  canAnswer(round: Round, questionId: string): boolean {
    if (round.status !== "open") return false;
    const idx = round.questions.findIndex((q) => q.id === questionId);
    if (idx < 0) return false;
    return round.questions.slice(0, idx).every((q) => round.answers[q.id] !== undefined);
  }

  setAnswer(sessionId: string, roundId: string, questionId: string, answer: Omit<Answer, "answeredAt">): Round {
    const s = this.get(sessionId);
    const round = this.getRound(sessionId, roundId);
    if (round.status !== "open") throw new StateError("Round already submitted");
    const q = round.questions.find((q) => q.id === questionId);
    if (!q) throw new StateError(`Unknown question ${questionId}`);
    if (!this.canAnswer(round, questionId)) throw new StateError("Answer the previous questions first");

    let resolved: Answer = { ...answer, answeredAt: Date.now() };
    if (answer.kind === "recommended") {
      resolved = q.recommendedOptionId
        ? {
            kind: "recommended",
            optionId: q.recommendedOptionId,
            text: q.options.find((o) => o.id === q.recommendedOptionId)?.label ?? q.recommendation,
            answeredAt: resolved.answeredAt,
          }
        : { kind: "recommended", text: q.recommendation, answeredAt: resolved.answeredAt };
    } else if (answer.kind === "option") {
      const opt = q.options.find((o) => o.id === answer.optionId);
      if (!opt) throw new StateError(`Unknown option ${answer.optionId}`);
      resolved = { kind: "option", optionId: opt.id, text: opt.label, answeredAt: resolved.answeredAt };
    } else if (!answer.text.trim()) {
      throw new StateError("Empty answer");
    }
    round.answers[questionId] = resolved;
    this.emit(s);
    return round;
  }

  clearAnswer(sessionId: string, roundId: string, questionId: string): Round {
    const s = this.get(sessionId);
    const round = this.getRound(sessionId, roundId);
    if (round.status !== "open") throw new StateError("Round already submitted");
    delete round.answers[questionId];
    this.emit(s);
    return round;
  }

  isComplete(round: Round): boolean {
    return round.questions.every((q) => round.answers[q.id] !== undefined);
  }

  submitRound(sessionId: string, roundId: string): Round {
    const s = this.get(sessionId);
    const round = this.getRound(sessionId, roundId);
    if (round.status !== "open") return round;
    if (!this.isComplete(round)) throw new StateError("Answer every question before submitting");
    round.status = "submitted";
    round.submittedAt = Date.now();
    this.emit(s);
    return round;
  }

  /* ---------- asides (wait-what / show-me / eli5) ---------- */

  requestAside(sessionId: string, roundId: string, questionId: string, kind: AsideKind): Aside {
    const s = this.get(sessionId);
    const round = this.getRound(sessionId, roundId);
    if (!round.questions.some((q) => q.id === questionId)) throw new StateError(`Unknown question ${questionId}`);
    // Coalesce: one in-flight aside per (question, kind).
    const existing = s.asides.find(
      (a) => a.questionId === questionId && a.kind === kind && (a.status === "requested" || a.status === "claimed"),
    );
    if (existing) return existing;
    const aside: Aside = {
      id: newId("a"),
      roundId,
      questionId,
      kind,
      status: "requested",
      requestedAt: Date.now(),
    };
    s.asides.push(aside);
    this.emit(s);
    return aside;
  }

  /** Mark an aside as being worked on by Claude (so the UI can show progress). */
  claimAside(sessionId: string, asideId: string): Aside {
    const s = this.get(sessionId);
    const a = this.getAside(sessionId, asideId);
    if (a.status === "requested") {
      a.status = "claimed";
      this.emit(s);
    }
    return a;
  }

  resolveAside(sessionId: string, asideId: string, format: "markdown" | "html", content: string): Aside {
    const s = this.get(sessionId);
    const a = this.getAside(sessionId, asideId);
    a.status = "resolved";
    a.format = format;
    a.content = content;
    a.resolvedAt = Date.now();
    this.emit(s);
    return a;
  }

  failAside(sessionId: string, asideId: string, error: string): Aside {
    const s = this.get(sessionId);
    const a = this.getAside(sessionId, asideId);
    a.status = "failed";
    a.error = error;
    a.resolvedAt = Date.now();
    this.emit(s);
    return a;
  }

  getAside(sessionId: string, asideId: string): Aside {
    const a = this.get(sessionId).asides.find((a) => a.id === asideId);
    if (!a) throw new StateError(`Unknown aside ${asideId}`);
    return a;
  }

  pendingAsides(sessionId: string): Aside[] {
    return this.get(sessionId).asides.filter((a) => a.status === "requested");
  }

  /* ---------- notes ---------- */

  addNote(sessionId: string, markdown: string): Note {
    const s = this.get(sessionId);
    const note: Note = { id: newId("n"), markdown, createdAt: Date.now() };
    s.notes.push(note);
    this.emit(s);
    return note;
  }

  /* ---------- WS client messages ---------- */

  /** Apply a message coming from a browser. Throws StateError on invalid input. */
  apply(sessionId: string, msg: ClientMessage): void {
    switch (msg.type) {
      case "answer":
        this.setAnswer(sessionId, msg.roundId, msg.questionId, msg.answer);
        return;
      case "clear_answer":
        this.clearAnswer(sessionId, msg.roundId, msg.questionId);
        return;
      case "submit_round":
        this.submitRound(sessionId, msg.roundId);
        return;
      case "request_aside":
        this.requestAside(sessionId, msg.roundId, msg.questionId, msg.kind);
        return;
      default:
        throw new StateError(`Unknown message type ${(msg as { type: string }).type}`);
    }
  }

  /* ---------- subscriptions ---------- */

  subscribe(sessionId: string, fn: Listener): () => void {
    let set = this.listeners.get(sessionId);
    if (!set) {
      set = new Set();
      this.listeners.set(sessionId, set);
    }
    set.add(fn);
    return () => {
      set!.delete(fn);
    };
  }

  private emit(session: Session): void {
    const set = this.listeners.get(session.id);
    if (!set) return;
    for (const fn of set) {
      try {
        fn(session);
      } catch (err) {
        console.error("[grill-ui] listener error", err);
      }
    }
  }

  /**
   * Resolve as soon as `predicate(session)` returns a non-undefined value, or
   * with `undefined` after `timeoutMs`. Checks immediately first. This is the
   * only blocking primitive the MCP tools use, and it never outlives its timeout.
   */
  waitFor<T>(sessionId: string, predicate: (s: Session) => T | undefined, timeoutMs: number): Promise<T | undefined> {
    const now = predicate(this.get(sessionId));
    if (now !== undefined) return Promise.resolve(now);
    return new Promise((resolve) => {
      let done = false;
      const finish = (v: T | undefined) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        unsub();
        resolve(v);
      };
      const unsub = this.subscribe(sessionId, (s) => {
        const v = predicate(s);
        if (v !== undefined) finish(v);
      });
      const timer = setTimeout(() => finish(undefined), timeoutMs);
    });
  }
}
