import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FileCategory, EntityType } from '../entities/file-metadata.entity';

export class UploadFileDto {
  @ApiProperty({ enum: FileCategory, description: 'Category of the file' })
  @IsEnum(FileCategory)
  category: FileCategory;

  @ApiPropertyOptional({ enum: EntityType, description: 'Type of entity this file belongs to' })
  @IsOptional()
  @IsEnum(EntityType)
  entityType?: EntityType;

  @ApiPropertyOptional({ description: 'ID of the entity this file belongs to' })
  @IsOptional()
  @IsUUID()
  entityId?: string;

  @ApiPropertyOptional({ description: 'ID of the user uploading the file' })
  @IsOptional()
  @IsUUID()
  uploadedBy?: string;

  @ApiPropertyOptional({ description: 'Description of the file' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Additional metadata as JSON' })
  @IsOptional()
  metadata?: Record<string, any>;
}
