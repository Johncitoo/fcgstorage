import { Injectable, BadRequestException, NotFoundException, InternalServerErrorException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { FileMetadata, FileCategory, EntityType } from './entities/file-metadata.entity';
import { UploadFileDto } from './dto/upload-file.dto';

// MIME types seguros por defecto
const DEFAULT_ALLOWED_MIME_TYPES = [
  // Imágenes
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  // Documentos
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // Texto
  'text/plain',
  'text/csv',
  // Comprimidos (opcional, comentar si no se necesitan)
  // 'application/zip',
  // 'application/x-rar-compressed',
];

/**
 * Servicio de almacenamiento de archivos.
 * Gestiona la subida, descarga, listado y eliminación de archivos.
 * Genera miniaturas automáticas para imágenes usando Sharp.
 * @class StorageService
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  /** Ruta base para almacenamiento de archivos */
  private readonly uploadPath: string;
  /** Tamaño máximo de archivo permitido en bytes */
  private readonly maxFileSize: number;
  /** Lista de tipos MIME permitidos */
  private readonly allowedMimeTypes: string[];
  /** Ancho de miniaturas en píxeles */
  private readonly thumbnailWidth: number;
  /** Alto de miniaturas en píxeles */
  private readonly thumbnailHeight: number;
  /** Calidad de compresión JPEG para miniaturas (0-100) */
  private readonly thumbnailQuality: number;

  constructor(
    @InjectRepository(FileMetadata)
    private fileMetadataRepository: Repository<FileMetadata>,
    private configService: ConfigService,
  ) {
    this.uploadPath = this.configService.get<string>('UPLOAD_PATH') || './uploads';
    this.maxFileSize = parseInt(this.configService.get<string>('MAX_FILE_SIZE') || '10485760', 10);
    
    // Usar MIME types de config o los defaults seguros
    const configMimeTypes = this.configService.get<string>('ALLOWED_MIME_TYPES');
    this.allowedMimeTypes = configMimeTypes 
      ? configMimeTypes.split(',').map(t => t.trim())
      : DEFAULT_ALLOWED_MIME_TYPES;
    
    this.thumbnailWidth = parseInt(this.configService.get<string>('THUMBNAIL_WIDTH') || '300', 10);
    this.thumbnailHeight = parseInt(this.configService.get<string>('THUMBNAIL_HEIGHT') || '300', 10);
    this.thumbnailQuality = parseInt(this.configService.get<string>('THUMBNAIL_QUALITY') || '80', 10);
    
    this.logger.log(`📁 Upload path: ${this.uploadPath}`);
    this.logger.log(`📄 Max file size: ${this.maxFileSize} bytes`);
    this.logger.log(`✅ Allowed MIME types: ${this.allowedMimeTypes.length} types`);
    
    this.ensureUploadDirectories();
  }

  /**
   * Asegura que existan los directorios necesarios para almacenamiento.
   * Crea subdirectorios para profiles, documents, forms, thumbnails y temp.
   * @private
   */
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

  /**
   * Sube un archivo al sistema de almacenamiento.
   * Valida tamaño y tipo MIME, genera nombre único, guarda archivo y crea thumbnail si es imagen.
   * @param file - Archivo de Express/Multer con buffer y metadata
   * @param dto - DTO con metadatos adicionales (categoría, entidad, etc.)
   * @returns Entidad FileMetadata con toda la información del archivo guardado
   * @throws BadRequestException si el archivo excede el tamaño o tipo no permitido
   * @throws InternalServerErrorException si falla el guardado
   */
  async uploadFile(
    file: Express.Multer.File,
    dto: UploadFileDto,
  ): Promise<FileMetadata> {
    this.logger.log(`📤 Upload request: ${file.originalname} (${file.size} bytes, ${file.mimetype})`);
    this.logger.log(`📦 Category: ${dto.category}, Entity: ${dto.entityType}/${dto.entityId}`);
    
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
      // Log the actual error for debugging
      this.logger.error(`❌ Upload failed: ${error.message}`);
      this.logger.error(`Stack trace: ${error.stack}`);
      
      // Cleanup file if database save fails
      try {
        await fs.unlink(fullPath);
      } catch {}
      
      throw new InternalServerErrorException(`Failed to upload file: ${error.message}`);
    }
  }

  /**
   * Obtiene un archivo por su ID.
   * Retorna tanto los metadatos como el contenido binario del archivo.
   * @param id - UUID del archivo
   * @returns Objeto con metadata y buffer del archivo
   * @throws NotFoundException si el archivo no existe en BD o disco
   */
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

  /**
   * Obtiene la miniatura de un archivo de imagen.
   * @param id - UUID del archivo original
   * @returns Objeto con metadata y buffer de la miniatura
   * @throws NotFoundException si no existe miniatura para el archivo
   */
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

  /**
   * Elimina un archivo (soft delete).
   * Marca el registro como inactivo sin eliminar el archivo físico.
   * @param id - UUID del archivo a eliminar
   * @throws NotFoundException si el archivo no existe
   */
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

  /**
   * Lista archivos con filtros opcionales y paginación.
   * @param category - Filtrar por categoría (PROFILE, DOCUMENT, etc.)
   * @param entityType - Filtrar por tipo de entidad (USER, APPLICATION, etc.)
   * @param entityId - Filtrar por ID de entidad específica
   * @param uploadedBy - Filtrar por usuario que subió el archivo
   * @param limit - Máximo de resultados (default: 50)
   * @param offset - Registros a saltar para paginación (default: 0)
   * @returns Objeto con array de archivos y total
   */
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

  /**
   * Obtiene solo los metadatos de un archivo sin el contenido.
   * @param id - UUID del archivo
   * @returns Entidad FileMetadata completa
   * @throws NotFoundException si el archivo no existe
   */
  async getFileMetadata(id: string): Promise<FileMetadata> {
    const metadata = await this.fileMetadataRepository.findOne({
      where: { id, active: true },
    });

    if (!metadata) {
      throw new NotFoundException('File not found');
    }

    return metadata;
  }

  /**
   * Determina el subdirectorio de almacenamiento según la categoría.
   * @param category - Categoría del archivo
   * @returns Nombre del subdirectorio (profiles, documents, forms o temp)
   * @private
   */
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

  /**
   * Genera una miniatura para una imagen.
   * Usa Sharp para redimensionar y comprimir a JPEG.
   * @param buffer - Buffer de la imagen original
   * @param filename - Nombre del archivo para generar nombre de thumbnail
   * @returns Ruta relativa del thumbnail o null si falla
   * @private
   */
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

  /**
   * Limpia archivos huérfanos del sistema.
   * Busca registros en BD sin archivo físico y los marca como inactivos.
   * @returns Objeto con cantidad de archivos removidos
   */
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
