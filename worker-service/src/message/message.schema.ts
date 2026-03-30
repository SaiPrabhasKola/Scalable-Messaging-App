import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document } from "mongoose";

export type MessageDocument = Message & Document

@Schema()
export class Message {
    @Prop({ required: true, unique: true })
    messageId: string;

    @Prop({ required: true })
    senderId: string;

    @Prop({ required: true })
    receiverId: string;

    @Prop({ required: true })
    content: string;

    @Prop({ required: true })
    createdAt: number

    @Prop({ default: 'sent' })
    status: string;
}

export const MessageSchema = SchemaFactory.createForClass(Message)