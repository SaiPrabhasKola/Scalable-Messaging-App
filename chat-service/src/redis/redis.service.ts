import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService {
    private pubClient: Redis;
    private subClient: Redis;
    private initialized = false;

    private init() {
        if (this.initialized) return;

        this.pubClient = new Redis();
        this.subClient = new Redis();

        this.initialized = true;
    }

    async publish(channel: string, message: any) {
        this.init();
        console.log('pubbn to redis')
        await this.pubClient.publish(channel, JSON.stringify(message));
    }

    async subscribe(channel: string, handler: (msg: any) => void) {
        this.init();

        console.log('SUBSCRIBING TO:', channel);

        await this.subClient.subscribe(channel);

        this.subClient.on('message', (ch: string, msg: string) => {
            if (ch !== channel) return;

            console.log('RAW REDIS MESSAGE:', msg);

            const parsed = JSON.parse(msg);
            handler(parsed);
        });
    }

    async setUserOnline(userId: string, serverId: string) {
        this.init()
        await this.pubClient.hset('online_users', userId, serverId);
    }

    async removeUser(userId: string) {
        this.init()
        await this.pubClient.hdel('online_users', userId);
    }

    async getUserServer(userId: string): Promise<string | null> {
        this.init()
        return await this.pubClient.hget('online_users', userId);
    }

    async isUserOnline(userId: string): Promise<boolean> {
        this.init()
        const res = await this.pubClient.hexists('online_users', userId);
        return res === 1
    }
}