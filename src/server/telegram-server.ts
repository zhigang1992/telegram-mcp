import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { TelegramClient } from '@mtcute/bun';
import * as path from 'node:path';
import * as env from '../env.js';
import { registerTools, handleToolCall, setupMessageListener } from '../tools/index.js';

export class TelegramServer {
  private server: Server;
  private telegramClient: TelegramClient | null = null;

  constructor() {
    this.server = new Server(
      {
        name: 'telegram-mcp',
        version: '0.0.1',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
    this.setupErrorHandling();
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: registerTools(),
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (!this.telegramClient) {
        throw new McpError(
          ErrorCode.InternalError,
          'Telegram client not initialized'
        );
      }

      return handleToolCall(request.params.name, request.params.arguments || {}, this.telegramClient);
    });
  }

  private setupErrorHandling() {
    process.on('SIGINT', async () => {
      await this.cleanup();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await this.cleanup();
      process.exit(0);
    });
  }

  private async cleanup() {
    if (this.telegramClient) {
      await this.telegramClient.disconnect();
    }
    await this.server.close();
  }

  async start() {
    // Initialize Telegram client
    this.telegramClient = new TelegramClient({
      apiId: env.API_ID,
      apiHash: env.API_HASH,
      storage: env.STORAGE_PATH,
    });

    try {
      // Print storage path for initial setup
      const absoluteStoragePath = path.resolve(env.STORAGE_PATH);
      console.error(`\n=== Telegram MCP Setup ===`);
      console.error(`Storage path: ${absoluteStoragePath}`);
      console.error(`\nIf this is your first run, you'll need to authenticate with your phone number.`);
      console.error(`After authentication, use the storage path above in your MCP configuration.\n`);
      
      const user = await this.telegramClient.start();
      
      // Set up message listener for wait_for_reply functionality
      setupMessageListener(this.telegramClient);
      
      console.error(`\nConnected to Telegram as ${user.username || user.id}`);
      console.error(`Storage path: ${absoluteStoragePath}`);
      console.error(`\nReady to accept MCP requests.`);
    } catch (error) {
      console.error('Failed to start Telegram client:', error);
      throw error;
    }

    // Start MCP server
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Telegram MCP server started');
  }
}