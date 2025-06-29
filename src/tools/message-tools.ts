import type { TelegramClient, Dialog, Message } from '@mtcute/bun';
import type { ToolInfo } from './index.js';

export const messageTools: ToolInfo[] = [
  {
    name: 'messages_sendText',
    description: 'Send a text message to a chat',
    inputSchema: {
      type: 'object',
      properties: {
        chatId: {
          type: 'string',
          description: 'Chat/User ID or username to send message to',
        },
        text: {
          type: 'string',
          description: 'Message text to send',
        },
        replyToMessageId: {
          type: 'number',
          description: 'Optional message ID to reply to',
        },
      },
      required: ['chatId', 'text'],
    },
  },
  {
    name: 'messages_getHistory',
    description: 'Get message history from a chat',
    inputSchema: {
      type: 'object',
      properties: {
        chatId: {
          type: 'string',
          description: 'Chat/User ID or username to get messages from',
        },
        limit: {
          type: 'number',
          description: 'Number of messages to retrieve (default: 100, max: 100)',
          default: 100,
        },
        offsetId: {
          type: 'number',
          description: 'Message ID to start from (for pagination)',
        },
      },
      required: ['chatId'],
    },
  },
  {
    name: 'messages_search',
    description: 'Search for messages in a chat',
    inputSchema: {
      type: 'object',
      properties: {
        chatId: {
          type: 'string',
          description: 'Chat/User ID or username to search in (optional, searches all chats if not provided)',
        },
        query: {
          type: 'string',
          description: 'Search query',
        },
        limit: {
          type: 'number',
          description: 'Number of messages to retrieve (default: 50)',
          default: 50,
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'messages_getRecent',
    description: 'Get recent messages from all chats',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Number of recent chats to include (default: 10)',
          default: 10,
        },
        messagesPerChat: {
          type: 'number',
          description: 'Number of messages per chat (default: 10)',
          default: 10,
        },
      },
    },
  },
];

export async function handleMessageTools(
  name: string,
  args: any,
  client: TelegramClient
) {
  switch (name) {
    case 'messages_sendText':
      return await sendTextMessage(client, args);
    case 'messages_getHistory':
      return await getMessageHistory(client, args);
    case 'messages_search':
      return await searchMessages(client, args);
    case 'messages_getRecent':
      return await getRecentMessages(client, args);
    default:
      throw new Error(`Unknown message tool: ${name}`);
  }
}

async function sendTextMessage(client: TelegramClient, args: any) {
  const { chatId, text, replyToMessageId } = args;
  
  try {
    const sentMessage = await client.sendText(
      Number.isNaN(Number(chatId)) ? chatId : Number(chatId),
      text,
      {
        replyTo: replyToMessageId ? replyToMessageId : undefined,
      }
    );

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: formatMessage(sentMessage),
          }, null, 2),
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: `Error sending message: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
}

async function getMessageHistory(client: TelegramClient, args: any) {
  const { chatId, limit = 100, offsetId } = args;
  
  try {
    const messages = await client.getHistory(Number.isNaN(Number(chatId)) ? chatId : Number(chatId), {
      limit: Math.min(limit, 100),
      offset: offsetId ? { id: offsetId, date: 0 } : undefined,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            messages: messages.map(formatMessage),
            count: messages.length,
          }, null, 2),
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: `Error getting message history: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
}

async function searchMessages(client: TelegramClient, args: any) {
  const { chatId, query, limit = 50 } = args;
  
  try {
    const results: Message[] = [];
    
    if (chatId) {
      // Search in specific chat
      const messages = await client.searchMessages({
        chatId: Number.isNaN(Number(chatId)) ? chatId : Number(chatId),
        query,
        limit,
      });
      results.push(...messages);
    } else {
      // Search globally
      const messages = await client.searchGlobal({
        query,
        limit,
      });
      results.push(...messages);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            messages: results.map(formatMessage),
            count: results.length,
            query,
          }, null, 2),
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: `Error searching messages: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
}

async function getRecentMessages(client: TelegramClient, args: any) {
  const { limit = 10, messagesPerChat = 10 } = args;
  
  try {
    const recentChats: Array<{
      dialog: any;
      messages: any[];
    }> = [];

    let count = 0;
    for await (const dialog of client.iterDialogs()) {
      if (count >= limit) break;
      
      const messages = await client.getHistory(dialog.peer, {
        limit: messagesPerChat,
      });

      recentChats.push({
        dialog: {
          id: dialog.peer.id,
          name: dialog.peer.displayName || `Chat ${dialog.peer.id}`,
          username: dialog.peer.username,
          type: dialog.peer.type,
          lastMessageDate: dialog.lastMessage?.date,
        },
        messages: messages.map(formatMessage),
      });

      count++;
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            chats: recentChats,
            count: recentChats.length,
          }, null, 2),
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: `Error getting recent messages: ${error.message}`,
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