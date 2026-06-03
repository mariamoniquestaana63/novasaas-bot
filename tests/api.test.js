'use strict';

/**
 * API endpoint tests.
 * Imports the real createApp() factory from server.js and passes mock
 * collaborators so production route handlers are exercised without any real
 * network calls.
 */

// ── Mock all external dependencies before server.js is required ─────────────

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

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn().mockReturnValue({})
}));

// ── Mock infrastructure loaded — now safe to import server ──────────────────

const request = require('supertest');
const { createApp } = require('../server');

// ── Shared mock collaborators ────────────────────────────────────────────────

/** Mock kernel dispatch — overrideable per-test with mockRejectedValueOnce. */
const mockDispatch = jest.fn().mockResolvedValue({ reply: 'mocked reply', agent: 'SupportAgent' });

/** Mock contextBroker.saveMessage — overrideable per-test. */
const mockSaveMessage = jest.fn().mockResolvedValue(undefined);

/**
 * Returns a fresh Supabase query-builder mock.
 * insert() and order() are the terminal calls for the leads routes.
 */
function makeMockDb() {
  const builder = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockResolvedValue({ error: null }),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockResolvedValue({ data: [], error: null }),
    limit: jest.fn().mockResolvedValue({ data: [], error: null }),
  };
  return {
    from: jest.fn().mockReturnValue(builder),
    _builder: builder,
  };
}

let app;
let mockDb;

beforeEach(() => {
  mockDb = makeMockDb();
  app = createApp(
    { dispatch: mockDispatch },
    { saveMessage: mockSaveMessage },
    mockDb
  );
});

afterEach(() => {
  jest.clearAllMocks();
  mockDispatch.mockResolvedValue({ reply: 'mocked reply', agent: 'SupportAgent' });
  mockSaveMessage.mockResolvedValue(undefined);
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

  it('returns 400 when messages is an empty array', async () => {
    const res = await request(app).post('/api/chat').send({ messages: [], session_id: 's1' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/messages/i);
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
    expect(mockDb._builder.insert).toHaveBeenCalledWith([
      expect.objectContaining({ name: 'Alice', email: 'alice@example.com', session_id: 'sess42' })
    ]);
  });

  it('returns 500 when DB insert fails', async () => {
    mockDb._builder.insert.mockResolvedValueOnce({ error: { message: 'duplicate' } });

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
    mockDb._builder.order.mockResolvedValueOnce({ data: leads, error: null });

    const res = await request(app).get('/api/leads');

    expect(res.status).toBe(200);
    expect(res.body.leads).toEqual(leads);
  });

  it('orders results by created_at descending', async () => {
    await request(app).get('/api/leads');
    expect(mockDb._builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('returns 500 when DB query fails', async () => {
    mockDb._builder.order.mockResolvedValueOnce({ data: null, error: { message: 'query failed' } });

    const res = await request(app).get('/api/leads');

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/query failed/i);
  });
});
