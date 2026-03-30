import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import mongoose from 'mongoose';
async function bootstrap() {
  mongoose.connection.on('connected', () => {
    console.log(mongoose.connection.name)
  })
  const app = await NestFactory.createApplicationContext(AppModule);

  console.log('🚀 Worker started');
}
bootstrap();