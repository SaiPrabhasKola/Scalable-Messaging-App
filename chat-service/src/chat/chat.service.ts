import { Injectable } from '@nestjs/common';
import { QueueService } from 'src/queue/queue.service';
import { SnowflakeService } from 'src/snowflake/snowflake.service';

@Injectable()
export class ChatService {

    constructor(
        private readonly queueService: QueueService,
        private readonly snowflakeService: SnowflakeService

    ) { }
    private userSockets = new Map<string, Set<string>>();

    addUser(userId: string, socketId: string) {
        if (!this.userSockets.has(userId)) {
            this.userSockets.set(userId, new Set());
        }
        this.userSockets.get(userId)!.add(socketId)
    }

    removeUser(userId: string, socketId: string) {
        const sockets = this.userSockets.get(userId);

        if (!sockets) return;

        sockets.delete(socketId);

        if (sockets.size === 0) this.userSockets.delete(userId);
    }

    getUserSockets(userId: string): string[] {
        return Array.from(this.userSockets.get(userId) || [])
    }

    getConversationId(user1: string, user2: string) {
        return [user1, user2].sort().join('_')
    }

    async createMessage(senderId: string, receiverId: string, content: string) {
        console.log(content)
        const message = {
            id: this.snowflakeService.generate(),
            senderId,
            receiverId,
            conversationId: this.getConversationId(senderId, receiverId),
            content,
            createdAt: Date.now()
        }
        console.log(message)
        await this.queueService.addMessageJob(message)

        return message
    }
}
