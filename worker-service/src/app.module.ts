import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { connection, Mongoose } from 'mongoose';
import { MongooseModule } from '@nestjs/mongoose';
import { WorkerModule } from './worker/worker.module';
import { MessageService } from './message/message.service';
import { MessageModule } from './message/message.module';

@Module({
  imports: [
    MongooseModule.forRoot('mongodb://localhost:27017/chat-db', {
      connectionFactory: (connection) => {
        console.log(connection.name)
        return connection
      }
    }),
    MessageModule,
  ],
  controllers: [AppController],
  providers: [AppService,],
})
export class AppModule {}
