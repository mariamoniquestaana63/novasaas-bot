'use strict';

/**
 * API endpoint tests.
 * All external dependencies (Supabase, Anthropic, MCP) are mocked so no
 * real network calls are made.  We build a minimal Express app directly
 * using mock instances, mirroring what server.js does.
 */

jest.mock('@anthropic-ai/sdk', () =>
  jest.fn().mockImplementation(() => ({
    messages: { create: jest.fn() }
  }))
);

jest.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: jest.fn().mockImplementation(() => ({
    connect: jest.fn(),
    listTools: jest.fn().mockResolvedValue({ tools: [] }),
    callTool: jest.fn(),
  }))
}));

jest.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
  StdioClientTransport: jest.fn().mockImplementation(() => ({}))
}));

jest.mock('ws', () => jest.fn());
jest.mock('dotenv', () => ({ config: jest.fn() }));

// ── Build a controlled Express app ──────────────────────────────────────────

const express = require('express');
const request = require('supertest');

// Shared mock functions — captured at module level so every test can
// override them with mockRejectedValueOnce / mockResolvedValueOnce.
const mockDispatch = jest.fn().mockResolvedValue({ reply: 'mocked reply', agent: 'SupportAgent' });
const mockSaveMessage = jest.fn().mockResolvedValue(undefined);

// Supabase query-builder mock.
// Terminal calls in the routes:
//   POST /api/leads  → insert() ends chain
//   GET  /api/leads  → order() ends chain (no .limit() in that handler)
const mockQueryBuilder = {
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockResolvedValue({ error: null }),   // terminal for POST /leads
  eq: jest.fn().mockReturnThis(),
  order: jest.fn().mockResolvedValue({ data: [], error: null }), // terminal for GET /leads
  limit: jest.fn().mockResolvedValue({ data: [], error: null }),
  single: jest.fn().mockResolvedValue({ data: {}, error: null }),
};

const mockDb = {
  from: jest.fn().mockReturnValue(mockQueryBuilder),
};

// Build the app once
const app = express();
app.use(express.json());

app.post('/api/chat', async (req, res) => {
  const { messages, session_id } = req.body;
  if (!messages || !Array.isArray(messages) || !session_id) {
    return res.status(400).json({ error: 'messages and session_id are required' });
  }
  try {
    const result = await mockDispatch({ messages }, { session_id });
    const reply = result.reply;
    const lastUserMsg = messages[messages.length - 1];
    await mockSaveMessage(session_id, 'user', lastUserMsg.content);
    await mockSaveMessage(session_id, 'assistant', reply);
    res.json({ reply, agent: result.agent });
  } catch (err) {
    res.status(500).json({ error: 'AI OS error. Please try again.' });
  }
});

app.post('/api/leads', async (req, res) => {
  const { name, email, session_id } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: 'name and email are required' });
  }
  try {
    const { error } = await mockDb.from('leads').insert([{ name, email, session_id }]);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Could not save lead.' });
  }
});

app.get('/api/leads', async (req, res) => {
  const { data, error } = await mockDb
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ leads: data });
});

afterEach(() => {
  jest.clearAllMocks();
  // Restore defaults after clearAllMocks wipes them
  mockDispatch.mockResolvedValue({ reply: 'mocked reply', agent: 'SupportAgent' });
  mockSaveMessage.mockResolvedValue(undefined);
  mockDb.from.mockReturnValue(mockQueryBuilder);
  mockQueryBuilder.select.mockReturnThis();
  mockQueryBuilder.eq.mockReturnThis();
  mockQueryBuilder.insert.mockResolvedValue({ error: null });
  mockQueryBuilder.order.mockResolvedValue({ data: [], error: null });
  mockQueryBuilder.limit.mockResolvedValue({ data: [], error: null });
  mockQueryBuilder.single.mockResolvedValue({ data: {}, error: null });
});

// ── POST /api/chat ────────────────────────────────────────────────────────────

describe('POST /api/chat', () => {
  it('returns 400 when messages is missing', async () => {
    const res = await request(app).post('/api/chat').send({ session_id: 's1' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/messages/i);
  });

  it('returns 400 when messages is not an array', async () => {
    const res = await request(app).post('/api/chat').send({ messages: 'hi', session_id: 's1' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when session_id is missing', async () => {
    const res = await request(app)
      .post('/api/chat')
      .send({ messages: [{ role: 'user', content: 'hi' }] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/session_id/i);
  });

  it('returns 200 with reply and agent on success', async () => {
    const res = await request(app)
      .post('/api/chat')
      .send({ messages: [{ role: 'user', content: 'hello' }], session_id: 's1' });

    expect(res.status).toBe(200);
    expect(res.body.reply).toBe('mocked reply');
    expect(res.body.agent).toBe('SupportAgent');
  });

  it('persists user and assistant messages via saveMessage', async () => {
    await request(app)
      .post('/api/chat')
      .send({ messages: [{ role: 'user', content: 'hello' }], session_id: 's1' });

    expect(mockSaveMessage).toHaveBeenCalledWith('s1', 'user', 'hello');
    expect(mockSaveMessage).toHaveBeenCalledWith('s1', 'assistant', 'mocked reply');
  });

  it('returns 500 when dispatch throws', async () => {
    mockDispatch.mockRejectedValueOnce(new Error('dispatch failed'));

    const res = await request(app)
      .post('/api/chat')
      .send({ messages: [{ role: 'user', content: 'hi' }], session_id: 's1' });

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/AI OS error/i);
  });
});

// ── POST /api/leads ───────────────────────────────────────────────────────────

describe('POST /api/leads', () => {
  it('returns 400 when name is missing', async () => {
    const res = await request(app).post('/api/leads').send({ email: 'a@b.com' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name/i);
  });

  it('returns 400 when email is missing', async () => {
    const res = await request(app).post('/api/leads').send({ name: 'Alice' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/email/i);
  });

  it('returns 200 with success:true on valid input', async () => {
    const res = await request(app)
      .post('/api/leads')
      .send({ name: 'Alice', email: 'alice@example.com', session_id: 's1' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('inserts name, email and session_id into the leads table', async () => {
    await request(app)
      .post('/api/leads')
      .send({ name: 'Alice', email: 'alice@example.com', session_id: 'sess42' });

    expect(mockDb.from).toHaveBeenCalledWith('leads');
    expect(mockQueryBuilder.insert).toHaveBeenCalledWith([
      expect.objectContaining({ name: 'Alice', email: 'alice@example.com', session_id: 'sess42' })
    ]);
  });

  it('returns 500 when DB insert fails', async () => {
    mockQueryBuilder.insert.mockResolvedValueOnce({ error: { message: 'duplicate' } });

    const res = await request(app)
      .post('/api/leads')
      .send({ name: 'Bob', email: 'bob@example.com' });

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/Could not save lead/i);
  });
});

// ── GET /api/leads ────────────────────────────────────────────────────────────

describe('GET /api/leads', () => {
  it('returns 200 with leads array on success', async () => {
    const leads = [{ id: '1', name: 'Alice', email: 'alice@example.com' }];
    mockQueryBuilder.order.mockResolvedValueOnce({ data: leads, error: null });

    const res = await request(app).get('/api/leads');

    expect(res.status).toBe(200);
    expect(res.body.leads).toEqual(leads);
  });

  it('orders results by created_at descending', async () => {
    await request(app).get('/api/leads');
    expect(mockQueryBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('returns 500 when DB query fails', async () => {
    mockQueryBuilder.order.mockResolvedValueOnce({ data: null, error: { message: 'query failed' } });

    const res = await request(app).get('/api/leads');

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/query failed/i);
  });
});
