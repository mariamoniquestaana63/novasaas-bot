'use strict';

const Blackboard = require('../src/os-core/Blackboard');

function makeDb() {
  const subscription = { unsubscribe: jest.fn() };
  const channel = {
    on: jest.fn().mockReturnThis(),
    subscribe: jest.fn().mockReturnValue(subscription),
    _subscription: subscription,
  };

  const builder = {
    insert: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue({ data: [], error: null }),
    single: jest.fn().mockResolvedValue({ data: {}, error: null }),
  };

  return {
    from: jest.fn().mockReturnValue(builder),
    channel: jest.fn().mockReturnValue(channel),
    _builder: builder,
    _channel: channel,
  };
}

describe('Blackboard.post', () => {
  it('inserts a record and returns the created data', async () => {
    const db = makeDb();
    const mockData = { id: '1', type: 'observation', status: 'active' };
    db._builder.single.mockResolvedValueOnce({ data: mockData, error: null });

    const bb = new Blackboard(db);
    const result = await bb.post({
      session_id: 'sess1',
      agent_id: 'SupportAgent',
      type: 'observation',
      layer: 'perception',
      payload: { text: 'hello' }
    });

    expect(db.from).toHaveBeenCalledWith('blackboard_entries');
    expect(db._builder.insert).toHaveBeenCalledWith([
      expect.objectContaining({ type: 'observation', status: 'active' })
    ]);
    expect(result).toBe(mockData);
  });

  it('throws when DB returns an error', async () => {
    const db = makeDb();
    db._builder.single.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } });

    const bb = new Blackboard(db);
    await expect(bb.post({ session_id: 's', agent_id: 'a', type: 'plan', layer: 'logic', payload: {} }))
      .rejects.toMatchObject({ message: 'DB error' });
  });
});

describe('Blackboard.subscribe', () => {
  it('returns a subscription ID string', () => {
    const db = makeDb();
    const bb = new Blackboard(db);
    const id = bb.subscribe({ session_id: 'sess1' }, jest.fn());
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('stores the subscription by ID', () => {
    const db = makeDb();
    const bb = new Blackboard(db);
    const id = bb.subscribe({ session_id: 'sess1' }, jest.fn());
    expect(bb.subscriptions.has(id)).toBe(true);
  });

  it('builds filter string from provided filters', () => {
    const db = makeDb();
    const bb = new Blackboard(db);
    bb.subscribe({ session_id: 'sess1', layer: 'logic' }, jest.fn());

    const onCall = db._channel.on.mock.calls[0];
    const filterArg = onCall[1];
    expect(filterArg.filter).toContain('session_id=eq.sess1');
    expect(filterArg.filter).toContain('layer=eq.logic');
  });

  it('invokes callback with entry when INSERT event fires', () => {
    const db = makeDb();
    const bb = new Blackboard(db);
    const callback = jest.fn();
    bb.subscribe(null, callback);

    // Simulate Supabase calling our handler
    const onCallback = db._channel.on.mock.calls[0][2];
    const fakeEntry = { id: '42', type: 'plan' };
    onCallback({ new: fakeEntry });

    expect(callback).toHaveBeenCalledWith(fakeEntry);
  });
});

describe('Blackboard.unsubscribe', () => {
  it('calls unsubscribe on the stored subscription and removes it', () => {
    const db = makeDb();
    const bb = new Blackboard(db);
    const id = bb.subscribe({ session_id: 'sess1' }, jest.fn());
    const storedSub = bb.subscriptions.get(id);

    bb.unsubscribe(id);

    expect(storedSub.unsubscribe).toHaveBeenCalled();
    expect(bb.subscriptions.has(id)).toBe(false);
  });

  it('is a no-op for unknown subscription IDs', () => {
    const db = makeDb();
    const bb = new Blackboard(db);
    expect(() => bb.unsubscribe('nonexistent-id')).not.toThrow();
  });
});

describe('Blackboard.getHistory', () => {
  it('returns entries ordered chronologically', async () => {
    const db = makeDb();
    const rows = [{ id: '1' }, { id: '2' }];
    db._builder.limit.mockResolvedValueOnce({ data: rows, error: null });

    const bb = new Blackboard(db);
    const history = await bb.getHistory('sess1');

    expect(history).toEqual(rows);
    expect(db._builder.order).toHaveBeenCalledWith('created_at', { ascending: true });
  });

  it('uses the default limit of 50', async () => {
    const db = makeDb();
    db._builder.limit.mockResolvedValueOnce({ data: [], error: null });

    const bb = new Blackboard(db);
    await bb.getHistory('sess1');

    expect(db._builder.limit).toHaveBeenCalledWith(50);
  });

  it('throws when DB returns an error', async () => {
    const db = makeDb();
    db._builder.limit.mockResolvedValueOnce({ data: null, error: { message: 'history fail' } });

    const bb = new Blackboard(db);
    await expect(bb.getHistory('sess1')).rejects.toMatchObject({ message: 'history fail' });
  });
});

describe('Blackboard.updateStatus', () => {
  it('updates status and returns the updated entry', async () => {
    const db = makeDb();
    const updated = { id: 'e1', status: 'processed' };
    db._builder.single.mockResolvedValueOnce({ data: updated, error: null });

    const bb = new Blackboard(db);
    const result = await bb.updateStatus('e1', 'processed');

    expect(db._builder.update).toHaveBeenCalledWith({ status: 'processed' });
    expect(db._builder.eq).toHaveBeenCalledWith('id', 'e1');
    expect(result).toBe(updated);
  });

  it('throws when DB returns an error', async () => {
    const db = makeDb();
    db._builder.single.mockResolvedValueOnce({ data: null, error: { message: 'update fail' } });

    const bb = new Blackboard(db);
    await expect(bb.updateStatus('e1', 'archived')).rejects.toMatchObject({ message: 'update fail' });
  });
});
