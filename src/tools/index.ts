import type { TelegramClient } from '@mtcute/bun';
import { messageTools, handleMessageTools } from './message-tools.js';
import { dialogTools, handleDialogTools } from './dialog-tools.js';
import { waitTools, handleWaitTools, setupMessageListener } from './wait-tools.js';

export type ToolInfo = {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
};

export function registerTools(): ToolInfo[] {
  return [
    ...messageTools,
    ...dialogTools,
    ...waitTools,
  ];
}

export async function handleToolCall(
  name: string,
  args: any,
  client: TelegramClient
) {
  // Route to appropriate handler based on tool name prefix
  if (name.startsWith('messages_')) {
    return handleMessageTools(name, args, client);
  } else if (name.startsWith('dialogs_')) {
    return handleDialogTools(name, args, client);
  } else if (name === 'wait_for_reply') {
    return handleWaitTools(name, args, client);
  }

  throw new Error(`Unknown tool: ${name}`);
}

export { setupMessageListener };