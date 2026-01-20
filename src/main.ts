import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');
  const isProduction = config.get<string>('NODE_ENV') === 'production';

  // Security - Helmet with strict settings
  app.use(helmet.default({
    contentSecurityPolicy: isProduction ? undefined : false,
    crossOriginEmbedderPolicy: false,
  }));

  // CORS - Restrictivo en producción
  const corsOrigins = config.get<string>('CORS_ORIGINS')?.split(',') || [];
  if (corsOrigins.length === 0 && isProduction) {
    logger.warn('⚠️ CORS_ORIGINS not configured in production!');
  }
  app.enableCors({
    origin: isProduction ? corsOrigins : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger documentation - SOLO en desarrollo
  if (!isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('FCG Storage Service')
      .setDescription(`
## Microservicio de Almacenamiento de Archivos

API REST para gestión de archivos de la Fundación Carmen Goudie.

### Características:
- Subida de archivos con validación de tipos y tamaños
- Generación automática de miniaturas para imágenes
- Categorización y asociación con entidades
- Soft delete para mantener historial
- Rate limiting por endpoint

### Autenticación:
Todos los endpoints requieren **API Key** en el header \`X-API-Key\`.

### Categorías de archivo:
- **PROFILE**: Fotos de perfil
- **DOCUMENT**: Documentos oficiales
- **FORM_FIELD**: Archivos de formularios
- **ATTACHMENT**: Adjuntos generales
- **OTHER**: Otros

### Tipos de entidad:
- USER, APPLICATION, FORM_ANSWER, INSTITUTION, OTHER
      `)
      .setVersion('1.0')
      .addTag('Storage', 'Operaciones de archivos: subida, descarga, listado, eliminación')
      .addApiKey({ type: 'apiKey', name: 'X-API-Key', in: 'header' }, 'api-key')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
    logger.log('📚 Swagger docs enabled at /api/docs');
  } else {
    logger.log('🔒 Swagger docs disabled in production');
  }

  const port = config.get<number>('PORT') || 3001;
  await app.listen(port);
  logger.log(`🚀 Storage service running on port ${port}`);
  logger.log(`🌍 Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
}
bootstrap();
