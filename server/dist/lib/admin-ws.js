"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initAdminWs = initAdminWs;
exports.closeAdminWs = closeAdminWs;
exports.broadcastAdmin = broadcastAdmin;
const ws_1 = require("ws");
const logger_js_1 = require("./logger.js");
let wss = null;
const adminClients = new Set();
function initAdminWs(server) {
    wss = new ws_1.WebSocketServer({ server, path: "/ws/admin" });
    wss.on("connection", (ws) => {
        adminClients.add(ws);
        logger_js_1.logger.info("Admin WS connected", { clients: adminClients.size });
        ws.on("close", () => {
            adminClients.delete(ws);
            logger_js_1.logger.info("Admin WS disconnected", { clients: adminClients.size });
        });
        ws.on("error", (err) => logger_js_1.logger.error("Admin WS error", { error: err.message }));
    });
    return wss;
}
function closeAdminWs() {
    if (wss) {
        wss.close();
        wss = null;
    }
    adminClients.clear();
}
function broadcastAdmin(event, data) {
    const msg = JSON.stringify({ event, data });
    let sent = 0;
    for (const ws of adminClients) {
        if (ws.readyState === ws_1.WebSocket.OPEN) {
            ws.send(msg);
            sent++;
        }
    }
    if (sent > 0)
        logger_js_1.logger.debug("Admin WS broadcast", { event, clients: sent });
}
//# sourceMappingURL=admin-ws.js.map