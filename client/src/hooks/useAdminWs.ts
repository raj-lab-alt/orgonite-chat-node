import { useEffect, useRef, useCallback } from "react";

type WsEvent = { event: string; data: unknown };

export function useAdminWs(onEvent: (ev: WsEvent) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${proto}//${window.location.host}/ws/admin`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onmessage = (msg) => {
      try {
        onEventRef.current(JSON.parse(msg.data));
      } catch {}
    };

    ws.onclose = () => {
      wsRef.current = null;
    };

    ws.onerror = () => {
      ws.close();
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, []);
}
