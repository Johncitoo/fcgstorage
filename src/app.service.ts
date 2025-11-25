import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'FCG Storage Service v1.0 - File storage microservice';
  }
}
