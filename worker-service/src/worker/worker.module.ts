import { Module } from '@nestjs/common';
import { WorkerService } from './worker.service';
import { MessageModule } from 'src/message/message.module';

@Module({
  imports: [MessageModule],
  providers: [WorkerService]
})
export class WorkerModule { }
