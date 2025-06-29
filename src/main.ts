import { TelegramClient } from '@mtcute/bun'

import * as env from './env.ts'

const tg = new TelegramClient({
    apiId: env.API_ID,
    apiHash: env.API_HASH,
    storage: 'bot-data/session',
})


const user = await tg.start()
console.log('Logged in as', user.username)
