import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum FileCategory {
  PROFILE = 'PROFILE',
  DOCUMENT = 'DOCUMENT',
  FORM_FIELD = 'FORM_FIELD',
  ATTACHMENT = 'ATTACHMENT',
  OTHER = 'OTHER',
}

export enum EntityType {
  USER = 'USER',
  APPLICATION = 'APPLICATION',
  FORM_ANSWER = 'FORM_ANSWER',
  INSTITUTION = 'INSTITUTION',
  OTHER = 'OTHER',
}

@Entity('files_metadata')
@Index(['entityType', 'entityId'])
@Index(['uploadedBy'])
@Index(['category'])
export class FileMetadata {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 500 })
  originalFilename: string;

  @Column({ type: 'varchar', length: 500, unique: true })
  storedFilename: string;

  @Column({ type: 'varchar', length: 100 })
  mimetype: string;

  @Column({ type: 'bigint' })
  size: number;

  @Column({
    type: 'enum',
    enum: FileCategory,
    default: FileCategory.OTHER,
  })
  category: FileCategory;

  @Column({
    type: 'enum',
    enum: EntityType,
    nullable: true,
  })
  entityType: EntityType;

  @Column({ type: 'uuid', nullable: true })
  entityId: string;

  @Column({ type: 'varchar', length: 500 })
  path: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  thumbnailPath: string;

  @Column({ type: 'uuid', nullable: true })
  uploadedBy: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  uploadedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'boolean', default: true })
  active: boolean;
}
