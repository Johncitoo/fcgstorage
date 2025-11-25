import { Injectable, BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { FileMetadata, FileCategory, EntityType } from './entities/file-metadata.entity';
import { UploadFileDto } from './dto/upload-file.dto';

@Injectable()
export class StorageService {
  private readonly uploadPath: string;
  private readonly maxFileSize: number;
  private readonly allowedMimeTypes: string[];
  private readonly thumbnailWidth: number;
  private readonly thumbnailHeight: number;
  private readonly thumbnailQuality: number;

  constructor(
    @InjectRepository(FileMetadata)
    private fileMetadataRepository: Repository<FileMetadata>,
    private configService: ConfigService,
  ) {
    this.uploadPath = this.configService.get<string>('UPLOAD_PATH') || './uploads';
    this.maxFileSize = parseInt(this.configService.get<string>('MAX_FILE_SIZE') || '10485760', 10);
    this.allowedMimeTypes = this.configService.get<string>('ALLOWED_MIME_TYPES')?.split(',') || [];
    this.thumbnailWidth = parseInt(this.configService.get<string>('THUMBNAIL_WIDTH') || '300', 10);
    this.thumbnailHeight = parseInt(this.configService.get<string>('THUMBNAIL_HEIGHT') || '300', 10);
    this.thumbnailQuality = parseInt(this.configService.get<string>('THUMBNAIL_QUALITY') || '80', 10);
    
    this.ensureUploadDirectories();
  }

  private async ensureUploadDirectories() {
    const directories = [
      this.uploadPath,
      path.join(this.uploadPath, 'profiles'),
      path.join(this.uploadPath, 'documents'),
      path.join(this.uploadPath, 'forms'),
      path.join(this.uploadPath, 'thumbnails'),
      path.join(this.uploadPath, 'temp'),
    ];

    for (const dir of directories) {
      try {
        await fs.access(dir);
      } catch {
        await fs.mkdir(dir, { recursive: true });
      }
    }
  }

  async uploadFile(
    file: Express.Multer.File,
    dto: UploadFileDto,
  ): Promise<FileMetadata> {
    // Validate file size
    if (file.size > this.maxFileSize) {
      throw new BadRequestException(`File size exceeds maximum allowed size of ${this.maxFileSize} bytes`);
    }

    // Validate MIME type
    if (this.allowedMimeTypes.length > 0 && !this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(`File type ${file.mimetype} is not allowed`);
    }

    // Generate unique filename
    const ext = path.extname(file.originalname);
    const storedFilename = `${uuidv4()}${ext}`;
    
    // Determine subdirectory based on category
    const subdir = this.getSubdirectoryByCategory(dto.category);
    const relativePath = path.join(subdir, storedFilename);
    const fullPath = path.join(this.uploadPath, relativePath);

    try {
      // Save file to disk
      await fs.writeFile(fullPath, file.buffer);

      // Generate thumbnail for images
      let thumbnailPath: string | undefined = undefined;
      if (file.mimetype.startsWith('image/')) {
        const thumb = await this.generateThumbnail(file.buffer, storedFilename);
        thumbnailPath = thumb || undefined;
      }

      // Save metadata to database
      const fileMetadata = this.fileMetadataRepository.create({
        originalFilename: file.originalname,
        storedFilename,
        mimetype: file.mimetype,
        size: file.size,
        category: dto.category,
        entityType: dto.entityType,
        entityId: dto.entityId,
        path: relativePath,
        thumbnailPath: thumbnailPath || undefined,
        uploadedBy: dto.uploadedBy,
        description: dto.description,
        metadata: dto.metadata,
      });

      const saved = await this.fileMetadataRepository.save(fileMetadata);
      return saved;
    } catch (error) {
      // Cleanup file if database save fails
      try {
        await fs.unlink(fullPath);
      } catch {}
      
      throw new InternalServerErrorException('Failed to upload file');
    }
  }

  async getFile(id: string): Promise<{ metadata: FileMetadata; buffer: Buffer }> {
    const metadata = await this.fileMetadataRepository.findOne({
      where: { id, active: true },
    });

    if (!metadata) {
      throw new NotFoundException('File not found');
    }

    const fullPath = path.join(this.uploadPath, metadata.path);
    
    try {
      const buffer = await fs.readFile(fullPath);
      return { metadata, buffer };
    } catch {
      throw new NotFoundException('File not found on disk');
    }
  }

  async getThumbnail(id: string): Promise<{ metadata: FileMetadata; buffer: Buffer }> {
    const metadata = await this.fileMetadataRepository.findOne({
      where: { id, active: true },
    });

    if (!metadata || !metadata.thumbnailPath) {
      throw new NotFoundException('Thumbnail not found');
    }

    const fullPath = path.join(this.uploadPath, metadata.thumbnailPath);
    
    try {
      const buffer = await fs.readFile(fullPath);
      return { metadata, buffer };
    } catch {
      throw new NotFoundException('Thumbnail not found on disk');
    }
  }

  async deleteFile(id: string): Promise<void> {
    const metadata = await this.fileMetadataRepository.findOne({
      where: { id, active: true },
    });

    if (!metadata) {
      throw new NotFoundException('File not found');
    }

    // Soft delete in database
    metadata.active = false;
    await this.fileMetadataRepository.save(metadata);

    // Optionally delete physical file (commented out for safety)
    // const fullPath = path.join(this.uploadPath, metadata.path);
    // try {
    //   await fs.unlink(fullPath);
    //   if (metadata.thumbnailPath) {
    //     await fs.unlink(path.join(this.uploadPath, metadata.thumbnailPath));
    //   }
    // } catch {}
  }

  async listFiles(
    category?: FileCategory,
    entityType?: EntityType,
    entityId?: string,
    uploadedBy?: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<{ data: FileMetadata[]; total: number }> {
    const query = this.fileMetadataRepository.createQueryBuilder('file')
      .where('file.active = :active', { active: true });

    if (category) {
      query.andWhere('file.category = :category', { category });
    }

    if (entityType) {
      query.andWhere('file.entityType = :entityType', { entityType });
    }

    if (entityId) {
      query.andWhere('file.entityId = :entityId', { entityId });
    }

    if (uploadedBy) {
      query.andWhere('file.uploadedBy = :uploadedBy', { uploadedBy });
    }

    const [data, total] = await query
      .orderBy('file.uploadedAt', 'DESC')
      .take(limit)
      .skip(offset)
      .getManyAndCount();

    return { data, total };
  }

  async getFileMetadata(id: string): Promise<FileMetadata> {
    const metadata = await this.fileMetadataRepository.findOne({
      where: { id, active: true },
    });

    if (!metadata) {
      throw new NotFoundException('File not found');
    }

    return metadata;
  }

  private getSubdirectoryByCategory(category: FileCategory): string {
    switch (category) {
      case FileCategory.PROFILE:
        return 'profiles';
      case FileCategory.DOCUMENT:
        return 'documents';
      case FileCategory.FORM_FIELD:
        return 'forms';
      default:
        return 'temp';
    }
  }

  private async generateThumbnail(buffer: Buffer, filename: string): Promise<string | null> {
    try {
      const thumbnailFilename = `thumb_${filename}`;
      const relativePath = path.join('thumbnails', thumbnailFilename);
      const fullPath = path.join(this.uploadPath, relativePath);

      await sharp(buffer)
        .resize(this.thumbnailWidth, this.thumbnailHeight, {
          fit: 'cover',
          position: 'center',
        })
        .jpeg({ quality: this.thumbnailQuality })
        .toFile(fullPath);

      return relativePath;
    } catch (error) {
      console.error('Failed to generate thumbnail:', error);
      return null;
    }
  }

  // Cleanup orphaned files (files in DB but not on disk, or vice versa)
  async cleanupOrphanedFiles(): Promise<{ removed: number }> {
    const allMetadata = await this.fileMetadataRepository.find();
    let removed = 0;

    for (const metadata of allMetadata) {
      const fullPath = path.join(this.uploadPath, metadata.path);
      try {
        await fs.access(fullPath);
      } catch {
        // File not found on disk, mark as inactive
        metadata.active = false;
        await this.fileMetadataRepository.save(metadata);
        removed++;
      }
    }

    return { removed };
  }
}
