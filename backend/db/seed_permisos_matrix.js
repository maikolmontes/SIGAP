require('dotenv').config({ path: __dirname + '/../.env' });
const pool = require('./connection');

const matrixData = [
  {
    modulo: 'Planeación Institucional',
    paginas: [
      {
        nombre: 'Docentes y Usuarios',
        descripcion: 'Gestión de profesores, vinculación de roles y estados'
      },
      {
        nombre: 'Facultades',
        descripcion: 'Administración de facultades académicas'
      },
      {
        nombre: 'Programas Académicos',
        descripcion: 'Configuración y registro de programas de pregrado y posgrado'
      },
      {
        nombre: 'Períodos Académicos',
        descripcion: 'Apertura, cierre y estado activo de semestres'
      },
      {
        nombre: 'Semanas y Cortes',
        descripcion: 'Programación de semanas críticas (Semana 8 y Semana 16)'
      },
      {
        nombre: 'Analítica y Reportes',
        descripcion: 'Métricas institucionales, cumplimiento y avance general'
      }
    ]
  },
  {
    modulo: 'Dirección y Supervisión',
    paginas: [
      {
        nombre: 'Agendas por Revisar',
        descripcion: 'Revisión y aprobación de cargas docentes enviadas'
      },
      {
        nombre: 'Historial de Agendas',
        descripcion: 'Consulta de agendas de períodos anteriores'
      },
      {
        nombre: 'Observaciones Docentes',
        descripcion: 'Retroalimentación y solicitudes de corrección'
      },
      {
        nombre: 'Reportes de Gestión',
        descripcion: 'Generación de informes de avance para decanatura'
      }
    ]
  },
  {
    modulo: 'Gestión Docente',
    paginas: [
      {
        nombre: 'Mi Agenda Académica',
        descripcion: 'Diligenciamiento de funciones sustantivas y horas de contrato'
      },
      {
        nombre: 'Avance Semana 8',
        descripcion: 'Registro de cumplimiento para primer corte de actividades'
      },
      {
        nombre: 'Avance Semana 16',
        descripcion: 'Consolidación final de avance y cumplimiento de semestre'
      },
      {
        nombre: 'Evidencias e Indicadores',
        descripcion: 'Cargue y vinculación de archivos probatorios por actividad'
      }
    ]
  },
  {
    modulo: 'Auditoría y Consultoría',
    paginas: [
      {
        nombre: 'Seguimiento y Auditoría',
        descripcion: 'Inspección de cargas y avances en modo lectura'
      },
      {
        nombre: 'Observaciones de Control',
        descripcion: 'Emisión de notas de auditoría y recomendaciones'
      },
      {
        nombre: 'Analítica Institucional',
        descripcion: 'Dashboards analíticos de cumplimiento global'
      }
    ]
  },
  {
    modulo: 'Seguridad y Configuración',
    paginas: [
      {
        nombre: 'Gestión de Perfiles y Permisos',
        descripcion: 'Asignación matricial de privilegios de acceso por rol'
      },
      {
        nombre: 'Perfil de Usuario',
        descripcion: 'Actualización de datos personales y credenciales'
      }
    ]
  }
];

const acciones = ['Ver', 'Crear', 'Editar', 'Eliminar'];

async function seed() {
  const client = await pool.connect();
  try {
    console.log('Iniciando actualización de esquema de permisos...');
    await client.query('BEGIN');

    // 1. Agregar columna pagina si no existe
    await client.query(`
      ALTER TABLE permisos 
      ADD COLUMN IF NOT EXISTS pagina VARCHAR(100);
    `);

    // 2. Verificar o limpiar constraint única
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'permisos_modulo_pagina_accion_unique'
        ) THEN
          ALTER TABLE permisos 
          ADD CONSTRAINT permisos_modulo_pagina_accion_unique UNIQUE (modulo, pagina, accion);
        END IF;
      END $$;
    `);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'rol_permiso_rol_permiso_unique'
        ) THEN
          ALTER TABLE rol_permiso 
          ADD CONSTRAINT rol_permiso_rol_permiso_unique UNIQUE (id_rol, id_permisos);
        END IF;
      END $$;
    `);

    console.log('Insertando catálogo matricial de permisos...');
    for (const mod of matrixData) {
      for (const pag of mod.paginas) {
        for (const acc of acciones) {
          const detalle = `${acc} en ${pag.nombre} (${mod.modulo}): ${pag.descripcion}`;
          await client.query(`
            INSERT INTO permisos (modulo, pagina, accion, detalle_permiso)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (modulo, pagina, accion)
            DO UPDATE SET detalle_permiso = EXCLUDED.detalle_permiso
          `, [mod.modulo, pag.nombre, acc, detalle]);
        }
      }
    }

    // 3. Asignar permisos iniciales por defecto a los roles:
    // id_rol 1: Planeacion -> Todos los permisos
    // id_rol 2: Docente -> Gestión Docente (todos), Perfil (Ver, Editar)
    // id_rol 3: Director -> Dirección y Supervisión (todos), Gestión Docente (Ver), Reportes (Ver)
    // id_rol 4: Consultor -> Solo 'Ver' en todos los módulos
    console.log('Configurando permisos iniciales por rol...');
    
    // Traer todos los permisos
    const allPermisosRes = await client.query('SELECT id_permisos, modulo, pagina, accion FROM permisos');
    const allPermisos = allPermisosRes.rows;

    const rolesRes = await client.query('SELECT id_rol, nombre_rol FROM roles');
    const roles = rolesRes.rows;

    for (const r of roles) {
      const normRol = r.nombre_rol.toLowerCase();
      let permitidos = [];

      if (normRol.includes('planea') || normRol.includes('admin')) {
        // Planeación tiene todos
        permitidos = allPermisos;
      } else if (normRol.includes('direct')) {
        // Director: todos de Dirección y Supervisión, Ver en Gestión Docente, Ver en Planeación
        permitidos = allPermisos.filter(p => 
          p.modulo === 'Dirección y Supervisión' ||
          (p.modulo === 'Gestión Docente' && (p.accion === 'Ver' || p.accion === 'Editar')) ||
          (p.modulo === 'Planeación Institucional' && p.accion === 'Ver') ||
          p.pagina === 'Perfil de Usuario'
        );
      } else if (normRol.includes('docen')) {
        // Docente: todos de Gestión Docente, Ver y Editar en Perfil
        permitidos = allPermisos.filter(p => 
          p.modulo === 'Gestión Docente' ||
          (p.pagina === 'Perfil de Usuario' && (p.accion === 'Ver' || p.accion === 'Editar'))
        );
      } else if (normRol.includes('consult')) {
        // Consultor: solo 'Ver' en todo
        permitidos = allPermisos.filter(p => p.accion === 'Ver');
      }

      for (const p of permitidos) {
        await client.query(`
          INSERT INTO rol_permiso (id_rol, id_permisos, fecha_ingreso)
          VALUES ($1, $2, NOW())
          ON CONFLICT (id_rol, id_permisos) DO NOTHING
        `, [r.id_rol, p.id_permisos]);
      }
    }

    await client.query('COMMIT');
    console.log('Sembrado de matriz de permisos finalizado exitosamente.');
    process.exit(0);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al sembrar matriz de permisos:', error);
    process.exit(1);
  } finally {
    client.release();
  }
}

seed();
