import type { TelegramClient, Message } from '@mtcute/bun';
import { Dispatcher } from '@mtcute/dispatcher';
import type { ToolInfo } from './index.js';

// Store active wait contexts
const activeWaits = new Map<string, {
  resolve: (msg: Message) => void;
  reject: (err: Error) => void;
  timeout: NodeJS.Timeout;
}>();

export const waitTools: ToolInfo[] = [
  {
    name: 'wait_for_reply',
    description: 'Wait for the next message in a chat',
    inputSchema: {
      type: 'object',
      properties: {
        chatId: {
          type: 'string',
          description: 'Chat/User ID or username to wait for a message from',
        },
        timeoutSeconds: {
          type: 'number',
          description: 'Timeout in seconds (default: 60, max: 300)',
          default: 60,
        },
      },
      required: ['chatId'],
    },
  },
];

export async function handleWaitTools(
  name: string,
  args: any,
  client: TelegramClient
) {
  switch (name) {
    case 'wait_for_reply':
      return await waitForReply(client, args);
    default:
      throw new Error(`Unknown wait tool: ${name}`);
  }
}

// Set up global message listener
export function setupMessageListener(client: TelegramClient) {
  const dp = Dispatcher.for(client);
  
  dp.onNewMessage(async (msg) => {
    if (msg.isOutgoing) {
      // Skip outgoing messages
      return;
    }
    
    console.error(`New message: ${msg.text}, from ${msg.sender.username} chatId: ${msg.chat.id}`);
    // Only process incoming messages
    const chatId = String(msg.chat.id);
    const waitContext = activeWaits.get(chatId);
    
    if (waitContext) {
      // Clear the timeout and resolve the promise
      clearTimeout(waitContext.timeout);
      activeWaits.delete(chatId);
      waitContext.resolve(msg);
    }
  });
}

async function waitForReply(client: TelegramClient, args: any) {
  const { chatId, timeoutSeconds = 60 } = args;
  const timeoutMs = Math.min(timeoutSeconds * 1000, 300000); // Max 5 minutes
  
  // Use the provided chatId directly as string for the map key
  const numericChatId = Number(chatId);
  const resolvedChatId = Number.isNaN(numericChatId) ? chatId : numericChatId;
  const chatIdStr = String(chatId);
  
  try {
    // Check if already waiting for this chat
    if (activeWaits.has(chatIdStr)) {
      throw new Error(`Already waiting for a message from chat ${chatId}`);
    }
    
    // Set up a promise that will resolve when we get a message
    const waitStartTime = Date.now();
    const messagePromise = new Promise<Message>((resolve, reject) => {
      const timeout = setTimeout(() => {
        activeWaits.delete(chatIdStr);
        reject(new Error(`Timeout waiting for message after ${timeoutSeconds} seconds`));
      }, timeoutMs);

      activeWaits.set(chatIdStr, { resolve, reject, timeout });
    });

    // Wait for the message
    const message = await messagePromise;
    const waitTimeMs = Date.now() - waitStartTime;

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: formatMessage(message),
            waitTimeMs,
            waitTimeSeconds: Math.round(waitTimeMs / 1000),
          }, null, 2),
        },
      ],
    };
  } catch (error: any) {
    // Clean up on error
    activeWaits.delete(chatIdStr);
    
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
}

function formatMessage(msg: Message) {
  return {
    id: msg.id,
    date: msg.date,
    text: msg.text,
    senderId: msg.sender.id,
    senderName: msg.sender.displayName || msg.sender.username || `User ${msg.sender.id}`,
    senderUsername: msg.sender.username,
    isOutgoing: msg.isOutgoing,
    chatId: msg.chat.id,
    chatName: msg.chat.displayName || msg.chat.username || `Chat ${msg.chat.id}`,
  };
}