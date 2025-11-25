# Quick Start Guide - FCG Storage Service

## 1. Configuración Inicial

```bash
# Copiar variables de entorno
cp .env.example .env

# Editar .env con tus valores
# - DATABASE_URL: Connection string de PostgreSQL
# - API_KEY_MAIN: Clave API principal
# - API_KEY_SECONDARY: Clave API secundaria (opcional)
# - CORS_ORIGINS: Orígenes permitidos (separados por coma)
```

## 2. Base de Datos

```sql
-- Crear base de datos
CREATE DATABASE fcg_storage;

-- La tabla se crea automáticamente con TypeORM synchronize
```

## 3. Iniciar Servicio

```bash
# Desarrollo
npm run start:dev

# Producción
npm run build
npm run start:prod
```

## 4. Probar API

### Health Check
```bash
curl http://localhost:3001/health
```

### Upload File
```bash
curl -X POST http://localhost:3001/storage/upload \
  -H "X-API-Key: dev-key-123" \
  -F "file=@./test-image.jpg" \
  -F "category=PROFILE" \
  -F "entityType=USER" \
  -F "entityId=550e8400-e29b-41d4-a716-446655440000"
```

### List Files
```bash
curl -H "X-API-Key: dev-key-123" \
  "http://localhost:3001/storage/list?category=PROFILE&limit=10"
```

### Download File
```bash
curl -H "X-API-Key: dev-key-123" \
  http://localhost:3001/storage/download/{file-id} \
  --output downloaded-file.jpg
```

### Get Thumbnail
```bash
curl -H "X-API-Key: dev-key-123" \
  http://localhost:3001/storage/thumbnail/{file-id} \
  --output thumbnail.jpg
```

## 5. Swagger UI

Visita `http://localhost:3001/api/docs` para ver la documentación interactiva.

## 6. Integración con Frontend

```typescript
// React/TypeScript example
async function uploadFile(file: File, category: string, entityId: string) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('category', category);
  formData.append('entityType', 'APPLICATION');
  formData.append('entityId', entityId);

  const response = await fetch('http://localhost:3001/storage/upload', {
    method: 'POST',
    headers: {
      'X-API-Key': 'dev-key-123',
    },
    body: formData,
  });

  const data = await response.json();
  return data.file;
}

// Mostrar imagen
<img src={`http://localhost:3001/storage/view/${fileId}`} alt="Preview" />

// Thumbnail
<img src={`http://localhost:3001/storage/thumbnail/${fileId}`} alt="Thumb" />
```

## 7. Deploy en Railway

```bash
# 1. Push a GitHub
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/your-org/fcg-storage.git
git push -u origin main

# 2. En Railway:
# - New Project
# - Deploy from GitHub repo
# - Add PostgreSQL plugin
# - Configure environment variables:
#   - API_KEY_MAIN (generar una segura)
#   - API_KEY_SECONDARY
#   - CORS_ORIGINS (tu dominio frontend)
#   - MAX_FILE_SIZE (10485760 = 10MB)

# 3. Railway auto-detecta NestJS y despliega
```

## 8. Generar API Keys Seguras

```bash
# Linux/Mac
openssl rand -base64 32

# PowerShell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | % {[char]$_})
```

## Categorías Disponibles

- `PROFILE` - Fotos de perfil de usuarios
- `DOCUMENT` - Documentos oficiales (cédulas, certificados)
- `FORM_FIELD` - Archivos subidos en campos de formulario
- `ATTACHMENT` - Adjuntos generales
- `OTHER` - Otros tipos

## Tipos de Entidad

- `USER` - Relacionado con usuario
- `APPLICATION` - Relacionado con postulación
- `FORM_ANSWER` - Relacionado con respuesta de formulario
- `INSTITUTION` - Relacionado con institución
- `OTHER` - Otro tipo

## Troubleshooting

### Puerto ya en uso
```bash
# Cambiar PORT en .env
PORT=3002
```

### Error de permisos en uploads/
```bash
mkdir -p uploads/{profiles,documents,forms,thumbnails,temp}
chmod -R 755 uploads
```

### Sharp no funciona
```bash
npm rebuild sharp
```

### Connection refused PostgreSQL
Verificar DATABASE_URL en .env y que PostgreSQL esté corriendo
