import { useEffect, useRef, useState } from "react";

type WsEvent = { event: string; data: unknown };
export type WsStatus = "connected" | "disconnected" | "connecting";

export function useAdminWs(onEvent: (ev: WsEvent) => void): WsStatus {
  const wsRef = useRef<WebSocket | null>(null);
  const onEventRef = useRef(onEvent);
  const [status, setStatus] = useState<WsStatus>("connecting");
  onEventRef.current = onEvent;

  useEffect(() => {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${proto}//${window.location.host}/ws/admin`;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    function connect() {
      setStatus("connecting");
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => setStatus("connected");

      ws.onmessage = (msg) => {
        try {
          onEventRef.current(JSON.parse(msg.data));
        } catch {}
      };

      ws.onclose = () => {
        wsRef.current = null;
        setStatus("disconnected");
        reconnectTimer = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
      wsRef.current = null;
    };
  }, []);

  return status;
}
