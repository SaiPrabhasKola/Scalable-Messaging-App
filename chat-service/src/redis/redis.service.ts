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
        await this.pubClient.publish(channel, JSON.stringify(message));
    }

    subscribe(channel: string, handler: (data: any) => void) {
        this.init();

        this.subClient.subscribe(channel);

        this.subClient.on('message', (ch, msg) => {
            console.log(msg)
            if (ch === channel) {
                handler(JSON.parse(msg));
            }
        });
    }

    async setUserOnline(userId: string, serverId: string) {
        await this.pubClient.hset('online_users', userId, serverId);
    }

    async removeUser(userId: string) {
        await this.pubClient.hdel('online_userts', userId);
    }

    async getUserServer(userId: string): Promise<string | null> {
        return await this.pubClient.hget('online_users', userId);
    }

    async isUserOnline(userId: string): Promise<boolean> {
        const res = await this.pubClient.hexists('online_users', userId);
        return res === 1
    }
}