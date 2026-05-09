// server.js — NovaSaaS Support Bot + Supabase
// npm install express cors @anthropic-ai/sdk @supabase/supabase-js dotenv

const express = require("express");
const cors = require("cors");
const Anthropic = require("@anthropic-ai/sdk");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const app = express();
const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const ws = require("ws");
const db = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    realtime: { transport: ws }
  }
);
app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));
app.use(express.json());

// ── System Prompt ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `
You are Aria, a professional customer support agent for NovaSaaS — a CRM & Sales platform.

KNOWLEDGE BASE:
- Starter: $29/month — 3 users, 1,000 contacts
- Pro: $79/month — 15 users, 50,000 contacts, API access, priority support
- Enterprise: Custom pricing — unlimited everything, SSO, dedicated manager
- Free 14-day trial. Annual billing saves 20%.
- Password reset: novasaas.com/login → "Forgot password"
- Billing issues: check spam for receipt; escalate to support@novasaas.com
- Export: Settings → Data → Export
- Support: support@novasaas.com | help.novasaas.com

ESCALATION: If user is frustrated, angry, mentions refunds, data loss, or asks for a human — end with [COLLECT_EMAIL]. Only once per conversation.
TONE: Professional, formal, empathetic. Concise structured responses.
`;

// ── POST /api/chat ────────────────────────────────────────────────────────────
app.post("/api/chat", async (req, res) => {
  const { messages, session_id } = req.body;

  if (!messages || !Array.isArray(messages) || !session_id) {
    return res.status(400).json({ error: "messages and session_id are required" });
  }

  try {
    // 1. Get AI reply
    const response = await ai.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages,
    });

    const reply = response.content[0].text;

    // 2. Save the latest user message + reply to chat_logs
    const lastUserMsg = messages[messages.length - 1];
    await db.from("chat_logs").insert([
      { session_id, role: "user", content: lastUserMsg.content },
      { session_id, role: "assistant", content: reply },
    ]);

    res.json({ reply });

  } catch (err) {
    console.error("Chat error:", err.message);
    res.status(500).json({ error: "AI service error. Please try again." });
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

    console.log(`📧 Lead saved: ${name} <${email}>`);
    res.json({ success: true });

  } catch (err) {
    console.error("Lead error:", err.message);
    res.status(500).json({ error: "Could not save lead." });
  }
});

// ── GET /api/leads ────────────────────────────────────────────────────────────
// Protected admin endpoint — add auth middleware in production
app.get("/api/leads", async (req, res) => {
  const { data, error } = await db
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ leads: data });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
