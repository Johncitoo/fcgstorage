# 🚂 Railway Setup - FCG Storage Service

## ✅ Checklist de Configuración

### 1. Conectar a la Base de Datos Existente

**IMPORTANTE:** Vamos a usar la MISMA base de datos del backend principal (fcgback).

- [ ] En Railway Dashboard, ve al proyecto **fcgback**
- [ ] Click en el servicio de **PostgreSQL**
- [ ] Copia el valor de `DATABASE_URL` (Variables tab)
- [ ] Ve al proyecto **fcgstorage**
- [ ] Agrega manualmente la variable `DATABASE_URL` con el mismo valor

### 2. Configurar Variables de Entorno

Ve a tu servicio → "Variables" tab y agrega:

```env
# ⚠️ REQUERIDAS
API_KEY_MAIN=c3494e2a10724f4bb0ca8729f5cea62df651648ec1744361b12597b2a26d3070
API_KEY_SECONDARY=1c1846ff65d84b8aa34a324bb5d191b66cf2f81de5f743eb954ca8c1456fec7b

# CORS - SOLO Backend Principal (nunca frontend directo)
CORS_ORIGINS=https://fcgback-production.up.railway.app

# Puerto y Entorno
PORT=3001
NODE_ENV=production
```

**Variable de Base de Datos:**
- `DATABASE_URL` - Copiar del proyecto fcgback (misma BD compartida)

### 3. Verificar Deployment

Después de agregar PostgreSQL:
- [ ] Railway auto-redesplegará
- [ ] Ir a "Deployments" y ver logs
- [ ] Debe decir: `[Nest] Application is running on: http://[::]:3001`
- [ ] NO debe decir errores de `ECONNREFUSED`

### 4. Obtener URL del Servicio

- [ ] En Railway Dashboard → tu servicio
- [ ] Click en "Settings" → "Networking"
- [ ] Copiar la URL pública (ej: `https://fcgstorage-production.up.railway.app`)
- [ ] Guardar esta URL, la necesitarás para conectar con el backend principal

### 5. Probar el Servicio

```bash
# Health Check
curl https://TU-URL.up.railway.app/health

# Respuesta esperada:
{
  "status": "ok",
  "timestamp": "2025-11-25T...",
  "database": "connected",
  "uptime": 123
}
```

## 🔍 Troubleshooting

### Error: "Unable to connect to the database"
✅ **Solución:** Agregar PostgreSQL addon en Railway

### Error: "Unauthorized"
✅ **Solución:** Verificar que `API_KEY_MAIN` esté configurada

### Error: "CORS policy"
✅ **Solución:** Agregar SOLO URL del backend principal a `CORS_ORIGINS`

## 📊 Estructura de BD

Railway creará automáticamente la tabla `files_metadata` al iniciar el servicio (TypeORM syncronize).

**Campos:**
- `id` (UUID)
- `originalFilename`, `storedFilename`
- `mimetype`, `size`, `category`
- `entityType`, `entityId`
- `path`, `thumbnailPath`
- `uploadedBy`, `uploadedAt`
- `active`

## 🔗 Siguiente Paso

Una vez que el servicio esté funcionando:
1. Copia la URL pública de Railway
2. Ve al backend principal (fcgback)
3. Sigue las instrucciones en `INTEGRATION.md`

##  Ejecutar Migraci�n de Base de Datos

Una vez configurado `DATABASE_URL` en Railway:

### Opci�n 1: Desde tu computadora local

```bash
# 1. Copiar DATABASE_URL del proyecto fcgback en Railway
# 2. Agregar al .env local
DATABASE_URL=postgresql://postgres:...

# 3. Ejecutar migraci�n
node run-migration.js
```

### Opci�n 2: Ejecutar SQL directamente

1. Ve al proyecto fcgback en Railway
2. Click en PostgreSQL  "Data" tab
3. Pega el contenido de `migrations/001_create_files_metadata.sql`
4. Click "Execute"

La tabla `files_metadata` se crear� en la misma BD del backend principal.


