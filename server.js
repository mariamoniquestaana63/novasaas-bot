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

/**
 * Creates and configures the Express application.
 * Accepts injected dependencies so the app can be tested without real
 * Supabase / Anthropic connections.
 * @param {object} kernel - Initialised Kernel instance.
 * @param {object} contextBroker - Initialised ContextBroker instance.
 * @param {object} db - Supabase database client.
 * @returns {import('express').Application}
 */
function createApp(kernel, contextBroker, db) {
  const app = express();
  app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));
  app.use(express.json());

  // ── POST /api/chat ──────────────────────────────────────────────────────────
  app.post("/api/chat", async (req, res) => {
    const { messages, session_id } = req.body;

    if (!messages || !Array.isArray(messages) || !session_id) {
      return res.status(400).json({ error: "messages and session_id are required" });
    }

    try {
      const result = await kernel.dispatch({ messages }, { session_id });
      const reply = result.reply;

      const lastUserMsg = messages[messages.length - 1];
      await contextBroker.saveMessage(session_id, "user", lastUserMsg.content);
      await contextBroker.saveMessage(session_id, "assistant", reply);

      res.json({ reply, agent: result.agent });
    } catch (err) {
      console.error("Kernel Dispatch error:", err.message);
      res.status(500).json({ error: "AI OS error. Please try again." });
    }
  });

  // ── POST /api/leads ─────────────────────────────────────────────────────────
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

  // ── GET /api/leads ──────────────────────────────────────────────────────────
  app.get("/api/leads", async (req, res) => {
    const { data, error } = await db
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json({ leads: data });
  });

  return app;
}

module.exports = { createApp };

// Only bootstrap and start the server when run directly (not during tests)
if (require.main === module) {
  const db = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    { realtime: { transport: ws } }
  );

  const contextBroker = new ContextBroker(db, { maxContextMessages: 10 });
  const blackboard = new Blackboard(db);
  const toolGateway = new MCPToolGateway();

  const kernel = new Kernel();
  kernel.setContextBroker(contextBroker);
  kernel.setBlackboard(blackboard);
  kernel.setToolGateway(toolGateway);
  kernel.registerAgent(new SupportAgent());
  kernel.registerAgent(new SalesAgent());
  kernel.registerAgent(new ManagerAgent());

  const app = createApp(kernel, contextBroker, db);
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`✅ AI OS Server running on port ${PORT}`));
}
