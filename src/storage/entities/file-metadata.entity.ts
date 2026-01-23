import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, Index, BeforeInsert } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

/**
 * Categorías de archivos para organización interna.
 * Determina el subdirectorio de almacenamiento.
 * @enum {string}
 */
export enum FileCategory {
  /** Fotos de perfil de usuarios */
  PROFILE = 'PROFILE',
  /** Documentos oficiales (certificados, etc.) */
  DOCUMENT = 'DOCUMENT',
  /** Archivos subidos desde formularios */
  FORM_FIELD = 'FORM_FIELD',
  /** Adjuntos generales */
  ATTACHMENT = 'ATTACHMENT',
  /** Otros archivos sin categoría específica */
  OTHER = 'OTHER',
}

/**
 * Tipos de entidad a los que puede asociarse un archivo.
 * @enum {string}
 */
export enum EntityType {
  /** Archivo pertenece a un usuario */
  USER = 'USER',
  /** Archivo pertenece a una postulación */
  APPLICATION = 'APPLICATION',
  /** Archivo es respuesta de un campo de formulario */
  FORM_ANSWER = 'FORM_ANSWER',
  /** Archivo pertenece a una institución */
  INSTITUTION = 'INSTITUTION',
  /** Otro tipo de entidad */
  OTHER = 'OTHER',
}

/**
 * Entidad de metadatos de archivo.
 * Almacena información sobre archivos subidos al sistema de storage.
 * Los archivos físicos se guardan en disco, esta entidad guarda la referencia.
 * @class FileMetadata
 */
@Entity('files_metadata')
@Index(['entityType', 'entityId'])
@Index(['uploadedBy'])
@Index(['category'])
export class FileMetadata {
  /** Identificador único UUID del archivo */
  @PrimaryColumn('uuid')
  id: string;

  /**
   * Genera automáticamente el UUID antes de insertar si no existe.
   */
  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = uuidv4();
    }
  }

  /** Nombre original del archivo subido por el usuario */
  @Column({ type: 'varchar', length: 500, name: 'original_filename' })
  originalFilename: string;

  /** Nombre único generado para almacenamiento interno */
  @Column({ type: 'varchar', length: 500, unique: true, name: 'stored_filename' })
  storedFilename: string;

  /** Tipo MIME del archivo (image/jpeg, application/pdf, etc.) */
  @Column({ type: 'varchar', length: 100 })
  mimetype: string;

  /** Tamaño del archivo en bytes */
  @Column({ type: 'bigint' })
  size: number;

  /** Categoría del archivo para organización */
  @Column({
    type: 'enum',
    enum: FileCategory,
    default: FileCategory.OTHER,
  })
  category: FileCategory;

  /** Tipo de entidad asociada (opcional) */
  @Column({
    type: 'enum',
    enum: EntityType,
    nullable: true,
    name: 'entity_type',
  })
  entityType: EntityType;

  /** ID de la entidad asociada (opcional) */
  @Column({ type: 'uuid', nullable: true, name: 'entity_id' })
  entityId: string;

  /** Ruta relativa del archivo en el sistema de almacenamiento */
  @Column({ type: 'varchar', length: 500 })
  path: string;

  /** Ruta relativa de la miniatura (solo para imágenes) */
  @Column({ type: 'varchar', length: 500, nullable: true, name: 'thumbnail_path' })
  thumbnailPath: string;

  /** ID del usuario que subió el archivo */
  @Column({ type: 'uuid', nullable: true, name: 'uploaded_by' })
  uploadedBy: string;

  /** Descripción opcional del archivo */
  @Column({ type: 'text', nullable: true })
  description: string;

  /** Metadatos adicionales en formato JSON */
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  /** Fecha y hora de subida */
  @CreateDateColumn({ name: 'uploaded_at' })
  uploadedAt: Date;

  /** Fecha y hora de última actualización */
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  /** Indica si el archivo está activo (false = soft deleted) */
  @Column({ type: 'boolean', default: true })
  active: boolean;
}
