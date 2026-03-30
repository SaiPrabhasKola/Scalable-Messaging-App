import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';

@Injectable()
export class QueueService {
    private messageQ: Queue;

    constructor() {
        this.messageQ = new Queue('message-queue', {
            connection: {
                host: 'localhost',
                port: 6739
            }
        })
    }

    async addMessageJob(data: any) {
        await this.messageQ.add('new-message', data, {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 1000
            }
        })
    }
}
