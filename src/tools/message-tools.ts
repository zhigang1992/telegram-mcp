import type { TelegramClient, Dialog, Message } from '@mtcute/bun';
import type { ToolInfo } from './index.js';
import { md } from '@mtcute/markdown-parser';

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
    description: 'Get message history from a chat, including media attachments (photos, videos, documents, etc.)',
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
        includeMedia: {
          type: 'boolean',
          description: 'Download media and save to temp files. Returns file paths that can be uploaded via uploadfile-mcp. Supports photos, videos, documents, audio, and voice messages. Default: false',
          default: false,
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
  const { chatId, limit = 100, offsetId, includeMedia = false } = args;

  try {
    const messages = await client.getHistory(Number.isNaN(Number(chatId)) ? chatId : Number(chatId), {
      limit: Math.min(limit, 100),
      offset: offsetId ? { id: offsetId, date: 0 } : undefined,
    });

    const content: any[] = [];

    // Add text summary
    content.push({
      type: 'text',
      text: JSON.stringify({
        messages: messages.map(formatMessage),
        count: messages.length,
      }, null, 2),
    });

    // Download media to temp files
    if (includeMedia) {
      const fs = await import('fs/promises');
      const path = await import('path');
      const os = await import('os');

      const supportedMediaTypes = ['photo', 'video', 'document', 'voice', 'audio'];

      for (const msg of messages) {
        if (msg.media && supportedMediaTypes.includes(msg.media.type)) {
          try {
            // Download media
            const buffer = await client.downloadAsBuffer(msg.media);

            // Save to temp file
            const tempDir = os.tmpdir();
            const ext = getFileExtension(msg.media);
            const fileName = `tg-${msg.chat.id}-${msg.id}.${ext}`;
            const filePath = path.join(tempDir, fileName);

            await fs.writeFile(filePath, buffer);

            // Build result object
            const result: any = {
              messageId: msg.id,
              chatId: msg.chat.id,
              mediaType: msg.media.type,
              localPath: filePath,
              fileSize: formatFileSize(buffer.length),
            };

            // Add optional metadata
            if (msg.media.fileName) {
              result.originalFileName = msg.media.fileName;
            }
            if (msg.media.duration) {
              result.duration = msg.media.duration;
            }
            if (msg.media.width && msg.media.height) {
              result.dimensions = `${msg.media.width}x${msg.media.height}`;
            }
            if (msg.media.mimeType) {
              result.mimeType = msg.media.mimeType;
            }

            content.push({
              type: 'text',
              text: JSON.stringify(result, null, 2),
            });
          } catch (err: any) {
            console.error(`Failed to download ${msg.media.type} from message ${msg.id}:`, err.message);
          }
        }
      }
    }

    return { content };
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

function formatMedia(media: any) {
  if (!media) return null;

  const baseInfo: any = {
    type: media.type,
  };

  // Handle different media types
  switch (media.type) {
    case 'photo':
      return {
        ...baseInfo,
        id: media.id?.toString(),
        width: media.width,
        height: media.height,
        fileId: media.fileId,
        hasSpoiler: media.hasSpoiler,
      };

    case 'video':
      return {
        ...baseInfo,
        id: media.id?.toString(),
        duration: media.duration,
        width: media.width,
        height: media.height,
        fileName: media.fileName,
        mimeType: media.mimeType,
        fileSize: media.fileSize,
        fileId: media.fileId,
        hasSpoiler: media.hasSpoiler,
      };

    case 'document':
      return {
        ...baseInfo,
        id: media.id?.toString(),
        fileName: media.fileName,
        mimeType: media.mimeType,
        fileSize: media.fileSize,
        fileId: media.fileId,
      };

    case 'audio':
      return {
        ...baseInfo,
        id: media.id?.toString(),
        duration: media.duration,
        title: media.title,
        performer: media.performer,
        fileName: media.fileName,
        mimeType: media.mimeType,
        fileSize: media.fileSize,
        fileId: media.fileId,
      };

    case 'voice':
      return {
        ...baseInfo,
        id: media.id?.toString(),
        duration: media.duration,
        mimeType: media.mimeType,
        fileSize: media.fileSize,
        fileId: media.fileId,
      };

    case 'sticker':
      return {
        ...baseInfo,
        id: media.id?.toString(),
        emoji: media.emoji,
        isAnimated: media.isAnimated,
        isVideo: media.isVideo,
        width: media.width,
        height: media.height,
        fileId: media.fileId,
      };

    case 'location':
    case 'live_location':
      return {
        ...baseInfo,
        latitude: media.latitude,
        longitude: media.longitude,
      };

    case 'contact':
      return {
        ...baseInfo,
        phoneNumber: media.phoneNumber,
        firstName: media.firstName,
        lastName: media.lastName,
        userId: media.userId,
      };

    case 'poll':
      return {
        ...baseInfo,
        id: media.id?.toString(),
        question: media.question,
        closed: media.closed,
        totalVoters: media.totalVoters,
      };

    case 'web_page':
      return {
        ...baseInfo,
        url: media.url,
        displayUrl: media.displayUrl,
        siteName: media.siteName,
        title: media.title,
        description: media.description,
      };

    default:
      // For unknown media types, try to extract basic info
      return baseInfo;
  }
}

function formatMessage(msg: Message) {
  const textWithEntities = msg.textWithEntities;
  const textMarkdown = textWithEntities.entities && textWithEntities.entities.length > 0
    ? md.unparse(textWithEntities)
    : msg.text;

  return {
    id: msg.id,
    date: msg.date,
    text: msg.text,
    textMarkdown: textMarkdown,
    senderId: msg.sender.id,
    senderName: msg.sender.displayName || msg.sender.username || `User ${msg.sender.id}`,
    senderUsername: msg.sender.username,
    isOutgoing: msg.isOutgoing,
    chatId: msg.chat.id,
    chatName: msg.chat.displayName || msg.chat.username || `Chat ${msg.chat.id}`,
    media: formatMedia(msg.media),
  };
}

function getFileExtension(media: any): string {
  const typeMap: Record<string, string> = {
    photo: 'jpg',
    video: 'mp4',
    voice: 'ogg',
    audio: 'mp3',
  };

  if (media.type === 'document' && media.fileName) {
    const ext = media.fileName.split('.').pop();
    return ext || 'bin';
  }

  return typeMap[media.type] || 'bin';
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}