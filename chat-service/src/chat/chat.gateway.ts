// src/chat/chat.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';

import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { RedisService } from '../redis/redis.service';
import * as jwt from 'jsonwebtoken'
import * as fs from 'fs';
import * as path from 'path';

@WebSocketGateway({
  cors: { origin: '*' },
})
export class ChatGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  @WebSocketServer()
  server: Server;

  private serverId = Math.random().toString();

  constructor(
    private readonly chatService: ChatService,
    private readonly redisService: RedisService,
  ) { }




  afterInit() {
    this.redisService.subscribe('chat_message', (message) => {
      // ❗ prevent duplicate emit
      if (message.serverId === this.serverId) return;

      const sockets = this.chatService.getUserSockets(
        message.receiverId,
      );

      sockets.forEach((socketId) => {
        this.server.to(socketId).emit('receiveMessage', message);
      });
    });
  }


  handleConnection(client: Socket) {
    try {
      const publicKey = fs.readFileSync(
      path.join(process.cwd(), 'keys/public.key'),
      'utf-8'
    )
      const token = client.handshake.auth?.token

      const payload: any = jwt.verify(token, publicKey, { algorithms: ['RS256'] })
      const userId = payload.id
      client.data.user = { userId };

      this.chatService.addUser(userId, client.id);

      console.log(`User ${userId} connected`);
    } catch (error) {
      console.log('Auth failed')
      client.disconnect()
    }
  }


  handleDisconnect(client: Socket) {
    const userId = client.data.user?.userId;
    if (!userId) return;

    this.chatService.removeUser(userId, client.id);
  }


  @SubscribeMessage('sendMessage')
  async handleMessage(
    @MessageBody()
    data: { targetUserId: string; message: string },
    @ConnectedSocket() client: Socket,
  ) {
    console.log('publishnig')
    const senderId = client.data.user.userId;

    const message = this.chatService.createMessage(
      senderId,
      data.targetUserId,
      data.message,
    );

    const localSockets = this.chatService.getUserSockets(
      data.targetUserId,
    );

    localSockets.forEach((socketId) => {
      this.server.to(socketId).emit('receiveMessage', message);
    });

    await this.redisService.publish('chat_message', {
      ...message,
      serverId: this.serverId,
    });

    return message;
  }
}