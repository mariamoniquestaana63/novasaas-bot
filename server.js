// server.js — NovaSaaS AI OS (Kernel-based)
const express = require("express");
const cors = require("cors");
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

// Platform routes
const tenantsRouter = require("./src/routes/tenants");
const analyticsRouter = require("./src/routes/analytics");
const { trackUsage } = require("./src/middleware/tenantAuth");

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));
app.use(express.json());

// Platform info endpoint
app.get("/", (req, res) => {
  res.json({
    name: "NovaSaaS AI OS",
    version: "1.0.0",
    description: "Scalable multi-tenant AI platform — unlimited tenants, near-zero marginal cost",
    endpoints: {
      chat: "POST /api/chat",
      leads: "POST /api/leads",
      tenants: "/api/tenants",
      analytics: "/api/analytics",
      marketplace: "/api/tenants/marketplace",
      knowledge: "/api/tenants/knowledge"
    },
    signup: "POST /api/tenants/signup"
  });
});

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

// Mount platform routers
app.use("/api/tenants", tenantsRouter);
app.use("/api/analytics", analyticsRouter);

// ── POST /api/chat ────────────────────────────────────────────────────────────
app.post("/api/chat", async (req, res) => {
  const { messages, session_id } = req.body;
  // Optional tenant identification via API key (demo mode if absent)
  const apiKey = req.headers['x-api-key'] || req.query.api_key;

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

    // 3. Track usage if tenant API key provided
    if (apiKey && result.usage) {
      const tenantLookup = await db
        .from('tenants')
        .select('id')
        .eq('api_key', apiKey)
        .eq('is_active', true)
        .single();
      if (tenantLookup.data) {
        const tokensUsed = (result.usage.input_tokens || 0) + (result.usage.output_tokens || 0);
        trackUsage(tenantLookup.data.id, 'chat', tokensUsed).catch(() => {});
      }
    }

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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ AI OS Server running on port ${PORT}`));
