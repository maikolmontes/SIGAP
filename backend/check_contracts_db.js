require('dotenv').config();
const pool = require('./db/connection');

const calcularPerfilDocente = (tipoContrato, horasDirectas, horasInvestigacion, totalHoras = 0, horasContrato = 40) => {
    const th = parseFloat(totalHoras) || 0;
    const hc = parseFloat(horasContrato) || 40;

    if (th === hc) {
        return 'AGENDA CORRECTA';
    } else {
        return 'INCONSISTENCIAS EN AGENDA AC 30';
    }
};

async function test() {
    try {
        const idPeriodoRes = await pool.query('SELECT id_periodo FROM periodo WHERE activo = true LIMIT 1');
        const idPeriodo = idPeriodoRes.rows[0].id_periodo;

        const perfilesRes = await pool.query(`
            SELECT
                u.id_usuario,
                u.nombres || ' ' || u.apellidos AS nombre_docente,
                tc.tipo AS tipo_contrato,
                tc.horas_contrato AS horas_contrato,
                COALESCE(SUM(af.horas_funcion), 0) AS total_horas,
                COALESCE(SUM(CASE WHEN af.funcion_sustantiva = 'Docencia Directa' THEN af.horas_funcion ELSE 0 END), 0) AS horas_directas,
                COALESCE(SUM(CASE WHEN af.funcion_sustantiva ILIKE '%investigación%' THEN af.horas_funcion ELSE 0 END), 0) AS horas_investigacion
            FROM usuarios u
            JOIN tipo_contrato tc ON tc.id_contrato = u.id_contrato
            JOIN usuario_rol ur ON ur.id_usuario = u.id_usuario
            JOIN roles r ON r.id_rol = ur.id_rol AND LOWER(r.nombre_rol) = 'docente'
            LEFT JOIN usuario_asignacion ua ON ua.id_usuario = u.id_usuario
            LEFT JOIN asignacion_funciones af ON af.id_funciones = ua.id_funciones AND af.id_periodo = $1
            WHERE u.activo = TRUE
            GROUP BY u.id_usuario, u.nombres, u.apellidos, tc.tipo, tc.horas_contrato
        `, [idPeriodo]);

        console.log('--- TEST DE CLASIFICACIÓN DE PERFILES DE AGENDA ---');
        for (const row of perfilesRes.rows) {
            const perfil = calcularPerfilDocente(row.tipo_contrato, row.horas_directas, row.horas_investigacion, row.total_horas, row.horas_contrato);
            console.log(`Docente: ${row.nombre_docente}`);
            console.log(`- Contrato: ${row.tipo_contrato} (${row.horas_contrato}h)`);
            console.log(`- Horas Asignadas: ${row.total_horas}h`);
            console.log(`- Perfil Resultante: ${perfil}`);
            console.log(`- Status: ${perfil === 'AGENDA CORRECTA' ? 'PASS ✅' : 'INCOMPLETE/INCONSISTENT ⚠️'}\n`);
        }
    } catch (e) {
        console.error('Error during test:', e);
    } finally {
        process.exit(0);
    }
}

test();
