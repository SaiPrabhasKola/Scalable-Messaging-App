import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { ChatGateway } from './chat/chat.gateway';
import { RedisModule } from './redis/redis.module';
import { ChatService } from './chat/chat.service';
import { SnowflakeService } from './snowflake/snowflake.service';
import { SnowflakeModule } from './snowflake/snowflake.module';
import { QueueService } from './queue/queue.service';
import { QueueModule } from './queue/queue.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    RedisModule,
    SnowflakeModule,
    QueueModule
  ],
  controllers: [AppController],
  providers: [AppService, ChatGateway, ChatService, SnowflakeService, QueueService],
})
export class AppModule { }
