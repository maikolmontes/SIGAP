require('dotenv').config();
const pool = require('./db/connection');

async function clean() {
    try {
        const client = await pool.connect();
        await client.query('BEGIN');
        
        // Asumiendo que hay un solo usuario activo en el entorno de pruebas, o los borramos todos (los que están asignados)
        const agRes = await client.query('SELECT id_funciones FROM usuario_asignacion');
        const funcIds = agRes.rows.map(r => r.id_funciones);
        
        if (funcIds.length > 0) {
            console.log("Funciones a borrar (de usuarios, NO del catálogo):", funcIds);
            
            const actRes = await client.query('SELECT id_asignacionact FROM asignacion_actividades WHERE id_funciones = ANY($1)', [funcIds]);
            const actIds = actRes.rows.map(r => r.id_asignacionact);
            
            if (actIds.length > 0) {
                const indRes = await client.query('SELECT id_indicadores FROM indicadores WHERE id_descripcion IN (SELECT id_descripcion FROM descripcion WHERE id_asignacionact = ANY($1))', [actIds]);
                const indIds = indRes.rows.map(r => r.id_indicadores);
                if (indIds.length > 0) {
                    await client.query('DELETE FROM evidencias WHERE id_indicadores = ANY($1)', [indIds]);
                }
                await client.query('DELETE FROM indicadores WHERE id_descripcion IN (SELECT id_descripcion FROM descripcion WHERE id_asignacionact = ANY($1))', [actIds]);
                await client.query('DELETE FROM descripcion WHERE id_asignacionact = ANY($1)', [actIds]);
                await client.query('DELETE FROM actividad_semana WHERE id_asignacionact = ANY($1)', [actIds]);
                await client.query('DELETE FROM asignacion_actividades WHERE id_funciones = ANY($1)', [funcIds]);
            }
            
            await client.query('DELETE FROM usuario_asignacion WHERE id_funciones = ANY($1)', [funcIds]);
            await client.query('DELETE FROM asignacion_funciones WHERE id_funciones = ANY($1)', [funcIds]);
            
            console.log("Agenda del usuario limpiada con éxito.");
        } else {
            console.log("No hay agendas asignadas a usuarios para limpiar.");
        }
        
        // Verificar cuántas funciones quedan (Debería ser el catálogo)
        const checkRes = await client.query('SELECT funcion_sustantiva FROM asignacion_funciones');
        console.log(`Quedan ${checkRes.rowCount} funciones maestras en el catálogo.`);
        
        await client.query('COMMIT');
        client.release();
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
clean();
