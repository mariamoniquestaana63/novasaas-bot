// server.js — NovaSaaS AI OS (Kernel-based)
const express = require("express");
const cors = require("cors");
const http = require("http");
const { createClient } = require("@supabase/supabase-js");
const ws = require("ws");
require("dotenv").config();

// AI OS Core
const Kernel = require("./src/os-core/Kernel");
const ContextBroker = require("./src/os-core/ContextBroker");
const Blackboard = require("./src/os-core/Blackboard");
const MCPToolGateway = require("./src/tools/MCPToolGateway");
const SupportAgent = require("./src/agents/SupportAgent");
const SalesAgent = require("./src/agents/SalesAgent");
const ManagerAgent = require("./src/agents/ManagerAgent");
const BinanceWebSocket = require("./src/tools/BinanceWebSocket");

// Auth & Billing
const authRoutes = require("./src/api/auth");
const billingRoutes = require("./src/api/billing");
const requireAuth = require("./src/middleware/requireAuth");
const requireSubscription = require("./src/middleware/requireSubscription");

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));

// Stripe webhook needs raw body — mount BEFORE express.json()
app.use("/api/billing/webhook", express.raw({ type: "application/json" }));

app.use(express.json());

// Initialize Supabase Client
const db = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    realtime: { transport: ws }
  }
);

// Initialize Context Broker
const contextBroker = new ContextBroker(db, {
  maxContextMessages: 10
});

// Initialize Blackboard
const blackboard = new Blackboard(db);

// Initialize MCP Tool Gateway
const toolGateway = new MCPToolGateway();

// Initialize Kernel and Agents
const kernel = new Kernel();
kernel.setContextBroker(contextBroker);
kernel.setBlackboard(blackboard);
kernel.setToolGateway(toolGateway);
kernel.registerAgent(new SupportAgent());
kernel.registerAgent(new SalesAgent());
kernel.registerAgent(new ManagerAgent());

// ── Health check (used by Railway) ────────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// ── Static frontend ───────────────────────────────────────────────────────────
app.use(express.static("public"));

// ── Auth & Billing routes ─────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/billing", billingRoutes);

// ── Binance live price feed ───────────────────────────────────────────────────
const defaultSymbols = (process.env.BINANCE_SYMBOLS || "btcusdt,ethusdt,bnbusdt,solusdt").split(",");
const binance = new BinanceWebSocket(defaultSymbols);

// ── POST /api/chat ────────────────────────────────────────────────────────────
app.post("/api/chat", requireAuth, requireSubscription, async (req, res) => {
  const { messages, session_id } = req.body;

  if (!messages || !Array.isArray(messages) || !session_id) {
    return res.status(400).json({ error: "messages and session_id are required" });
  }

  try {
    // 1. Dispatch to AI OS Kernel (Kernel now handles context enrichment via Broker)
    const result = await kernel.dispatch({ messages }, { session_id });
    const reply = result.reply;

    // 2. Save the latest user message + reply via Context Broker
    const lastUserMsg = messages[messages.length - 1];
    await contextBroker.saveMessage(session_id, "user", lastUserMsg.content);
    await contextBroker.saveMessage(session_id, "assistant", reply);

    res.json({ reply, agent: result.agent });

  } catch (err) {
    console.error("Kernel Dispatch error:", err.message);
    res.status(500).json({ error: "AI OS error. Please try again." });
  }
});

// ── POST /api/leads ───────────────────────────────────────────────────────────
app.post("/api/leads", async (req, res) => {
  const { name, email, session_id } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: "name and email are required" });
  }

  try {
    const { error } = await db.from("leads").insert([{ name, email, session_id }]);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error("Lead error:", err.message);
    res.status(500).json({ error: "Could not save lead." });
  }
});

// ── GET /api/leads ────────────────────────────────────────────────────────────
app.get("/api/leads", async (req, res) => {
  const { data, error } = await db
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ leads: data });
});

// ── GET /api/prices ───────────────────────────────────────────────────────────
// Returns the latest cached snapshot for all tracked symbols.
// Optional query param: ?symbol=BTCUSDT
app.get("/api/prices", (req, res) => {
  const { symbol } = req.query;
  if (symbol) {
    const data = binance.get(symbol);
    if (!data) return res.status(404).json({ error: `Symbol ${symbol} not found` });
    return res.json(data);
  }
  res.json(binance.getAll());
});

// ── WebSocket relay — ws://host/ws/prices ─────────────────────────────────────
// Clients connect and receive every price tick as a JSON message.
// Send { "subscribe": ["BTCUSDT","ETHUSDT"] } to filter; omit to receive all.
const server = http.createServer(app);
const wss = new ws.Server({ server, path: "/ws/prices" });

wss.on("connection", (client) => {
  let filter = null; // null = all symbols

  client.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw);
      if (Array.isArray(msg.subscribe)) {
        filter = msg.subscribe.map((s) => s.toUpperCase());
        // immediately push current prices for requested symbols
        filter.forEach((sym) => {
          const data = binance.get(sym);
          if (data) client.send(JSON.stringify(data));
        });
      }
    } catch {
      // ignore malformed control messages
    }
  });

  const onTick = (tick) => {
    if (client.readyState !== ws.OPEN) return;
    if (filter && !filter.includes(tick.symbol)) return;
    client.send(JSON.stringify(tick));
  };

  binance.on("tick", onTick);
  client.on("close", () => binance.off("tick", onTick));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`✅ AI OS Server running on port ${PORT}`));
