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

@ApiTags('Storage')
@ApiSecurity('api-key')
@Controller('storage')
@UseGuards(ApiKeyGuard)
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

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

  @Get('download/:id')
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

  @Get('view/:id')
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

  @Get('list')
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
