import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Message, MessageDocument } from './message.schema';
import { Model } from 'mongoose';

@Injectable()
export class MessageService {
    constructor(
        @InjectModel(Message.name)
        private messageModel: Model<MessageDocument>
    ) { }

    async saveMessage(data: any) {
        const result = await this.messageModel.create({
            messageId: data.id,
            senderId: data.senderId,
            receiverId: data.receiverId,
            content: data.content,
            createdAt: data.createdAt
        })
        console.log(`message saved to DB`, result)
    }
}
