import { Injectable } from '@nestjs/common';

@Injectable()
export class ChatService {
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

    createMessage(senderId: string, receiverId: string, content: string) {
        console.log(content)
        return {
            id: Date.now().toString(),
            senderId,
            receiverId,
            conversationId: this.getConversationId(senderId, receiverId),
            content,
            createdAt: Date.now()
        }
    }
}
