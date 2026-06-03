'use strict';

const ContextBroker = require('../src/os-core/ContextBroker');

/**
 * Build a fresh Supabase-like db mock for each test.
 * Methods return `this` for chaining; terminal methods (limit, eq, insert, single)
 * can be overridden per-test via mockResolvedValueOnce.
 */
function makeDb() {
  const builder = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue({ data: [], error: null }),
    single: jest.fn().mockResolvedValue({ data: {}, error: null }),
  };

  const db = {
    from: jest.fn().mockReturnValue(builder),
    rpc: jest.fn().mockResolvedValue({ data: [], error: null }),
    _builder: builder,
  };

  return db;
}

describe('ContextBroker constructor', () => {
  it('applies default options', () => {
    const db = makeDb();
    const broker = new ContextBroker(db);
    expect(broker.maxContextMessages).toBe(10);
  });

  it('accepts custom maxContextMessages', () => {
    const db = makeDb();
    const broker = new ContextBroker(db, { maxContextMessages: 5 });
    expect(broker.maxContextMessages).toBe(5);
  });
});

describe('ContextBroker.getContext', () => {
  it('returns messages in chronological order', async () => {
    const db = makeDb();
    const rows = [
      { role: 'assistant', content: 'second', created_at: '2024-01-01T00:00:02Z' },
      { role: 'user', content: 'first', created_at: '2024-01-01T00:00:01Z' },
    ];
    // getContext ends the chain with .limit()
    db._builder.limit.mockResolvedValueOnce({ data: rows, error: null });

    const broker = new ContextBroker(db);
    const ctx = await broker.getContext('sess1');

    // reverse() reverses in-place — earliest (index 1 in rows) should come first
    expect(ctx[0].content).toBe('first');
    expect(ctx[1].content).toBe('second');
  });

  it('returns empty array on DB error', async () => {
    const db = makeDb();
    db._builder.limit.mockResolvedValueOnce({ data: null, error: { message: 'DB fail' } });

    const broker = new ContextBroker(db);
    const ctx = await broker.getContext('sess1');
    expect(ctx).toEqual([]);
  });

  it('prepends long-term memory context when queryText is provided and memories found', async () => {
    const db = makeDb();
    db._builder.limit.mockResolvedValueOnce({ data: [], error: null });

    const broker = new ContextBroker(db);
    jest.spyOn(broker, 'searchMemories').mockResolvedValue(['old memory content']);

    const ctx = await broker.getContext('sess1', 'some query');

    expect(ctx[0].role).toBe('system');
    expect(ctx[0].content).toContain('old memory content');
  });

  it('does not prepend memory context when no memories are found', async () => {
    const db = makeDb();
    db._builder.limit.mockResolvedValueOnce({ data: [], error: null });

    const broker = new ContextBroker(db);
    jest.spyOn(broker, 'searchMemories').mockResolvedValue([]);

    const ctx = await broker.getContext('sess1', 'query');
    expect(ctx.every(m => m.role !== 'system')).toBe(true);
  });
});

describe('ContextBroker.saveMessage', () => {
  it('calls db.from("chat_logs").insert with correct payload', async () => {
    const db = makeDb();
    // saveMessage ends the chain with .insert() — make it resolve
    db._builder.insert.mockResolvedValueOnce({ error: null });

    const broker = new ContextBroker(db);
    jest.spyOn(broker, 'checkPaging').mockResolvedValue(undefined);

    await broker.saveMessage('sess1', 'user', 'hello');

    expect(db.from).toHaveBeenCalledWith('chat_logs');
    expect(db._builder.insert).toHaveBeenCalledWith([
      expect.objectContaining({ session_id: 'sess1', role: 'user', content: 'hello' })
    ]);
  });

  it('throws when DB insert returns an error', async () => {
    const db = makeDb();
    const dbError = { message: 'insert failed' };
    db._builder.insert.mockResolvedValueOnce({ error: dbError });

    const broker = new ContextBroker(db);
    jest.spyOn(broker, 'checkPaging').mockResolvedValue(undefined);

    await expect(broker.saveMessage('sess1', 'user', 'hello')).rejects.toEqual(dbError);
  });

  it('calls checkPaging after a successful insert', async () => {
    const db = makeDb();
    db._builder.insert.mockResolvedValueOnce({ error: null });

    const broker = new ContextBroker(db);
    const checkPagingSpy = jest.spyOn(broker, 'checkPaging').mockResolvedValue(undefined);

    await broker.saveMessage('sess1', 'user', 'hello');
    expect(checkPagingSpy).toHaveBeenCalledWith('sess1');
  });
});

describe('ContextBroker.checkPaging', () => {
  // checkPaging's query ends at .eq(), not .limit():
  //   db.from('chat_logs').select('*', {...}).eq('session_id', sessionId)
  // So we mock .eq() as the terminal resolver for these tests.

  it('does not trigger pageContext when count is at the threshold', async () => {
    const db = makeDb();
    // maxContextMessages = 10; threshold = 10 + 5 = 15; count = 15 → should NOT page
    db._builder.eq.mockResolvedValueOnce({ count: 15, error: null });

    const broker = new ContextBroker(db, { maxContextMessages: 10 });
    const pageContextSpy = jest.spyOn(broker, 'pageContext').mockResolvedValue(undefined);

    await broker.checkPaging('sess1');
    expect(pageContextSpy).not.toHaveBeenCalled();
  });

  it('triggers pageContext when count exceeds threshold', async () => {
    const db = makeDb();
    // count = 16 > 15 → should page
    db._builder.eq.mockResolvedValueOnce({ count: 16, error: null });

    const broker = new ContextBroker(db, { maxContextMessages: 10 });
    const pageContextSpy = jest.spyOn(broker, 'pageContext').mockResolvedValue(undefined);

    await broker.checkPaging('sess1');
    expect(pageContextSpy).toHaveBeenCalledWith('sess1');
  });

  it('returns early when DB returns an error', async () => {
    const db = makeDb();
    db._builder.eq.mockResolvedValueOnce({ count: null, error: { message: 'fail' } });

    const broker = new ContextBroker(db);
    const pageContextSpy = jest.spyOn(broker, 'pageContext').mockResolvedValue(undefined);

    await broker.checkPaging('sess1');
    expect(pageContextSpy).not.toHaveBeenCalled();
  });
});

describe('ContextBroker.generateEmbedding', () => {
  it('returns a 1536-element array', async () => {
    const broker = new ContextBroker(makeDb());
    const embedding = await broker.generateEmbedding('test text');
    expect(embedding).toHaveLength(1536);
  });

  it('returns numbers between 0 and 1', async () => {
    const broker = new ContextBroker(makeDb());
    const embedding = await broker.generateEmbedding('test');
    expect(embedding.every(v => v >= 0 && v <= 1)).toBe(true);
  });
});

describe('ContextBroker.searchMemories', () => {
  it('returns empty array when RPC throws', async () => {
    const db = makeDb();
    db.rpc = jest.fn().mockRejectedValue(new Error('rpc fail'));

    const broker = new ContextBroker(db);
    jest.spyOn(broker, 'generateEmbedding').mockResolvedValue(new Array(1536).fill(0));

    const result = await broker.searchMemories('sess1', 'query');
    expect(result).toEqual([]);
  });

  it('returns content strings from RPC results', async () => {
    const db = makeDb();
    db.rpc = jest.fn().mockResolvedValue({
      data: [{ content: 'memory A' }, { content: 'memory B' }],
      error: null
    });

    const broker = new ContextBroker(db);
    jest.spyOn(broker, 'generateEmbedding').mockResolvedValue(new Array(1536).fill(0));

    const result = await broker.searchMemories('sess1', 'query');
    expect(result).toEqual(['memory A', 'memory B']);
  });
});
