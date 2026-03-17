import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    console.log(`${process.env.AUTH_PORT}`)
    return 'Hello World!';
  }
}
