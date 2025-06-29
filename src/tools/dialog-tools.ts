import type { TelegramClient, Dialog } from '@mtcute/bun';
import type { ToolInfo } from './index.js';

export const dialogTools: ToolInfo[] = [
  {
    name: 'dialogs_list',
    description: 'List all dialogs (chats)',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of dialogs to return (default: 50)',
          default: 50,
        },
        filter: {
          type: 'object',
          description: 'Filter options',
          properties: {
            onlyUsers: {
              type: 'boolean',
              description: 'Only show user chats',
            },
            onlyGroups: {
              type: 'boolean',
              description: 'Only show group chats',
            },
            onlyChannels: {
              type: 'boolean',
              description: 'Only show channels',
            },
          },
        },
      },
    },
  },
  {
    name: 'dialogs_getInfo',
    description: 'Get detailed information about a specific dialog',
    inputSchema: {
      type: 'object',
      properties: {
        chatId: {
          type: 'string',
          description: 'Chat/User ID or username',
        },
      },
      required: ['chatId'],
    },
  },
];

export async function handleDialogTools(
  name: string,
  args: any,
  client: TelegramClient
) {
  switch (name) {
    case 'dialogs_list':
      return await listDialogs(client, args);
    case 'dialogs_getInfo':
      return await getDialogInfo(client, args);
    default:
      throw new Error(`Unknown dialog tool: ${name}`);
  }
}

async function listDialogs(client: TelegramClient, args: any) {
  const { limit = 50, filter = {} } = args;
  
  try {
    const dialogs: Dialog[] = [];
    let count = 0;

    for await (const dialog of client.iterDialogs()) {
      if (count >= limit) break;

      // Apply filters
      if (filter.onlyUsers && dialog.peer.type !== 'user') continue;
      if (filter.onlyGroups && dialog.peer.type !== 'chat') continue;
      if (filter.onlyChannels && dialog.peer.type !== 'chat') continue;

      dialogs.push(dialog);
      count++;
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            dialogs: dialogs.map(formatDialog),
            count: dialogs.length,
          }, null, 2),
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: `Error listing dialogs: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
}

async function getDialogInfo(client: TelegramClient, args: any) {
  const { chatId } = args;
  
  try {
    // Find the dialog first
    let dialog: Dialog | null = null;
    const numericChatId = Number(chatId);
    const searchId = Number.isNaN(numericChatId) ? chatId : numericChatId;
    
    for await (const d of client.iterDialogs()) {
      if (d.peer.id === searchId || d.peer.username === chatId) {
        dialog = d;
        break;
      }
    }

    if (!dialog) {
      throw new Error('Dialog not found');
    }

    // Get full info about the peer
    let fullInfo: any = {};
    if (dialog.peer.type === 'user') {
      const userFull = await client.getFullUser(dialog.peer);
      fullInfo = {
        bio: userFull.bio,
        commonChatsCount: userFull.commonChatsCount,
        isBlocked: userFull.isBlocked,
      };
    } else if (dialog.peer.type === 'chat') {
      const chatFull = await client.getFullChat(dialog.peer);
      fullInfo = {
        bio: chatFull.bio,
        participantsCount: chatFull.onlineCount || 0,
        adminsCount: chatFull.adminsCount,
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            peer: {
              id: dialog.peer.id,
              type: dialog.peer.type,
              username: dialog.peer.username,
              displayName: dialog.peer.displayName,
            },
            dialog: formatDialog(dialog),
            fullInfo,
          }, null, 2),
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: `Error getting dialog info: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
}

function formatDialog(dialog: Dialog) {
  return {
    id: dialog.peer.id,
    name: dialog.peer.displayName || `Chat ${dialog.peer.id}`,
    username: dialog.peer.username,
    type: dialog.peer.type,
    unreadCount: dialog.unreadCount,
    unreadMentionsCount: dialog.unreadMentionsCount,
    isPinned: dialog.isPinned,
    isMuted: dialog.isMuted,
    lastMessage: dialog.lastMessage ? {
      id: dialog.lastMessage.id,
      date: dialog.lastMessage.date,
      text: dialog.lastMessage.text,
      isOutgoing: dialog.lastMessage.isOutgoing,
    } : null,
  };
}