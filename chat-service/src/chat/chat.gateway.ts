import {
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';

import * as jwt from 'jsonwebtoken'
import * as fs from 'fs';
import * as path from 'path'


import { Server, Socket } from 'socket.io'
import { verify } from 'crypto';
@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ChatGateway
  implements OnGatewayConnection, OnGatewayDisconnect {
  constructor() {
    this.publicKey = fs.readFileSync(
      path.join(process.cwd(), 'keys/public.key'),
      'utf-8'
    )
  }

  private publicKey: string;

  @WebSocketServer()
  server: Server;
  handleConnection(client: any, ...args: any[]) {
    try {
      const token = client.handshake.auth?.token;
      if (!token) {
        throw new Error("No token provided")
      }
      const decoded = jwt.verify(token, this.publicKey, {
        algorithms: ['RS256']
      })
      client.data.user = decoded
      console.log('authenticated user:', decoded)
    } catch (err) {
      console.log('error: ', err.message);
      client.disconnect()
    }


  }

  handleDisconnect(client: Socket) {
    console.log('Client disconnected:', client.id);
  }
  @SubscribeMessage('message')
  handleMessage(
    @MessageBody() data: any,
    @ConnectedSocket() client: Socket
  ) {
    const user = client.data.user
    console.log(`Message: ${data}`);

    client.emit(`message`, {
      userId: user.userId,
      data
    })
  }
}
