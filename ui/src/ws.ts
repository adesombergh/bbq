import { useCallback, useEffect, useRef, useState } from "react";
import type { ClientMessage, ServerMessage, Session } from "../../src/types.ts";

export type ConnState = "connecting" | "open" | "closed";

/** Connects to the hub for one session and mirrors its state. Reconnects with backoff. */
export function useSession(sessionId: string) {
  const [session, setSession] = useState<Session | null>(null);
  const [conn, setConn] = useState<ConnState>("connecting");
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let alive = true;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      if (!alive) return;
      setConn("connecting");
      const proto = location.protocol === "https:" ? "wss" : "ws";
      const ws = new WebSocket(`${proto}://${location.host}/ws?session=${encodeURIComponent(sessionId)}`);
      wsRef.current = ws;
      ws.onopen = () => {
        attempt = 0;
        setConn("open");
      };
      ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data) as ServerMessage;
        if (msg.type === "state") setSession(msg.session);
        else if (msg.type === "error") {
          setError(msg.message);
          setTimeout(() => setError(null), 4000);
        }
      };
      ws.onclose = () => {
        if (!alive) return;
        setConn("closed");
        attempt++;
        timer = setTimeout(connect, Math.min(10_000, 500 * 2 ** Math.min(attempt, 5)));
      };
      ws.onerror = () => ws.close();
    };
    connect();
    return () => {
      alive = false;
      clearTimeout(timer);
      wsRef.current?.close();
    };
  }, [sessionId]);

  const send = useCallback((msg: ClientMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
    else setError("Not connected to the hub");
  }, []);

  return { session, conn, error, send };
}
