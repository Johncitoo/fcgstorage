# Integración FCG Storage Service con Backend Principal

## Configuración en Backend Principal

### 1. Variables de Entorno

Agregar en `.env` del backend principal:

```env
# Storage Service
STORAGE_SERVICE_URL=http://localhost:3001
STORAGE_SERVICE_API_KEY=dev-key-123

# O en producción:
# STORAGE_SERVICE_URL=https://fcg-storage-production.up.railway.app
# STORAGE_SERVICE_API_KEY=tu-api-key-de-produccion
```

### 2. Crear Servicio de Storage en NestJS

```typescript
// src/storage-client/storage-client.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import FormData from 'form-data';
import fetch from 'node-fetch';

export interface UploadOptions {
  category: 'PROFILE' | 'DOCUMENT' | 'FORM_FIELD' | 'ATTACHMENT' | 'OTHER';
  entityType?: 'USER' | 'APPLICATION' | 'FORM_ANSWER' | 'INSTITUTION' | 'OTHER';
  entityId?: string;
  uploadedBy?: string;
  description?: string;
}

@Injectable()
export class StorageClientService {
  private readonly storageUrl: string;
  private readonly apiKey: string;

  constructor(private configService: ConfigService) {
    this.storageUrl = this.configService.get<string>('STORAGE_SERVICE_URL');
    this.apiKey = this.configService.get<string>('STORAGE_SERVICE_API_KEY');
  }

  async uploadFile(
    buffer: Buffer,
    filename: string,
    mimetype: string,
    options: UploadOptions,
  ): Promise<any> {
    const formData = new FormData();
    formData.append('file', buffer, { filename, contentType: mimetype });
    formData.append('category', options.category);
    
    if (options.entityType) formData.append('entityType', options.entityType);
    if (options.entityId) formData.append('entityId', options.entityId);
    if (options.uploadedBy) formData.append('uploadedBy', options.uploadedBy);
    if (options.description) formData.append('description', options.description);

    const response = await fetch(`${this.storageUrl}/storage/upload`, {
      method: 'POST',
      headers: {
        'X-API-Key': this.apiKey,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Storage service error: ${response.statusText}`);
    }

    return response.json();
  }

  async getFileUrl(fileId: string, view: boolean = false): Promise<string> {
    const endpoint = view ? 'view' : 'download';
    return `${this.storageUrl}/storage/${endpoint}/${fileId}`;
  }

  async getThumbnailUrl(fileId: string): Promise<string> {
    return `${this.storageUrl}/storage/thumbnail/${fileId}`;
  }

  async deleteFile(fileId: string): Promise<void> {
    const response = await fetch(`${this.storageUrl}/storage/${fileId}`, {
      method: 'DELETE',
      headers: {
        'X-API-Key': this.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to delete file: ${response.statusText}`);
    }
  }

  async listFiles(filters: {
    category?: string;
    entityType?: string;
    entityId?: string;
    uploadedBy?: string;
    limit?: number;
    offset?: number;
  }): Promise<any> {
    const params = new URLSearchParams();
    if (filters.category) params.append('category', filters.category);
    if (filters.entityType) params.append('entityType', filters.entityType);
    if (filters.entityId) params.append('entityId', filters.entityId);
    if (filters.uploadedBy) params.append('uploadedBy', filters.uploadedBy);
    if (filters.limit) params.append('limit', filters.limit.toString());
    if (filters.offset) params.append('offset', filters.offset.toString());

    const response = await fetch(`${this.storageUrl}/storage/list?${params}`, {
      headers: {
        'X-API-Key': this.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to list files: ${response.statusText}`);
    }

    return response.json();
  }

  async getMetadata(fileId: string): Promise<any> {
    const response = await fetch(`${this.storageUrl}/storage/metadata/${fileId}`, {
      headers: {
        'X-API-Key': this.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get metadata: ${response.statusText}`);
    }

    return response.json();
  }
}
```

### 3. Crear Módulo

```typescript
// src/storage-client/storage-client.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StorageClientService } from './storage-client.service';

@Module({
  imports: [ConfigModule],
  providers: [StorageClientService],
  exports: [StorageClientService],
})
export class StorageClientModule {}
```

### 4. Registrar en AppModule

```typescript
// src/app.module.ts
import { StorageClientModule } from './storage-client/storage-client.module';

@Module({
  imports: [
    // ... otros imports
    StorageClientModule,
  ],
})
export class AppModule {}
```

### 5. Usar en Controladores

```typescript
// Ejemplo: Upload foto de perfil
@Post('profile-photo')
@UseInterceptors(FileInterceptor('photo'))
async uploadProfilePhoto(
  @UploadedFile() file: Express.Multer.File,
  @Request() req,
) {
  const result = await this.storageClient.uploadFile(
    file.buffer,
    file.originalname,
    file.mimetype,
    {
      category: 'PROFILE',
      entityType: 'USER',
      entityId: req.user.id,
      uploadedBy: req.user.id,
      description: 'Profile photo',
    },
  );

  // Guardar fileId en la base de datos del usuario
  await this.usersService.updateProfilePhoto(req.user.id, result.file.id);

  return result;
}

// Ejemplo: Upload documento de postulación
@Post('applications/:id/document')
@UseInterceptors(FileInterceptor('document'))
async uploadApplicationDocument(
  @Param('id') applicationId: string,
  @UploadedFile() file: Express.Multer.File,
  @Request() req,
) {
  const result = await this.storageClient.uploadFile(
    file.buffer,
    file.originalname,
    file.mimetype,
    {
      category: 'DOCUMENT',
      entityType: 'APPLICATION',
      entityId: applicationId,
      uploadedBy: req.user.id,
      description: 'Application document',
    },
  );

  // Guardar relación en BD
  await this.applicationsService.addDocument(applicationId, result.file.id);

  return result;
}

// Ejemplo: Listar archivos de una postulación
@Get('applications/:id/files')
async getApplicationFiles(@Param('id') applicationId: string) {
  const files = await this.storageClient.listFiles({
    entityType: 'APPLICATION',
    entityId: applicationId,
  });

  return files;
}
```

## Frontend Integration

### React/TypeScript Example

```typescript
// src/services/storage.service.ts
const STORAGE_API_URL = import.meta.env.VITE_STORAGE_API_URL || 'http://localhost:3001';
const STORAGE_API_KEY = import.meta.env.VITE_STORAGE_API_KEY || 'dev-key-123';

export async function uploadFile(
  file: File,
  category: string,
  entityId?: string,
  entityType?: string,
): Promise<any> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('category', category);
  if (entityId) formData.append('entityId', entityId);
  if (entityType) formData.append('entityType', entityType);

  const response = await fetch(`${STORAGE_API_URL}/storage/upload`, {
    method: 'POST',
    headers: {
      'X-API-Key': STORAGE_API_KEY,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Upload failed');
  }

  return response.json();
}

export function getFileUrl(fileId: string, view: boolean = true): string {
  const endpoint = view ? 'view' : 'download';
  return `${STORAGE_API_URL}/storage/${endpoint}/${fileId}`;
}

export function getThumbnailUrl(fileId: string): string {
  return `${STORAGE_API_URL}/storage/thumbnail/${fileId}`;
}

// Component example
export function ProfilePhotoUploader() {
  const [uploading, setUploading] = useState(false);
  const [photoId, setPhotoId] = useState<string | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const result = await uploadFile(file, 'PROFILE', userId, 'USER');
      setPhotoId(result.file.id);
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <input type="file" onChange={handleUpload} accept="image/*" />
      {uploading && <p>Uploading...</p>}
      {photoId && (
        <img 
          src={getThumbnailUrl(photoId)} 
          alt="Profile" 
          className="w-32 h-32 rounded-full"
        />
      )}
    </div>
  );
}
```

## Deployment Checklist

### Railway Setup (Storage Service)

1. ✅ Crear nuevo proyecto "fcg-storage"
2. ✅ Conectar con GitHub repo
3. ✅ Agregar PostgreSQL plugin
4. ✅ Configurar variables:
   - `API_KEY_MAIN` (generar segura)
   - `API_KEY_SECONDARY`
   - `CORS_ORIGINS` (dominios del frontend y backend)
   - `MAX_FILE_SIZE=52428800` (50MB)
   - `ALLOWED_MIME_TYPES`
5. ✅ Deploy automático

### Backend Principal

1. ✅ Agregar `STORAGE_SERVICE_URL` y `STORAGE_SERVICE_API_KEY` en Railway
2. ✅ Implementar `StorageClientModule`
3. ✅ Actualizar endpoints que manejan archivos
4. ✅ Redeploy

### Frontend

1. ✅ Agregar `VITE_STORAGE_API_URL` en Vercel
2. ✅ Implementar servicio de storage
3. ✅ Actualizar componentes de upload
4. ✅ Redeploy

## Testing

```bash
# Test upload desde backend
curl -X POST http://localhost:3000/api/test-upload \
  -F "file=@test.jpg"

# Verificar archivo en storage service
curl -H "X-API-Key: dev-key-123" \
  http://localhost:3001/storage/list
```

## Backup Strategy

```bash
# Backup uploads folder
tar -czf uploads-backup-$(date +%Y%m%d).tar.gz uploads/

# Backup database
pg_dump fcg_storage > storage-backup-$(date +%Y%m%d).sql
```
