/**
 * Migración para el módulo Director — SIGAP
 * Crea tabla observaciones_director y agrega campos a asignacion_funciones
 * Solo agrega lo que no existe.
 */
require('dotenv').config();
const pool = require('./db/connection');

const migrate = async () => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Crear tabla observaciones_director si no existe
        await client.query(`
            CREATE TABLE IF NOT EXISTS observaciones_director (
                id SERIAL PRIMARY KEY,
                id_asignacionact INTEGER REFERENCES asignacion_actividades(id_asignacionact) ON DELETE CASCADE,
                semana INTEGER CHECK (semana IN (8, 16)),
                texto TEXT NOT NULL,
                director_id INTEGER REFERENCES usuarios(id_usuario),
                fecha TIMESTAMP DEFAULT NOW(),
                ultima_edicion TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('✅ Tabla observaciones_director verificada/creada');

        // 2. Agregar campo revisado_por a asignacion_funciones si no existe
        const revCol = await client.query(`
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'asignacion_funciones' AND column_name = 'revisado_por'
        `);
        if (revCol.rows.length === 0) {
            await client.query(`
                ALTER TABLE asignacion_funciones
                ADD COLUMN revisado_por INTEGER REFERENCES usuarios(id_usuario)
            `);
            console.log('✅ Campo revisado_por agregado a asignacion_funciones');
        } else {
            console.log('ℹ️  Campo revisado_por ya existe');
        }

        // 3. Agregar campo fecha_revision a asignacion_funciones si no existe
        const fechaCol = await client.query(`
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'asignacion_funciones' AND column_name = 'fecha_revision'
        `);
        if (fechaCol.rows.length === 0) {
            await client.query(`
                ALTER TABLE asignacion_funciones
                ADD COLUMN fecha_revision TIMESTAMP
            `);
            console.log('✅ Campo fecha_revision agregado a asignacion_funciones');
        } else {
            console.log('ℹ️  Campo fecha_revision ya existe');
        }

        // 4. Verificar que estado_agenda acepte los valores 'Aprobada' y 'Devuelta'
        // Primero, verificar si hay un CHECK constraint en estado_agenda
        const checkRes = await client.query(`
            SELECT con.conname, pg_get_constraintdef(con.oid) as definition
            FROM pg_constraint con
            JOIN pg_class rel ON rel.oid = con.conrelid
            WHERE rel.relname = 'asignacion_funciones'
            AND con.contype = 'c'
            AND pg_get_constraintdef(con.oid) LIKE '%estado_agenda%'
        `);

        if (checkRes.rows.length > 0) {
            // Hay un CHECK constraint — eliminarlo y recrearlo con los valores ampliados
            for (const row of checkRes.rows) {
                await client.query(`ALTER TABLE asignacion_funciones DROP CONSTRAINT ${row.conname}`);
                console.log(`✅ CHECK constraint '${row.conname}' eliminado`);
            }
            await client.query(`
                ALTER TABLE asignacion_funciones
                ADD CONSTRAINT estado_agenda_check
                CHECK (estado_agenda IN ('Pendiente', 'Aceptado', 'Aprobada', 'Devuelta'))
            `);
            console.log('✅ CHECK constraint recreado con valores: Pendiente, Aceptado, Aprobada, Devuelta');
        } else {
            console.log('ℹ️  No hay CHECK constraint en estado_agenda (o no se encontró)');
        }

        // 5. Crear índice para búsquedas rápidas en observaciones_director
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_obs_director_actividad
            ON observaciones_director(id_asignacionact, semana)
        `);
        console.log('✅ Índice en observaciones_director verificado/creado');

        await client.query('COMMIT');
        console.log('\n🎉 Migración completada exitosamente');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error en migración:', error.message);
    } finally {
        client.release();
        process.exit(0);
    }
};

migrate();
