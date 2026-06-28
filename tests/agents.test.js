'use strict';

const BaseAgent = require('../src/agents/BaseAgent');
const SalesAgent = require('../src/agents/SalesAgent');
const SupportAgent = require('../src/agents/SupportAgent');
const ManagerAgent = require('../src/agents/ManagerAgent');

/**
 * Creates a minimal Kernel stub whose callLLM() resolves with the given text.
 * @param {string} [llmReply='test reply'] - Text returned in content[0].text.
 * @returns {{ callLLM: jest.Mock, blackboard: null }}
 */
function makeKernel(llmReply = 'test reply') {
  return {
    callLLM: jest.fn().mockResolvedValue({
      content: [{ text: llmReply }]
    }),
    blackboard: null,
  };
}

// ──────────────────────────────────────────────
// BaseAgent
// ──────────────────────────────────────────────
describe('BaseAgent', () => {
  it('stores constructor arguments as properties', () => {
    const a = new BaseAgent('TestAgent', 'tester', 'you are a tester');
    expect(a.name).toBe('TestAgent');
    expect(a.role).toBe('tester');
    expect(a.systemPrompt).toBe('you are a tester');
  });

  it('throws when run() is called directly', async () => {
    const a = new BaseAgent('TestAgent', 'tester', 'prompt');
    await expect(a.run(null, {}, {})).rejects.toThrow('run() must be implemented');
  });
});

// ──────────────────────────────────────────────
// SalesAgent
// ──────────────────────────────────────────────
describe('SalesAgent', () => {
  it('is named SalesAgent with correct role', () => {
    const a = new SalesAgent();
    expect(a.name).toBe('SalesAgent');
    expect(a.role).toBe('Sales Growth Specialist');
  });

  it('includes pricing tiers in its system prompt', () => {
    const a = new SalesAgent();
    expect(a.systemPrompt).toContain('$29');
    expect(a.systemPrompt).toContain('$79');
    expect(a.systemPrompt).toContain('Enterprise');
  });

  it('run() returns reply and agent name', async () => {
    const a = new SalesAgent();
    const kernel = makeKernel('book a demo!');
    const input = { messages: [{ role: 'user', content: 'hi' }] };

    const result = await a.run(kernel, input, { session_id: 's1' });

    expect(result.reply).toBe('book a demo!');
    expect(result.agent).toBe('SalesAgent');
  });

  it('run() passes messages to callLLM', async () => {
    const a = new SalesAgent();
    const kernel = makeKernel();
    const messages = [{ role: 'user', content: 'team size?' }];

    await a.run(kernel, { messages }, {});

    expect(kernel.callLLM).toHaveBeenCalledWith(
      expect.objectContaining({ messages, system: a.systemPrompt })
    );
  });
});

// ──────────────────────────────────────────────
// SupportAgent
// ──────────────────────────────────────────────
describe('SupportAgent', () => {
  it('is named SupportAgent with correct role', () => {
    const a = new SupportAgent();
    expect(a.name).toBe('SupportAgent');
    expect(a.role).toBe('Customer Support Specialist');
  });

  it('includes escalation trigger in system prompt', () => {
    const a = new SupportAgent();
    expect(a.systemPrompt).toContain('[COLLECT_EMAIL]');
  });

  it('includes knowledge base details in system prompt', () => {
    const a = new SupportAgent();
    expect(a.systemPrompt).toContain('novasaas.com');
    expect(a.systemPrompt).toContain('support@novasaas.com');
    expect(a.systemPrompt).toContain('$29');
  });

  it('run() returns reply and agent name', async () => {
    const a = new SupportAgent();
    const kernel = makeKernel('Here is your answer');
    const result = await a.run(kernel, { messages: [{ role: 'user', content: 'help' }] }, {});

    expect(result.reply).toBe('Here is your answer');
    expect(result.agent).toBe('SupportAgent');
  });

  it('run() propagates errors from callLLM', async () => {
    const a = new SupportAgent();
    const kernel = { callLLM: jest.fn().mockRejectedValue(new Error('LLM error')) };

    await expect(a.run(kernel, { messages: [{ role: 'user', content: 'help' }] }, {}))
      .rejects.toThrow('LLM error');
  });
});

// ──────────────────────────────────────────────
// ManagerAgent
// ──────────────────────────────────────────────
describe('ManagerAgent', () => {
  it('is named ManagerAgent with correct role', () => {
    const a = new ManagerAgent();
    expect(a.name).toBe('ManagerAgent');
    expect(a.role).toBe('Chief Orchestrator');
  });

  it('initialises activePlans as an empty Map', () => {
    const a = new ManagerAgent();
    expect(a.activePlans).toBeInstanceOf(Map);
    expect(a.activePlans.size).toBe(0);
  });

  it('run() returns reply and agent name when LLM returns plain text', async () => {
    const a = new ManagerAgent();
    const kernel = makeKernel('I will handle this.');
    const input = { messages: [{ role: 'user', content: 'do something complex' }] };

    const result = await a.run(kernel, input, { session_id: 's1' });

    expect(result.reply).toBe('I will handle this.');
    expect(result.agent).toBe('ManagerAgent');
  });

  it('run() extracts a plan when LLM returns valid JSON', async () => {
    const plan = { tasks: [{ id: 'task_1', description: 'step 1', assigned_to: 'SupportAgent', dependencies: [] }] };
    const a = new ManagerAgent();
    const kernel = makeKernel(JSON.stringify(plan));
    const input = { messages: [{ role: 'user', content: 'do something' }] };

    const result = await a.run(kernel, input, { session_id: 's1' });

    expect(result.plan).toEqual(plan);
    expect(result.reply).toContain("created a plan");
  });

  it('run() extracts JSON wrapped in markdown code fences', async () => {
    const plan = { tasks: [{ id: 't1', description: 'd', assigned_to: 'SalesAgent', dependencies: [] }] };
    const wrapped = `Sure! Here is the plan:\n\`\`\`json\n${JSON.stringify(plan)}\n\`\`\``;
    const a = new ManagerAgent();
    const kernel = makeKernel(wrapped);
    const input = { messages: [{ role: 'user', content: 'plan something' }] };

    const result = await a.run(kernel, input, { session_id: 's1' });

    expect(result.plan).toEqual(plan);
  });

  it('run() falls back to returning raw text when JSON cannot be parsed', async () => {
    const a = new ManagerAgent();
    const kernel = makeKernel('No JSON here, just plain instructions.');
    const input = { messages: [{ role: 'user', content: 'simple question' }] };

    const result = await a.run(kernel, input, { session_id: 's1' });

    expect(result.reply).toBe('No JSON here, just plain instructions.');
    expect(result.agent).toBe('ManagerAgent');
  });

  it('run() posts user request to blackboard when available', async () => {
    const plan = { tasks: [] };
    const a = new ManagerAgent();
    const kernel = makeKernel(JSON.stringify(plan));
    const mockBlackboard = {
      getHistory: jest.fn().mockResolvedValue([]),
      post: jest.fn().mockResolvedValue({ id: '1' }),
    };
    kernel.blackboard = mockBlackboard;
    const input = { messages: [{ role: 'user', content: 'handle this' }] };

    await a.run(kernel, input, { session_id: 's1' });

    expect(mockBlackboard.post).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'user_request', agent_id: 'User' })
    );
  });

  it('run() identifies and posts initial tasks (no dependencies) to blackboard', async () => {
    const plan = {
      tasks: [
        { id: 't1', description: 'a', assigned_to: 'SupportAgent', dependencies: [] },
        { id: 't2', description: 'b', assigned_to: 'SalesAgent', dependencies: ['t1'] },
      ]
    };
    const a = new ManagerAgent();
    const kernel = makeKernel(JSON.stringify(plan));
    const mockBlackboard = {
      getHistory: jest.fn().mockResolvedValue([]),
      post: jest.fn().mockResolvedValue({ id: '1' }),
    };
    kernel.blackboard = mockBlackboard;

    await a.run(kernel, { messages: [{ role: 'user', content: 'do both tasks' }] }, { session_id: 's1' });

    const taskAssignmentCalls = mockBlackboard.post.mock.calls.filter(
      call => call[0].type === 'task_assignment'
    );
    // Only t1 has no dependencies, t2 should NOT be posted initially
    expect(taskAssignmentCalls).toHaveLength(1);
    expect(taskAssignmentCalls[0][0].payload.id).toBe('t1');
  });

  it('run() proceeds normally when an active plan already exists on the blackboard', async () => {
    const plan = { tasks: [] };
    const a = new ManagerAgent();
    const kernel = makeKernel(JSON.stringify(plan));
    const mockBlackboard = {
      getHistory: jest.fn().mockResolvedValue([{ type: 'plan', status: 'active' }]),
      post: jest.fn().mockResolvedValue({ id: '1' }),
    };
    kernel.blackboard = mockBlackboard;

    const result = await a.run(kernel, { messages: [{ role: 'user', content: 'continue' }] }, { session_id: 's1' });

    expect(mockBlackboard.getHistory).toHaveBeenCalledWith('s1');
    expect(result.agent).toBe('ManagerAgent');
  });

  it('run() returns raw text when parsed JSON has no tasks array', async () => {
    const a = new ManagerAgent();
    const rawJson = JSON.stringify({ status: 'no plan needed' });
    const kernel = makeKernel(rawJson);
    const input = { messages: [{ role: 'user', content: 'just a quick question' }] };

    const result = await a.run(kernel, input, { session_id: 's1' });

    expect(result.reply).toBe(rawJson);
    expect(result.agent).toBe('ManagerAgent');
  });
});

describe('ManagerAgent.handleBlackboardEvent', () => {
  it('logs when a result event is received', async () => {
    const a = new ManagerAgent();
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await expect(
      a.handleBlackboardEvent({}, { session_id: 's1', type: 'result', payload: { ok: true } })
    ).resolves.toBeUndefined();

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Received result for session s1'));
    logSpy.mockRestore();
  });

  it('logs an error when an error event is received', async () => {
    const a = new ManagerAgent();
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const payload = { message: 'task failed' };

    await expect(
      a.handleBlackboardEvent({}, { session_id: 's1', type: 'error', payload })
    ).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Received error for session s1'), payload);
    errorSpy.mockRestore();
  });

  it('does nothing for unrecognised event types', async () => {
    const a = new ManagerAgent();
    await expect(
      a.handleBlackboardEvent({}, { session_id: 's1', type: 'other', payload: {} })
    ).resolves.toBeUndefined();
  });
});
