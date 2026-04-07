import type { TelegramClient } from '@mtcute/bun';
import Long from 'long';
import type { ToolInfo } from './index.js';

export const statusTools: ToolInfo[] = [
  {
    name: 'status_getCurrent',
    description: 'Get the current Telegram emoji status for yourself or another peer.',
    inputSchema: {
      type: 'object',
      properties: {
        peerId: {
          type: 'string',
          description: 'Target peer. Use "self" for your own account. Defaults to "self".',
          default: 'self',
        },
      },
    },
  },
  {
    name: 'status_setEmoji',
    description: 'Set or clear a Telegram emoji status for yourself or a channel/supergroup you can manage.',
    inputSchema: {
      type: 'object',
      properties: {
        peerId: {
          type: 'string',
          description: 'Target peer. Use "self" for your own account. Defaults to "self".',
          default: 'self',
        },
        emojiId: {
          type: 'string',
          description: 'Custom emoji document ID to set. Required unless clear=true.',
        },
        isCollectible: {
          type: 'boolean',
          description: 'Whether emojiId is a collectible ID instead of a custom emoji document ID. Collectibles can only be set on self.',
          default: false,
        },
        until: {
          type: 'string',
          description: 'Optional expiration time as an ISO-8601 string or Unix timestamp string.',
        },
        clear: {
          type: 'boolean',
          description: 'Clear the current emoji status instead of setting one.',
          default: false,
        },
      },
    },
  },
  {
    name: 'status_listAvailable',
    description: 'List Telegram custom emoji IDs from the default emoji-status sticker set.',
    inputSchema: {
      type: 'object',
      properties: {
        scope: {
          type: 'string',
          description: 'Which default status set to inspect: "self" or "channel". Defaults to "self".',
          default: 'self',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of emoji IDs to return (default: 100).',
          default: 100,
        },
      },
    },
  },
  {
    name: 'status_listCollectibles',
    description: 'List owned unique gift IDs that can be used as collectible emoji statuses on your own account.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: {
          type: 'string',
          description: 'Owner whose saved gifts to inspect. Defaults to "self". Collectible statuses are only usable on self.',
          default: 'self',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of collectible IDs to return (default: 100).',
          default: 100,
        },
      },
    },
  },
];

export async function handleStatusTools(
  name: string,
  args: any,
  client: TelegramClient
) {
  switch (name) {
    case 'status_getCurrent':
      return await getCurrentStatus(client, args);
    case 'status_setEmoji':
      return await setEmojiStatus(client, args);
    case 'status_listAvailable':
      return await listAvailableStatuses(client, args);
    case 'status_listCollectibles':
      return await listCollectibleStatuses(client, args);
    default:
      throw new Error(`Unknown status tool: ${name}`);
  }
}

async function getCurrentStatus(client: TelegramClient, args: any) {
  const { peerId = 'self' } = args;

  try {
    const peer = peerId === 'self'
      ? await client.getMe()
      : await client.getPeer(normalizePeerId(peerId));

    const emojiStatus = 'emojiStatus' in peer ? peer.emojiStatus : null;

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            peerId,
            peer: {
              id: peer.id,
              username: peer.username ?? null,
              displayName: peer.displayName,
            },
            emojiStatus: emojiStatus ? {
              emojiId: emojiStatus.emoji.toString(),
              expireDate: emojiStatus.expireDate?.toISOString() ?? null,
              collectible: emojiStatus.collectible ? {
                id: emojiStatus.collectible.id.toString(),
                slug: emojiStatus.collectible.slug,
                title: emojiStatus.collectible.title,
                patternEmojiId: emojiStatus.collectible.patternEmojiId.toString(),
                colors: emojiStatus.collectible.colors,
              } : null,
            } : null,
          }, null, 2),
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: `Error getting current emoji status: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
}

async function setEmojiStatus(client: TelegramClient, args: any) {
  const {
    peerId = 'self',
    emojiId,
    isCollectible = false,
    until,
    clear = false,
  } = args;

  try {
    if (!clear && !emojiId) {
      throw new Error('emojiId is required unless clear=true');
    }

    if (isCollectible && peerId !== 'self') {
      throw new Error('Collectible emoji statuses can only be set on self');
    }

    await client.setEmojiStatus({
      peerId: normalizePeerId(peerId),
      emoji: clear ? null : parseLongId(emojiId, isCollectible ? 'collectible ID' : 'emoji ID'),
      isCollectible,
      until: parseUntil(until),
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            peerId,
            cleared: clear,
            emojiId: clear ? null : String(emojiId),
            isCollectible,
            until: until ?? null,
          }, null, 2),
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: `Error setting emoji status: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
}

async function listAvailableStatuses(client: TelegramClient, args: any) {
  const { scope = 'self', limit = 100 } = args;

  try {
    if (scope !== 'self' && scope !== 'channel') {
      throw new Error('scope must be "self" or "channel"');
    }

    const stickerSet = await client.getStickerSet({
      system: scope === 'channel' ? 'default_channel_statuses' : 'default_statuses',
    });

    const items = stickerSet.stickers
      .slice(0, Math.max(0, limit))
      .map((item) => ({
        emojiId: item.sticker.customEmojiId.toString(),
        fallbackEmoji: item.alt,
        emojis: item.emoji,
        title: item.sticker.emoji,
        isFree: item.sticker.customEmojiFree,
        sourceType: item.sticker.sourceType,
      }));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            scope,
            stickerSet: {
              title: stickerSet.title,
              shortName: stickerSet.shortName,
              count: stickerSet.count,
            },
            items,
          }, null, 2),
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: `Error listing available emoji statuses: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
}

async function listCollectibleStatuses(client: TelegramClient, args: any) {
  const { owner = 'self', limit = 100 } = args;

  try {
    const gifts = await client.getSavedStarGifts({
      owner: normalizePeerId(owner),
      limit: Math.max(0, limit),
      excludeUnique: false,
    });

    const items = gifts.flatMap((gift) => {
      if (!gift.gift.isUnique) {
        return [];
      }

      const uniqueGift = gift.gift as Extract<typeof gift.gift, { isUnique: true }>;

      return [{
        collectibleId: uniqueGift.raw.id.toString(),
        title: uniqueGift.title,
        slug: uniqueGift.slug,
        patternEmojiId: uniqueGift.model.sticker.customEmojiId.toString(),
        modelName: uniqueGift.model.name,
        patternName: uniqueGift.pattern.name,
        backdropName: uniqueGift.backdrop.name,
        ownerId: uniqueGift.ownerId,
        ownerName: uniqueGift.ownerName,
        savedId: gift.savedId?.toString() ?? null,
        date: gift.date.toISOString(),
      }];
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            owner,
            collectibles: items,
            count: items.length,
          }, null, 2),
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: `Error listing collectible emoji statuses: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
}

function normalizePeerId(peerId: string) {
  const numericPeerId = Number(peerId);
  return Number.isNaN(numericPeerId) ? peerId : numericPeerId;
}

function parseLongId(value: unknown, name: string) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${name} must be a non-empty string`);
  }

  return Long.fromString(value);
}

function parseUntil(value: unknown): number | Date | undefined {
  if (value == null || value === '') {
    return undefined;
  }

  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    if (/^\d+$/.test(value)) {
      return Number(value);
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error('until must be an ISO-8601 string or Unix timestamp');
    }

    return parsed;
  }

  throw new Error('until must be an ISO-8601 string or Unix timestamp');
}
