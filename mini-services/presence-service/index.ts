import { createServer } from "http";
import { Server } from "socket.io";

/**
 * presence-service - NEXUS "builders on grid" live counter.
 * Tracks connected sockets and broadcasts the fleet size to everyone.
 * Deliberately tiny: one number, pushed on every join/leave + a 15s heartbeat.
 */

const httpServer = createServer();
const io = new Server(httpServer, {
  // DO NOT change the path, it is used by Caddy to forward the request to the correct port
  path: "/",
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

let peak = 0;

function broadcast() {
  const count = io.engine.clientsCount;
  if (count > peak) peak = count;
  io.emit("presence", { count, peak, at: Date.now() });
}

io.on("connection", (socket) => {
  broadcast();

  // clients may report activity bursts (e.g. command palette open) - ack unused,
  // kept for future per-room features
  socket.on("activity", () => {
    /* reserved */
  });

  socket.on("disconnect", () => broadcast());
  socket.on("error", (err) => console.error(`socket error (${socket.id}):`, err));
});

const PORT = 3003;
httpServer.listen(PORT, () => {
  console.log(`presence service running on port ${PORT}`);
});

// REST sidecar for the OPS console: /api/admin/stats proxies this (server-side
// only - never exposed through the gateway). Separate port because socket.io
// owns every request path on the main server.
const STATS_PORT = 3004;
createServer((_req, res) => {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ count: io.engine.clientsCount, peak, at: Date.now() }));
}).listen(STATS_PORT, () => {
  console.log(`presence stats sidecar listening on ${STATS_PORT}`);
});

process.on("SIGTERM", () => {
  httpServer.close(() => process.exit(0));
});
