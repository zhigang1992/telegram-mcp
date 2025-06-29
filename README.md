# telegram-mcp

A Model Context Protocol (MCP) server for interacting with Telegram using mtcute.

## Features

- Send text messages to chats
- Wait for incoming messages in specific chats
- Read messages from chats
- Search messages
- List and get information about dialogs (chats)
- Get recent messages across all chats

## Setup

### Installation

#### Option 1: Download Pre-built Binary

Download the latest release for your platform from the [releases page](https://github.com/yourusername/telegram-mcp/releases):

- **macOS (Apple Silicon)**: `telegram-mcp-darwin-arm64.tar.gz`
- **macOS (Intel)**: `telegram-mcp-darwin-x64.tar.gz`
- **Linux**: `telegram-mcp-linux-x64.tar.gz`
- **Windows**: `telegram-mcp-win-x64.exe.zip`

Extract the archive and make the binary executable (Unix systems):
```bash
tar -xzf telegram-mcp-*.tar.gz
chmod +x telegram-mcp
```

#### Option 2: Build from Source

1. Clone the repository and install dependencies:
   ```bash
   git clone https://github.com/yourusername/telegram-mcp.git
   cd telegram-mcp
   bun install
   ```

2. Build the executable:
   ```bash
   bun run build
   ```

### Initial Setup (First Time Only)

1. Get your Telegram API credentials from https://my.telegram.org

2. Run the initial setup to authenticate with Telegram:
   ```bash
   export API_ID=your_api_id
   export API_HASH=your_api_hash
   ./telegram-mcp
   ```
   
   The server will:
   - Prompt you to enter your phone number
   - Send you a verification code via Telegram
   - Ask for the verification code
   - Display the absolute storage path (you'll need this for MCP configuration)

3. Note the storage path displayed in the output. It will look something like:
   ```
   Storage path: /Users/username/telegram-mcp/bot-data/session
   ```

## Usage

### As an MCP Server

Add to your Claude Desktop config using the storage path from the initial setup:

```json
{
  "mcpServers": {
    "telegram": {
      "command": "/path/to/telegram-mcp",
      "env": {
        "API_ID": "your_api_id",
        "API_HASH": "your_api_hash",
        "TELEGRAM_STORAGE_PATH": "/absolute/path/from/initial/setup"
      }
    }
  }
}
```

**Important**: The `TELEGRAM_STORAGE_PATH` must be the absolute path shown during initial setup. This ensures the MCP server uses the authenticated session.

### Available Tools

#### Message Tools

- `messages_sendText` - Send a text message to a chat
  - `chatId` (required): Chat/User ID or username
  - `text` (required): Message text to send
  - `replyToMessageId`: Optional message ID to reply to

- `messages_getHistory` - Get message history from a chat
  - `chatId` (required): Chat/User ID or username
  - `limit`: Number of messages (default: 100, max: 100)
  - `offsetId`: Message ID for pagination

- `messages_search` - Search for messages
  - `query` (required): Search query
  - `chatId`: Specific chat to search in (optional)
  - `limit`: Number of results (default: 50)

- `messages_getRecent` - Get recent messages from all chats
  - `limit`: Number of chats (default: 10)
  - `messagesPerChat`: Messages per chat (default: 10)

#### Interactive Tools

- `wait_for_reply` - Wait for the next message in a chat
  - `chatId` (required): Chat/User ID or username to wait for a message from
  - `timeoutSeconds`: Timeout in seconds (default: 60, max: 300)

#### Dialog Tools

- `dialogs_list` - List all dialogs
  - `limit`: Maximum dialogs (default: 50)
  - `filter`: Filter options (onlyUsers, onlyGroups, onlyChannels)

- `dialogs_getInfo` - Get detailed dialog information
  - `chatId` (required): Chat/User ID or username

## Development

Run in development mode:
```bash
bun run dev
```

The server stores session data in `bot-data/` directory.