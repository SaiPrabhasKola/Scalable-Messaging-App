import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Message, MessageSchema } from './message.schema';
import { MessageService } from './message.service';
import { MessageProvider } from './message.processor';

@Module({
    imports: [
        MongooseModule.forFeature([
            {
                name: Message.name, schema: MessageSchema
            }
        ])
    ],
    providers: [MessageService, MessageProvider],
    exports: [MessageService]
})
export class MessageModule { }
