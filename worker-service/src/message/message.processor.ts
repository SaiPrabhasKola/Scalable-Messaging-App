import { Worker } from 'bullmq'
import { MessageService } from './message.service';
import { Injectable, OnModuleInit } from '@nestjs/common';

@Injectable()
export class MessageProvider implements OnModuleInit {
    constructor(
        private readonly messageService: MessageService
    ) { }

    onModuleInit() {
        new Worker(
            'message-queue',
            async (job) => {
                const message = job.data

                console.log('message processing')

                await this.messageService.saveMessage(message)
            }, {
            connection: {
                host: 'localhost',
                port: 6379
            }
        }
        )
    }
}
