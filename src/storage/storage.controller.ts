import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  Body,
  UseGuards,
  Res,
  HttpStatus,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiSecurity, ApiQuery } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { StorageService } from './storage.service';
import { UploadFileDto } from './dto/upload-file.dto';
import { ApiKeyGuard } from './guards/api-key.guard';
import { FileCategory, EntityType } from './entities/file-metadata.entity';

/**
 * Controlador de almacenamiento de archivos.
 * Provee endpoints para subir, descargar, listar y eliminar archivos.
 * Todos los endpoints requieren autenticación via API Key.
 * @class StorageController
 */
@ApiTags('Storage')
@ApiSecurity('api-key')
@Controller('storage')
@UseGuards(ApiKeyGuard)
@Throttle({ default: { limit: 100, ttl: 60000 } }) // Rate limit global: 100 req/min
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  /**
   * Sube un archivo al sistema de almacenamiento.
   * Genera automáticamente una miniatura para imágenes.
   * @param file - Archivo binario a subir (multipart/form-data)
   * @param dto - Metadatos del archivo (categoría, entidad asociada, etc.)
   * @returns Objeto con información del archivo subido incluyendo URLs de descarga
   * @throws BadRequestException si no se proporciona archivo o el tipo no es permitido
   */
  @Post('upload')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a file' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'File uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadFileDto,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const metadata = await this.storageService.uploadFile(file, dto);
    return {
      success: true,
      file: {
        id: metadata.id,
        originalFilename: metadata.originalFilename,
        storedFilename: metadata.storedFilename,
        mimetype: metadata.mimetype,
        size: metadata.size,
        category: metadata.category,
        uploadedAt: metadata.uploadedAt,
        downloadUrl: `/storage/download/${metadata.id}`,
        thumbnailUrl: metadata.thumbnailPath ? `/storage/thumbnail/${metadata.id}` : null,
      },
    };
  }

  /**
   * Descarga un archivo por su ID.
   * Retorna el archivo con headers de Content-Disposition attachment.
   * @param id - UUID del archivo a descargar
   * @param res - Objeto Response de Express
   * @throws NotFoundException si el archivo no existe
   */
  @Get('download/:id')
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 descargas/min
  @ApiOperation({ summary: 'Download a file by ID' })
  @ApiResponse({ status: 200, description: 'File downloaded successfully' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async downloadFile(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const { metadata, buffer } = await this.storageService.getFile(id);

    res.setHeader('Content-Type', metadata.mimetype);
    res.setHeader('Content-Disposition', `attachment; filename="${metadata.originalFilename}"`);
    res.setHeader('Content-Length', metadata.size.toString());
    res.status(HttpStatus.OK).send(buffer);
  }

  /**
   * Visualiza un archivo inline (para imágenes, PDFs).
   * Retorna el archivo con Content-Disposition inline para visualización en navegador.
   * @param id - UUID del archivo a visualizar
   * @param res - Objeto Response de Express
   * @throws NotFoundException si el archivo no existe
   */
  @Get('view/:id')
  @Throttle({ default: { limit: 50, ttl: 60000 } }) // 50 views/min
  @ApiOperation({ summary: 'View a file inline (for images, PDFs)' })
  @ApiResponse({ status: 200, description: 'File retrieved successfully' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async viewFile(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const { metadata, buffer } = await this.storageService.getFile(id);

    res.setHeader('Content-Type', metadata.mimetype);
    res.setHeader('Content-Disposition', `inline; filename="${metadata.originalFilename}"`);
    res.setHeader('Content-Length', metadata.size.toString());
    res.status(HttpStatus.OK).send(buffer);
  }

  /**
   * Obtiene la miniatura de una imagen.
   * Solo disponible para archivos de tipo imagen que tienen thumbnail generado.
   * @param id - UUID del archivo original
   * @param res - Objeto Response de Express
   * @throws NotFoundException si no existe miniatura para el archivo
   */
  @Get('thumbnail/:id')
  @ApiOperation({ summary: 'Get thumbnail of an image' })
  @ApiResponse({ status: 200, description: 'Thumbnail retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Thumbnail not found' })
  async getThumbnail(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const { metadata, buffer } = await this.storageService.getThumbnail(id);

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Disposition', `inline; filename="thumb_${metadata.originalFilename}"`);
    res.status(HttpStatus.OK).send(buffer);
  }

  /**
   * Obtiene los metadatos de un archivo.
   * Retorna información como nombre original, tamaño, tipo MIME, categoría, etc.
   * @param id - UUID del archivo
   * @returns Objeto con los metadatos completos del archivo
   * @throws NotFoundException si el archivo no existe
   */
  @Get('metadata/:id')
  @ApiOperation({ summary: 'Get file metadata' })
  @ApiResponse({ status: 200, description: 'Metadata retrieved successfully' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async getMetadata(@Param('id', ParseUUIDPipe) id: string) {
    const metadata = await this.storageService.getFileMetadata(id);
    return {
      success: true,
      file: metadata,
    };
  }

  /**
   * Lista archivos con filtros opcionales.
   * Permite filtrar por categoría, tipo de entidad, entidad específica y usuario.
   * Soporta paginación mediante limit y offset.
   * @param category - Filtrar por categoría de archivo (PROFILE, DOCUMENT, etc.)
   * @param entityType - Filtrar por tipo de entidad asociada
   * @param entityId - Filtrar por ID de entidad específica
   * @param uploadedBy - Filtrar por ID de usuario que subió el archivo
   * @param limit - Número máximo de resultados (default: 50)
   * @param offset - Número de registros a saltar (default: 0)
   * @returns Lista paginada de archivos con total
   */
  @Get('list')
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 20 listados/min
  @ApiOperation({ summary: 'List files with filters' })
  @ApiQuery({ name: 'category', enum: FileCategory, required: false })
  @ApiQuery({ name: 'entityType', enum: EntityType, required: false })
  @ApiQuery({ name: 'entityId', required: false })
  @ApiQuery({ name: 'uploadedBy', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Files listed successfully' })
  async listFiles(
    @Query('category') category?: FileCategory,
    @Query('entityType') entityType?: EntityType,
    @Query('entityId') entityId?: string,
    @Query('uploadedBy') uploadedBy?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const result = await this.storageService.listFiles(
      category,
      entityType,
      entityId,
      uploadedBy,
      limit ? parseInt(limit, 10) : 50,
      offset ? parseInt(offset, 10) : 0,
    );

    return {
      success: true,
      data: result.data,
      total: result.total,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    };
  }

  /**
   * Elimina un archivo (soft delete).
   * El archivo se marca como inactivo pero no se elimina físicamente del disco.
   * @param id - UUID del archivo a eliminar
   * @returns Mensaje de confirmación de eliminación
   * @throws NotFoundException si el archivo no existe
   */
  @Delete(':id')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Delete a file (soft delete)' })
  @ApiResponse({ status: 200, description: 'File deleted successfully' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async deleteFile(@Param('id', ParseUUIDPipe) id: string) {
    await this.storageService.deleteFile(id);
    return {
      success: true,
      message: 'File deleted successfully',
    };
  }

  /**
   * Limpia archivos huérfanos del sistema.
   * Marca como inactivos los registros en BD que no tienen archivo físico asociado.
   * Solo debe ser ejecutado por administradores. Rate limit: 1 req cada 5 min.
   * @returns Número de archivos huérfanos removidos
   */
  @Post('cleanup')
  @Throttle({ default: { limit: 1, ttl: 300000 } })
  @ApiOperation({ summary: 'Cleanup orphaned files (admin only)' })
  @ApiResponse({ status: 200, description: 'Cleanup completed' })
  async cleanupOrphanedFiles() {
    const result = await this.storageService.cleanupOrphanedFiles();
    return {
      success: true,
      removed: result.removed,
    };
  }
}
