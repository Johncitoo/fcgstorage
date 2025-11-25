# FCG Storage Service

Microservicio de almacenamiento de archivos self-hosted para Fundación Carmen Goudie.

##  Características

-  API REST completa (upload, download, delete, list)
-  Autenticación con API Keys
-  Metadata almacenada en PostgreSQL
-  Organización por categorías (profiles, documents, forms)
-  Generación automática de thumbnails para imágenes
-  Rate limiting
-  CORS configurado
-  Documentación Swagger
-  Health checks

##  Requisitos

- Node.js >= 18
- PostgreSQL >= 13
- npm o yarn

##  Instalación

1. Clonar repositorio
2. `npm install`
3. Copiar `.env.example` a `.env` y configurar
4. `npm run start:dev`

Servicio disponible en `http://localhost:3001`
Swagger docs en `http://localhost:3001/api/docs`

##  Ejemplo de Upload

```bash
curl -X POST http://localhost:3001/storage/upload \
  -H "X-API-Key: your-api-key" \
  -F "file=@/path/to/file.jpg" \
  -F "category=PROFILE" \
  -F "entityId=uuid"
```

##  Deploy en Railway

1. Crear proyecto en Railway
2. Conectar con GitHub
3. Agregar PostgreSQL addon
4. Configurar env vars: API_KEY_MAIN, API_KEY_SECONDARY, CORS_ORIGINS

Railway auto-detecta y despliega NestJS.
