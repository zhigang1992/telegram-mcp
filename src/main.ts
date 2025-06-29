import { TelegramServer } from './server/telegram-server.js';

async function main() {
  const server = new TelegramServer();
  
  try {
    await server.start();
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main().catch(console.error);
