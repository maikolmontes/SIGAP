const pool = require('../db/connection');

async function run() {
    try {
        // 1. Verificar o insertar Ingeniería Financiera
        const fac = await pool.query("SELECT id_facultad FROM facultad WHERE LOWER(nombre_facultad) LIKE '%ing%' LIMIT 1");
        const idFac = fac.rows[0]?.id_facultad || 1;

        const prog = await pool.query("SELECT * FROM programa_academico WHERE LOWER(nombre_programa) LIKE '%financiera%'");
        if (prog.rows.length === 0) {
            const ins = await pool.query(
                "INSERT INTO programa_academico (id_facultad, nombre_programa, activo, creado_en) VALUES ($1, $2, TRUE, NOW()) RETURNING *",
                [idFac, 'Ingeniería Financiera']
            );
            console.log('✅ Programa insertado:', ins.rows[0]);
        } else {
            console.log('ℹ️ Programa ya existe:', prog.rows[0]);
        }

        // 2. Limpiar duplicados en usuario_rol
        await pool.query(`
            DELETE FROM usuario_rol a
            USING usuario_rol b
            WHERE a.id_usuariorol > b.id_usuariorol
              AND a.id_usuario = b.id_usuario
              AND a.id_rol = b.id_rol
        `);
        console.log('✅ Duplicados de usuario_rol limpiados');

        // 3. Crear índice/restricción UNIQUE en usuario_rol(id_usuario, id_rol)
        await pool.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'usuario_rol_user_rol_unique'
                ) THEN
                    ALTER TABLE usuario_rol ADD CONSTRAINT usuario_rol_user_rol_unique UNIQUE (id_usuario, id_rol);
                END IF;
            END $$;
        `);
        console.log('✅ Restricción UNIQUE verificada/creada en usuario_rol');

        // 4. Mostrar programas académicos actuales
        const todosProgs = await pool.query("SELECT id_programa, id_facultad, nombre_programa, activo FROM programa_academico ORDER BY id_programa");
        console.log('📋 Lista actual de programas:', todosProgs.rows);

        process.exit(0);
    } catch (e) {
        console.error('❌ Error ejecutando update_db:', e);
        process.exit(1);
    }
}

run();
