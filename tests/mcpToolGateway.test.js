'use strict';

const MCPToolGateway = require('../src/tools/MCPToolGateway');

// Mock the MCP SDK so no real stdio processes are spawned
jest.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    listTools: jest.fn().mockResolvedValue({ tools: [] }),
    callTool: jest.fn().mockResolvedValue({ result: 'ok' }),
  }))
}));

jest.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
  StdioClientTransport: jest.fn().mockImplementation(() => ({}))
}));

const { Client } = require('@modelcontextprotocol/sdk/client/index.js');

describe('MCPToolGateway.listAvailableTools', () => {
  it('returns empty array before any connections', () => {
    const gw = new MCPToolGateway();
    expect(gw.listAvailableTools()).toEqual([]);
  });
});

describe('MCPToolGateway.connectStdio', () => {
  it('discovers and registers tools from the MCP server', async () => {
    const gw = new MCPToolGateway();
    const mockClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      listTools: jest.fn().mockResolvedValue({
        tools: [
          { name: 'search_web', description: 'Searches the web' },
          { name: 'read_file', description: 'Reads a file' },
        ]
      }),
      callTool: jest.fn(),
    };
    Client.mockImplementationOnce(() => mockClient);

    await gw.connectStdio('myServer', 'npx', ['some-mcp-server']);

    expect(gw.tools.has('search_web')).toBe(true);
    expect(gw.tools.has('read_file')).toBe(true);
    expect(gw.tools.get('search_web').serverName).toBe('myServer');
  });

  it('stores the connected client', async () => {
    const gw = new MCPToolGateway();
    const mockClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      listTools: jest.fn().mockResolvedValue({ tools: [] }),
      callTool: jest.fn(),
    };
    Client.mockImplementationOnce(() => mockClient);

    await gw.connectStdio('srv1', 'cmd', []);

    expect(gw.clients.has('srv1')).toBe(true);
  });

  it('throws when connection fails', async () => {
    const gw = new MCPToolGateway();
    const mockClient = {
      connect: jest.fn().mockRejectedValue(new Error('connection refused')),
      listTools: jest.fn(),
      callTool: jest.fn(),
    };
    Client.mockImplementationOnce(() => mockClient);

    await expect(gw.connectStdio('badServer', 'bad-cmd', [])).rejects.toThrow('connection refused');
  });

  it('handles a server that returns no tools gracefully', async () => {
    const gw = new MCPToolGateway();
    const mockClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      listTools: jest.fn().mockResolvedValue({ tools: [] }),
      callTool: jest.fn(),
    };
    Client.mockImplementationOnce(() => mockClient);

    await gw.connectStdio('emptyServer', 'cmd', []);

    expect(gw.listAvailableTools()).toHaveLength(0);
  });
});

describe('MCPToolGateway.callTool', () => {
  it('throws when tool is not registered', async () => {
    const gw = new MCPToolGateway();
    await expect(gw.callTool('nonexistent_tool', {})).rejects.toThrow('Tool nonexistent_tool not found');
  });

  it('calls the correct client with the tool name and args', async () => {
    const gw = new MCPToolGateway();
    const callToolMock = jest.fn().mockResolvedValue({ content: 'result' });
    const mockClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      listTools: jest.fn().mockResolvedValue({
        tools: [{ name: 'fetch_data', description: 'Fetches data' }]
      }),
      callTool: callToolMock,
    };
    Client.mockImplementationOnce(() => mockClient);

    await gw.connectStdio('myServer', 'cmd', []);
    const result = await gw.callTool('fetch_data', { query: 'test' });

    expect(callToolMock).toHaveBeenCalledWith({ name: 'fetch_data', arguments: { query: 'test' } });
    expect(result).toEqual({ content: 'result' });
  });

  it('throws when callTool on client fails', async () => {
    const gw = new MCPToolGateway();
    const mockClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      listTools: jest.fn().mockResolvedValue({
        tools: [{ name: 'failing_tool', description: '' }]
      }),
      callTool: jest.fn().mockRejectedValue(new Error('tool execution error')),
    };
    Client.mockImplementationOnce(() => mockClient);

    await gw.connectStdio('srv', 'cmd', []);
    await expect(gw.callTool('failing_tool', {})).rejects.toThrow('tool execution error');
  });
});
