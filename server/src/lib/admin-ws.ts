import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";
import { logger } from "./logger.js";

let wss: WebSocketServer | null = null;
const adminClients = new Set<WebSocket>();

export function initAdminWs(server: Server): WebSocketServer {
  wss = new WebSocketServer({ server, path: "/ws/admin" });

  wss.on("connection", (ws) => {
    adminClients.add(ws);
    logger.info("Admin WS connected", { clients: adminClients.size });
    ws.on("close", () => {
      adminClients.delete(ws);
      logger.info("Admin WS disconnected", { clients: adminClients.size });
    });
    ws.on("error", (err) => logger.error("Admin WS error", { error: err.message }));
  });

  return wss;
}

export function closeAdminWs(): void {
  if (wss) {
    wss.close();
    wss = null;
  }
  adminClients.clear();
}

export function broadcastAdmin(event: string, data: unknown): void {
  const msg = JSON.stringify({ event, data });
  let sent = 0;
  for (const ws of adminClients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
      sent++;
    }
  }
  if (sent > 0) logger.debug("Admin WS broadcast", { event, clients: sent });
}
