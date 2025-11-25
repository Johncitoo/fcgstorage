-- Migration: Create files_metadata table
-- Date: 2025-11-25
-- Description: Tabla para almacenar metadata de archivos del storage service

-- Crear tipos ENUM
CREATE TYPE file_category AS ENUM ('PROFILE', 'DOCUMENT', 'FORM_FIELD', 'ATTACHMENT', 'OTHER');
CREATE TYPE entity_type AS ENUM ('USER', 'APPLICATION', 'FORM_ANSWER', 'INSTITUTION', 'OTHER');

-- Crear tabla files_metadata
CREATE TABLE IF NOT EXISTS files_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "originalFilename" VARCHAR(500) NOT NULL,
  "storedFilename" VARCHAR(500) NOT NULL UNIQUE,
  mimetype VARCHAR(100) NOT NULL,
  size BIGINT NOT NULL,
  category file_category DEFAULT 'OTHER',
  "entityType" entity_type,
  "entityId" UUID,
  path VARCHAR(500) NOT NULL,
  "thumbnailPath" VARCHAR(500),
  "uploadedBy" UUID,
  description TEXT,
  metadata JSONB,
  "uploadedAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW(),
  active BOOLEAN DEFAULT TRUE
);

-- Crear índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_files_entity ON files_metadata("entityType", "entityId");
CREATE INDEX IF NOT EXISTS idx_files_uploader ON files_metadata("uploadedBy");
CREATE INDEX IF NOT EXISTS idx_files_category ON files_metadata(category);
CREATE INDEX IF NOT EXISTS idx_files_active ON files_metadata(active);

-- Foreign key opcional hacia users (si existe la tabla)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
    ALTER TABLE files_metadata 
    ADD CONSTRAINT fk_files_uploader 
    FOREIGN KEY ("uploadedBy") REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Comentarios para documentación
COMMENT ON TABLE files_metadata IS 'Metadata de archivos almacenados en el storage service';
COMMENT ON COLUMN files_metadata.category IS 'Categoría del archivo (PROFILE, DOCUMENT, etc)';
COMMENT ON COLUMN files_metadata."entityType" IS 'Tipo de entidad relacionada (USER, APPLICATION, etc)';
COMMENT ON COLUMN files_metadata."entityId" IS 'ID de la entidad relacionada';
COMMENT ON COLUMN files_metadata.metadata IS 'Metadata adicional en formato JSON';
