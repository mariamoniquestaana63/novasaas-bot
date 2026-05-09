(function () {
  "use strict";

  // ── Config ─────────────────────────────────────────────────────────────────
  const API_BASE = "https://novasaas-bot-production.up.railway.app";
  const BOT_NAME = "Aria";
  const BOT_ROLE = "NovaSaaS Support";
  const BRAND_CLR = "#6366f1";
  const SESSION_ID = "session_" + Math.random().toString(36).slice(2);

  // ── State ──────────────────────────────────────────────────────────────────
  let messages = [];
  let isOpen = false;
  let isLoading = false;
  let captureShown = false;

  // ── Inject Styles ──────────────────────────────────────────────────────────
  const style = document.createElement("style");
  style.textContent = `
    #aria-widget * { box-sizing: border-box; font-family: 'Segoe UI', sans-serif; margin: 0; padding: 0; }
    #aria-bubble {
      position: fixed; bottom: 24px; right: 24px; z-index: 99999;
      width: 56px; height: 56px; border-radius: 50%;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      box-shadow: 0 4px 20px rgba(99,102,241,0.45);
      cursor: pointer; border: none;
      display: flex; align-items: center; justify-content: center;
      transition: transform 0.2s;
    }
    #aria-bubble:hover { transform: scale(1.08); }
    #aria-bubble svg { width: 26px; height: 26px; }
    #aria-unread {
      position: absolute; top: -2px; right: -2px;
      background: #ef4444; color: #fff; font-size: 10px; font-weight: 700;
      border-radius: 50%; width: 18px; height: 18px;
      display: none; align-items: center; justify-content: center;
    }
    #aria-window {
      position: fixed; bottom: 90px; right: 24px; z-index: 99998;
      width: 360px; height: 540px; max-height: 80vh;
      background: #fff; border-radius: 18px;
      box-shadow: 0 8px 40px rgba(0,0,0,0.18);
      display: none; flex-direction: column; overflow: hidden;
      animation: ariaSlideIn 0.25s ease;
    }
    #aria-window.open { display: flex; }
    @keyframes ariaSlideIn {
      from { opacity: 0; transform: translateY(16px) scale(0.97); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    #aria-header {
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      padding: 14px 16px; display: flex; align-items: center; gap: 10;
      color: #fff;
    }
    #aria-avatar {
      width: 38px; height: 38px; border-radius: 50%;
      background: rgba(255,255,255,0.25);
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 16px; flex-shrink: 0;
    }
    #aria-close {
      margin-left: auto; background: rgba(255,255,255,0.2);
      border: none; color: #fff; cursor: pointer;
      border-radius: 8px; padding: 4px 10px; font-size: 14px;
    }
    #aria-messages {
      flex: 1; overflow-y: auto; padding: 16px 14px;
      background: #f8f7ff; display: flex; flex-direction: column; gap: 12px;
    }
    #aria-messages::-webkit-scrollbar { width: 4px; }
    #aria-messages::-webkit-scrollbar-thumb { background: #c4b5fd; border-radius: 2px; }
    .aria-msg { display: flex; gap: 8px; align-items: flex-end; }
    .aria-msg.user { flex-direction: row-reverse; }
    .aria-msg-bubble {
      max-width: 80%; padding: 10px 13px; border-radius: 14px;
      font-size: 13px; line-height: 1.6; white-space: pre-wrap;
    }
    .aria-msg.bot .aria-msg-bubble { background: #fff; color: #1f2937; border-radius: 2px 14px 14px 14px; box-shadow: 0 1px 4px rgba(0,0,0,0.07); }
    .aria-msg.user .aria-msg-bubble { background: linear-gradient(135deg,#6366f1,#8b5cf6); color: #fff; border-radius: 14px 2px 14px 14px; }
    .aria-dot { width: 28px; height: 28px; border-radius: 50%; background: linear-gradient(135deg,#6366f1,#8b5cf6); display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;flex-shrink:0; }
    .aria-typing { display: flex; gap: 4px; align-items: center; padding: 10px 13px; background:#fff; border-radius:2px 14px 14px 14px; box-shadow:0 1px 4px rgba(0,0,0,0.07); }
    .aria-typing span { width:6px;height:6px;border-radius:50%;background:#6366f1;animation:ariaBounce 1.2s ease-in-out infinite; }
    .aria-typing span:nth-child(2){animation-delay:0.2s}
    .aria-typing span:nth-child(3){animation-delay:0.4s}
    @keyframes ariaBounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}
    #aria-capture { padding: 12px 14px; background: #faf5ff; border-top: 1px solid #ede9fe; }
    #aria-capture p { font-size: 12px; color: #7c3aed; margin-bottom: 8px; font-weight: 600; }
    #aria-capture input {
      width: 100%; border: 1px solid #ddd6fe; border-radius: 8px;
      padding: 8px 12px; font-size: 13px; margin-bottom: 6px;
      outline: none; font-family: inherit; color: #1f2937;
    }
    #aria-capture input:focus { border-color: #a78bfa; }
    #aria-capture button {
      width: 100%; background: linear-gradient(135deg,#6366f1,#8b5cf6);
      color: #fff; border: none; border-radius: 8px; padding: 9px;
      font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit;
    }
    #aria-input-row {
      padding: 10px 12px; border-top: 1px solid #ede9fe;
      display: flex; gap: 8px; align-items: flex-end; background: #fff;
    }
    #aria-input {
      flex: 1; border: 1px solid #e0e7ff; border-radius: 10px;
      padding: 9px 12px; font-size: 13px; resize: none;
      font-family: inherit; outline: none; color: #1f2937;
      max-height: 80px; overflow-y: auto; line-height: 1.5;
    }
    #aria-input:focus { border-color: #a78bfa; }
    #aria-send {
      width: 36px; height: 36px; border-radius: 10px; border: none; cursor: pointer;
      background: linear-gradient(135deg,#6366f1,#8b5cf6);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; transition: opacity 0.2s;
    }
    #aria-send:disabled { background: #e5e7eb; cursor: not-allowed; }
    #aria-footer { text-align:center; font-size:10px; color:#c4b5fd; padding:4px 0 8px; background:#fff; }
  `;
  document.head.appendChild(style);

  // ── Build HTML ─────────────────────────────────────────────────────────────
  const widget = document.createElement("div");
  widget.id = "aria-widget";
  widget.innerHTML = `
    <!-- Bubble -->
    <button id="aria-bubble" title="Chat with Aria">
      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
      <span id="aria-unread">1</span>
    </button>

    <!-- Chat window -->
    <div id="aria-window">
      <div id="aria-header">
        <div id="aria-avatar">A</div>
        <div style="margin-left:10px">
          <div style="font-weight:700;font-size:14px">${BOT_NAME}</div>
          <div style="font-size:11px;opacity:0.8;display:flex;align-items:center;gap:4px">
            <span style="width:6px;height:6px;border-radius:50%;background:#4ade80;display:inline-block"></span>
            ${BOT_ROLE}
          </div>
        </div>
        <button id="aria-close">✕</button>
      </div>

      <div id="aria-messages"></div>

      <div id="aria-capture" style="display:none">
        <p>👤 Let us follow up with you directly</p>
        <input id="aria-cap-name" placeholder="Your full name" />
        <input id="aria-cap-email" placeholder="Your email address" type="email" />
        <button id="aria-cap-submit">Submit — Get Human Support</button>
      </div>

      <div id="aria-input-row">
        <textarea id="aria-input" rows="1" placeholder="Type your message..."></textarea>
        <button id="aria-send" disabled>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff">
            <path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/>
          </svg>
        </button>
      </div>
      <div id="aria-footer">Powered by Claude · NovaSaaS Support</div>
    </div>
  `;
  document.body.appendChild(widget);

  // ── Elements ───────────────────────────────────────────────────────────────
  const bubble = document.getElementById("aria-bubble");
  const win = document.getElementById("aria-window");
  const msgBox = document.getElementById("aria-messages");
  const input = document.getElementById("aria-input");
  const sendBtn = document.getElementById("aria-send");
  const closeBtn = document.getElementById("aria-close");
  const capture = document.getElementById("aria-capture");
  const capName = document.getElementById("aria-cap-name");
  const capEmail = document.getElementById("aria-cap-email");
  const capSubmit = document.getElementById("aria-cap-submit");
  const unread = document.getElementById("aria-unread");

  // ── Helpers ────────────────────────────────────────────────────────────────
  function scrollBottom() {
    msgBox.scrollTop = msgBox.scrollHeight;
  }

  function addMessage(role, text) {
    const clean = text.replace("[COLLECT_EMAIL]", "").trim();
    const div = document.createElement("div");
    div.className = `aria-msg ${role === "assistant" ? "bot" : "user"}`;
    div.innerHTML = role === "assistant"
      ? `<div class="aria-dot">A</div><div class="aria-msg-bubble">${clean}</div>`
      : `<div class="aria-msg-bubble">${clean}</div>`;
    msgBox.appendChild(div);
    scrollBottom();
  }

  function showTyping() {
    const div = document.createElement("div");
    div.className = "aria-msg bot"; div.id = "aria-typing-row";
    div.innerHTML = `<div class="aria-dot">A</div>
      <div class="aria-typing"><span></span><span></span><span></span></div>`;
    msgBox.appendChild(div); scrollBottom();
  }

  function hideTyping() {
    const t = document.getElementById("aria-typing-row");
    if (t) t.remove();
  }

  function showGreeting() {
    addMessage("assistant", "👋 Hi! I'm Aria, your NovaSaaS support agent. How can I help you today?");
  }

  // ── Toggle ─────────────────────────────────────────────────────────────────
  function toggleWidget() {
    isOpen = !isOpen;
    win.classList.toggle("open", isOpen);
    unread.style.display = "none";
    if (isOpen && messages.length === 0) showGreeting();
    if (isOpen) setTimeout(() => input.focus(), 200);
  }

  bubble.addEventListener("click", toggleWidget);
  closeBtn.addEventListener("click", toggleWidget);

  // Show unread dot after 3 seconds if not opened
  setTimeout(() => {
    if (!isOpen) { unread.style.display = "flex"; }
  }, 3000);

  // ── Send Message ───────────────────────────────────────────────────────────
  input.addEventListener("input", () => {
    sendBtn.disabled = !input.value.trim() || isLoading;
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });

  sendBtn.addEventListener("click", sendMessage);

  async function sendMessage() {
    const text = input.value.trim();
    if (!text || isLoading) return;
    input.value = ""; sendBtn.disabled = true; isLoading = true;

    messages.push({ role: "user", content: text });
    addMessage("user", text);
    showTyping();

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, session_id: SESSION_ID }),
      });
      const data = await res.json();
      hideTyping();

      const reply = data.reply || "Sorry, I encountered an error.";
      messages.push({ role: "assistant", content: reply });
      addMessage("assistant", reply);

      // Detect email capture intent
      if (!captureShown && reply.includes("[COLLECT_EMAIL]")) {
        capture.style.display = "block";
        captureShown = true;
        scrollBottom();
      }
    } catch {
      hideTyping();
      addMessage("assistant", "Sorry, I'm having trouble connecting. Please try again.");
    } finally {
      isLoading = false;
      sendBtn.disabled = !input.value.trim();
    }
  }

  // ── Email Capture ──────────────────────────────────────────────────────────
  capSubmit.addEventListener("click", async () => {
    const name = capName.value.trim();
    const email = capEmail.value.trim();
    if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      alert("Please enter a valid name and email."); return;
    }

    try {
      await fetch(`${API_BASE}/api/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, session_id: SESSION_ID }),
      });
    } catch { /* fail silently */ }

    capture.style.display = "none";
    addMessage("assistant", `Thank you, ${name}! Our team will reach out to ${email} shortly. Is there anything else I can help with?`);
  });

})(); // end IIFE — no global scope pollution
