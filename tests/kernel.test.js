'use strict';

const Kernel = require('../src/os-core/Kernel');

// Prevent Anthropic constructor from requiring a real API key
jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn()
    }
  }));
});

function makeAgent(name, role = 'test') {
  return { name, role, run: jest.fn() };
}

describe('Kernel.registerAgent', () => {
  it('stores agent by name', () => {
    const k = new Kernel();
    const agent = makeAgent('SupportAgent');
    k.registerAgent(agent);
    expect(k.agents.get('SupportAgent')).toBe(agent);
  });

  it('overwrites agent registered under the same name', () => {
    const k = new Kernel();
    const a1 = makeAgent('SupportAgent');
    const a2 = makeAgent('SupportAgent');
    k.registerAgent(a1);
    k.registerAgent(a2);
    expect(k.agents.get('SupportAgent')).toBe(a2);
  });
});

describe('Kernel.route', () => {
  it('routes to ManagerAgent when registered, regardless of text', () => {
    const k = new Kernel();
    k.registerAgent(makeAgent('ManagerAgent'));
    k.registerAgent(makeAgent('SalesAgent'));
    k.registerAgent(makeAgent('SupportAgent'));

    const result = k.route({ messages: [{ role: 'user', content: 'hello' }] }, {});
    expect(result).toBe('ManagerAgent');
  });

  it('routes to SalesAgent when keyword "demo" present and no ManagerAgent', () => {
    const k = new Kernel();
    k.registerAgent(makeAgent('SalesAgent'));
    k.registerAgent(makeAgent('SupportAgent'));

    expect(k.route({ messages: [{ role: 'user', content: 'I want a demo' }] }, {})).toBe('SalesAgent');
  });

  it('routes to SalesAgent when keyword "sales" present', () => {
    const k = new Kernel();
    k.registerAgent(makeAgent('SalesAgent'));
    k.registerAgent(makeAgent('SupportAgent'));

    expect(k.route({ messages: [{ role: 'user', content: 'I need sales info' }] }, {})).toBe('SalesAgent');
  });

  it('routes to SalesAgent when keyword "contact" present', () => {
    const k = new Kernel();
    k.registerAgent(makeAgent('SalesAgent'));
    k.registerAgent(makeAgent('SupportAgent'));

    expect(k.route({ messages: [{ role: 'user', content: 'I want to contact someone' }] }, {})).toBe('SalesAgent');
  });

  it('defaults to SupportAgent when no keywords match', () => {
    const k = new Kernel();
    k.registerAgent(makeAgent('SalesAgent'));
    k.registerAgent(makeAgent('SupportAgent'));

    expect(k.route({ messages: [{ role: 'user', content: 'my password is broken' }] }, {})).toBe('SupportAgent');
  });

  it('defaults to SupportAgent when SalesAgent is not registered', () => {
    const k = new Kernel();
    k.registerAgent(makeAgent('SupportAgent'));

    expect(k.route({ messages: [{ role: 'user', content: 'I want a demo' }] }, {})).toBe('SupportAgent');
  });

  it('matches keywords case-insensitively', () => {
    const k = new Kernel();
    k.registerAgent(makeAgent('SalesAgent'));
    k.registerAgent(makeAgent('SupportAgent'));

    expect(k.route({ messages: [{ role: 'user', content: 'DEMO please' }] }, {})).toBe('SalesAgent');
  });
});

describe('Kernel.callLLM', () => {
  it('forwards params to anthropic and returns response', async () => {
    const k = new Kernel();
    const mockResponse = { content: [{ text: 'hello' }] };
    k.ai.messages.create.mockResolvedValue(mockResponse);

    const result = await k.callLLM({ messages: [{ role: 'user', content: 'hi' }] });
    expect(result).toBe(mockResponse);
    expect(k.ai.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-3-5-sonnet-20240620' })
    );
  });

  it('uses model from params when provided', async () => {
    const k = new Kernel();
    k.ai.messages.create.mockResolvedValue({ content: [] });

    await k.callLLM({ model: 'claude-3-haiku-20240307', messages: [] });
    expect(k.ai.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-3-haiku-20240307' })
    );
  });

  it('re-throws errors from the LLM API', async () => {
    const k = new Kernel();
    k.ai.messages.create.mockRejectedValue(new Error('API down'));

    await expect(k.callLLM({ messages: [] })).rejects.toThrow('API down');
  });
});

describe('Kernel.dispatch', () => {
  it('throws when routed agent is not registered', async () => {
    const k = new Kernel();
    // No agents registered — route() falls back to "SupportAgent" which doesn't exist
    await expect(k.dispatch({ messages: [{ role: 'user', content: 'hi' }] }, { session_id: 's1' }))
      .rejects.toThrow('Agent SupportAgent not found');
  });

  it('calls the agent run() with enriched input and returns its result', async () => {
    const k = new Kernel();
    const agent = makeAgent('SupportAgent');
    agent.run.mockResolvedValue({ reply: 'ok', agent: 'SupportAgent' });
    k.registerAgent(agent);

    const result = await k.dispatch(
      { messages: [{ role: 'user', content: 'help me' }] },
      { session_id: 's1' }
    );

    expect(agent.run).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ reply: 'ok', agent: 'SupportAgent' });
  });

  it('enriches messages from contextBroker when session_id is present', async () => {
    const k = new Kernel();
    const historyMsg = { role: 'user', content: 'previous message' };
    const mockBroker = { getContext: jest.fn().mockResolvedValue([historyMsg]) };
    k.setContextBroker(mockBroker);

    const agent = makeAgent('SupportAgent');
    agent.run.mockResolvedValue({ reply: 'ok', agent: 'SupportAgent' });
    k.registerAgent(agent);

    const currentMsg = { role: 'user', content: 'new message' };
    await k.dispatch({ messages: [currentMsg] }, { session_id: 's1' });

    const callArg = agent.run.mock.calls[0][1];
    expect(callArg.messages).toContainEqual(historyMsg);
    expect(callArg.messages).toContainEqual(currentMsg);
  });

  it('deduplicates messages that already exist in history', async () => {
    const k = new Kernel();
    const sharedMsg = { role: 'user', content: 'duplicate' };
    const mockBroker = { getContext: jest.fn().mockResolvedValue([sharedMsg]) };
    k.setContextBroker(mockBroker);

    const agent = makeAgent('SupportAgent');
    agent.run.mockResolvedValue({ reply: 'ok', agent: 'SupportAgent' });
    k.registerAgent(agent);

    await k.dispatch({ messages: [sharedMsg] }, { session_id: 's1' });

    const callArg = agent.run.mock.calls[0][1];
    const count = callArg.messages.filter(
      m => m.role === sharedMsg.role && m.content === sharedMsg.content
    ).length;
    expect(count).toBe(1);
  });
});
