/**
 * Script de diagnóstico: verifica roles en la BD
 * Ejecutar con: node backend/db/check_roles.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const pool = require('./connection');

async function main() {
    try {
        console.log('\n=== ROLES EN LA BASE DE DATOS ===');
        const roles = await pool.query('SELECT id_rol, nombre_rol FROM roles ORDER BY id_rol');
        console.table(roles.rows);

        console.log('\n=== CONSTRAINT EN usuario_rol ===');
        const constraints = await pool.query(`
            SELECT constraint_name, constraint_type
            FROM information_schema.table_constraints
            WHERE table_name = 'usuario_rol'
        `);
        console.table(constraints.rows);

        console.log('\n=== COLUMNAS DE usuario_rol ===');
        const cols = await pool.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'usuario_rol'
            ORDER BY ordinal_position
        `);
        console.table(cols.rows);

        console.log('\n=== COLUMNAS DE tipo_contrato ===');
        const contrato = await pool.query(`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'tipo_contrato'
            ORDER BY ordinal_position
        `);
        console.table(contrato.rows);

        console.log('\n=== TIPOS DE CONTRATO ACTIVOS ===');
        const contratos = await pool.query(`SELECT * FROM tipo_contrato`).catch(() =>
            pool.query(`SELECT id_contrato, tipo, horas_contrato FROM tipo_contrato`)
        );
        console.table(contratos.rows);

    } catch (err) {
        console.error('Error de diagnóstico:', err.message);
    } finally {
        process.exit(0);
    }
}

main();
