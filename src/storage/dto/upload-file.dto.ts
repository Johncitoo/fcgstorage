import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FileCategory, EntityType } from '../entities/file-metadata.entity';

/**
 * DTO para subida de archivos.
 * Define los metadatos que pueden enviarse junto con el archivo.
 * @class UploadFileDto
 */
export class UploadFileDto {
  /**
   * Categoría del archivo para organización interna.
   * Determina el subdirectorio de almacenamiento.
   */
  @ApiProperty({ enum: FileCategory, description: 'Category of the file' })
  @IsEnum(FileCategory)
  category: FileCategory;

  /**
   * Tipo de entidad a la que pertenece el archivo (opcional).
   * Permite asociar archivos con usuarios, aplicaciones, etc.
   */
  @ApiPropertyOptional({ enum: EntityType, description: 'Type of entity this file belongs to' })
  @IsOptional()
  @IsEnum(EntityType)
  entityType?: EntityType;

  /**
   * ID de la entidad específica asociada (opcional).
   * Debe ser un UUID válido.
   */
  @ApiPropertyOptional({ description: 'ID of the entity this file belongs to' })
  @IsOptional()
  @IsUUID()
  entityId?: string;

  /**
   * ID del usuario que sube el archivo (opcional).
   * Permite rastrear quién subió cada archivo.
   */
  @ApiPropertyOptional({ description: 'ID of the user uploading the file' })
  @IsOptional()
  @IsUUID()
  uploadedBy?: string;

  /**
   * Descripción del archivo (opcional).
   * Texto libre para describir el contenido.
   */
  @ApiPropertyOptional({ description: 'Description of the file' })
  @IsOptional()
  @IsString()
  description?: string;

  /**
   * Metadatos adicionales como objeto JSON (opcional).
   * Permite almacenar información personalizada.
   */
  @ApiPropertyOptional({ description: 'Additional metadata as JSON' })
  @IsOptional()
  metadata?: Record<string, any>;
}
