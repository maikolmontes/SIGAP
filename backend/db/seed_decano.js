require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const pool = require('./connection');

async function main() {
    try {
        const existe = await pool.query(
            "SELECT * FROM roles WHERE LOWER(nombre_rol) = 'decano'"
        );
        if (existe.rows.length > 0) {
            console.log('El rol Decano ya existe:', existe.rows[0]);
        } else {
            const r = await pool.query(
                "INSERT INTO roles (nombre_rol, descripcion_rol) VALUES ($1, $2) RETURNING *",
                ['Decano', 'Supervision de alto nivel de agendas y docentes por facultad. Puede crear observaciones.']
            );
            console.log('Rol Decano insertado:', r.rows[0]);
        }
        const todos = await pool.query('SELECT * FROM roles ORDER BY id_rol');
        console.table(todos.rows);
    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        process.exit(0);
    }
}
main();
