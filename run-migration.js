require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' 
      ? { rejectUnauthorized: false } 
      : false
  });

  try {
    await client.connect();
    console.log(' Conectado a PostgreSQL');

    // Leer archivo SQL
    const migrationPath = path.join(__dirname, 'migrations', '001_create_files_metadata.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    // Ejecutar migración
    await client.query(sql);
    console.log(' Tabla files_metadata creada exitosamente');

    // Verificar
    const result = await client.query(`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'files_metadata'
      ORDER BY ordinal_position
    `);
    
    console.log('\n Columnas creadas:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type})`);
    });

  } catch (error) {
    console.error(' Error en migración:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
