import { WebSocketServer } from "ws";
import { Server } from "http";
export declare function initAdminWs(server: Server): WebSocketServer;
export declare function closeAdminWs(): void;
export declare function broadcastAdmin(event: string, data: unknown): void;
//# sourceMappingURL=admin-ws.d.ts.map