import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { StorageController } from './storage.controller';
import { StorageService } from './storage.service';
import { FileMetadata } from './entities/file-metadata.entity';
import { ApiKeyGuard } from './guards/api-key.guard';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([FileMetadata]),
  ],
  controllers: [StorageController],
  providers: [StorageService, ApiKeyGuard],
  exports: [StorageService],
})
export class StorageModule {}
