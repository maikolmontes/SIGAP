-- =========================
-- TABLAS BASE
-- =========================

CREATE TABLE facultad (
    id_facultad SERIAL PRIMARY KEY,
    nombre_facultad VARCHAR(150),
    detalle_facultad TEXT,
    activa BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tipo_contrato (
    id_contrato SERIAL PRIMARY KEY,
    tipo VARCHAR(100),
    horas_contrato INT,
    activo BOOLEAN DEFAULT TRUE
);

CREATE TABLE roles (
    id_rol SERIAL PRIMARY KEY,
    nombre_rol VARCHAR(100),
    descripcion_rol TEXT
);

CREATE TABLE permisos (
    id_permisos SERIAL PRIMARY KEY,
    modulo VARCHAR(100),
    accion VARCHAR(100),
    detalle_permiso TEXT
);

CREATE TABLE semana (
    id_semana SERIAL PRIMARY KEY,
    numero_semana VARCHAR(20),
    etiqueta VARCHAR(50),
    habilitada BOOLEAN
);

CREATE TABLE resultados (
    id_resultados SERIAL PRIMARY KEY,
    porcentaje_avance NUMERIC(5,2)
);

-- =========================
-- ESTRUCTURA ACADÉMICA
-- =========================

CREATE TABLE pensul_academico (
    id_pensulaca SERIAL PRIMARY KEY,
    version_pensul VARCHAR(50),
    anio_vigencia INT,
    activo BOOLEAN,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE programa_academico (
    id_programa SERIAL PRIMARY KEY,
    id_facultad INT REFERENCES facultad(id_facultad),
    nombre_programa VARCHAR(150),
    activo BOOLEAN,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE semestres (
    id_semestre SERIAL PRIMARY KEY,
    id_pensulaca INT REFERENCES pensul_academico(id_pensulaca),
    nombresem VARCHAR(50)
);

CREATE TABLE espacio_academico (
    id_espacio_aca SERIAL PRIMARY KEY,
    id_semestre INT REFERENCES semestres(id_semestre),
    codigo_espacio VARCHAR(50),
    nombre_espacio VARCHAR(150),
    creditos INT,
    horas_semana INT,
    activo BOOLEAN
);

-- =========================
-- PERIODOS
-- =========================

CREATE TABLE periodo (
    id_periodo SERIAL PRIMARY KEY,
    anio INT,
    semestre INT,
    fecha_inicio DATE,
    fecha_fin DATE,
    activo BOOLEAN,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE programa_periodo (
    id_progperiodo SERIAL PRIMARY KEY,
    id_periodo INT REFERENCES periodo(id_periodo),
    id_programa INT REFERENCES programa_academico(id_programa),
    id_pensulaca INT REFERENCES pensul_academico(id_pensulaca)
);

-- =========================
-- USUARIOS
-- =========================

CREATE TABLE usuarios (
    id_usuario SERIAL PRIMARY KEY,
    id_contrato INT REFERENCES tipo_contrato(id_contrato),
    id_programa INT REFERENCES programa_academico(id_programa),
    nombres VARCHAR(100),
    apellidos VARCHAR(100),
    tipo_documento VARCHAR(20),
    numero_documento VARCHAR(50),
    correo VARCHAR(150),
    activo BOOLEAN,
    ultimo_acceso TIMESTAMP,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE usuario_rol (
    id_usuariorol SERIAL PRIMARY KEY,
    id_usuario INT REFERENCES usuarios(id_usuario),
    id_rol INT REFERENCES roles(id_rol)
);

CREATE TABLE rol_permiso (
    id_rolpermiso SERIAL PRIMARY KEY,
    id_permisos INT REFERENCES permisos(id_permisos),
    id_rol INT REFERENCES roles(id_rol),
    fecha_ingreso TIMESTAMP
);

-- =========================
-- NIVEL ACADÉMICO
-- =========================

CREATE TABLE nivel_academico (
    id_nivelaca SERIAL PRIMARY KEY,
    nombre_titulo VARCHAR(150),
    nivel VARCHAR(50),
    titulo_convalidado BOOLEAN,
    activo BOOLEAN
);

CREATE TABLE usuario_nivel (
    id_usuarionivel SERIAL PRIMARY KEY,
    id_usuario INT REFERENCES usuarios(id_usuario),
    id_nivelaca INT REFERENCES nivel_academico(id_nivelaca),
    fecha_inicio DATE
);

-- =========================
-- GRUPOS
-- =========================

CREATE TABLE grupos (
    id_grupos SERIAL PRIMARY KEY,
    nombre_grupo VARCHAR(100),
    jornada VARCHAR(50)
);

CREATE TABLE semestres_grupos (
    id_semestregrupo SERIAL PRIMARY KEY,
    id_semestre INT REFERENCES semestres(id_semestre),
    id_grupos INT REFERENCES grupos(id_grupos),
    activo BOOLEAN
);

-- =========================
-- FUNCIONES Y ASIGNACIONES
-- =========================

CREATE TABLE asignacion_funciones (
    id_funciones SERIAL PRIMARY KEY,
    funcion_sustantiva VARCHAR(150),
    horas_funcion NUMERIC,
    estado_agenda VARCHAR(50),
    observaciones_generales TEXT,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE asignacion_actividades (
    id_asignacionact SERIAL PRIMARY KEY,
    id_funciones INT REFERENCES asignacion_funciones(id_funciones),
    id_espacio_aca INT REFERENCES espacio_academico(id_espacio_aca),
    rol_seleccionado VARCHAR(100),
    horas_rol NUMERIC,
    orden INT,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE usuario_asignacion (
    id_usuarioasig SERIAL PRIMARY KEY,
    id_usuario INT REFERENCES usuarios(id_usuario),
    id_funciones INT REFERENCES asignacion_funciones(id_funciones)
);

-- =========================
-- SEGUIMIENTO
-- =========================

CREATE TABLE descripcion (
    id_descripcion SERIAL PRIMARY KEY,
    id_asignacionact INT REFERENCES asignacion_actividades(id_asignacionact),
    resultado_esperado TEXT,
    meta NUMERIC,
    activo BOOLEAN
);

CREATE TABLE indicadores (
    id_indicadores SERIAL PRIMARY KEY,
    id_descripcion INT REFERENCES descripcion(id_descripcion),
    nombre_indicador TEXT,
    fecha_carga TIMESTAMP,
    activo BOOLEAN
);

CREATE TABLE evidencias (
    id_evidencias SERIAL PRIMARY KEY,
    id_indicadores INT REFERENCES indicadores(id_indicadores),
    nombre_archivo TEXT,
    ruta_archivo TEXT,
    tipo_archivo INT,
    tamanio_archivo_kb INT,
    fecha_carga TIMESTAMP
);

-- =========================
-- ACTIVIDADES
-- =========================

CREATE TABLE actividad_semana (
    id_actsemana SERIAL PRIMARY KEY,
    id_asignacionact INT REFERENCES asignacion_actividades(id_asignacionact),
    id_semana INT REFERENCES semana(id_semana),
    id_resultados INT REFERENCES resultados(id_resultados),
    observaciones TEXT,
    estado_aprobacion VARCHAR(50),
    ejecucion NUMERIC
);


ROLES 1)	Casos de uso
	Con el fin de representar la interacción entre los usuarios y el sistema, se elaboraron los diagramas de casos de uso, los cuales permiten describir de manera gráfica las funcionalidades del sistema desde la perspectiva de los actores involucrados. Estos diagramas facilitan la comprensión del comportamiento del sistema, mostrando cómo cada usuario interactúa con las diferentes funcionalidades del SIGAP.
	A partir del análisis de requerimientos, se identificaron los siguientes actores principales:
•	Docente: encargado de registrar su actividad profesoral, estructurar su agenda académica, reportar avances periódicos y adjuntar evidencias digitales.
•	Director de Programa: responsable de validar la información registrada por los docentes, realizar seguimiento al cumplimiento de las actividades y generar reportes académicos.
•	Personal de Planeación / Administrador: encargado de la configuración del sistema, gestión de usuarios y análisis de la información institucional para la toma de decisiones.
•	Consultor / Auditor: usuario con acceso de solo lectura, orientado a procesos de verificación, auditoría y acreditación institucional.

	Casos de uso del rol Planeación
	El rol de Planeación o Administrador es responsable de la configuración y administración general del sistema SIGAP. Sus funciones incluyen la gestión de usuarios, la definición de roles, la administración de la estructura académica (facultades, programas, pensum y espacios académicos), y la configuración de períodos y parámetros institucionales. Además, controla la habilitación de los cortes de seguimiento académico y utiliza herramientas de analítica descriptiva para monitorear el cumplimiento institucional, generar indicadores y elaborar reportes que faciliten los procesos de evaluación y toma de decisiones estratégicas.
 
Fig. 11 Caso de uso rol Planeación
	Casos de uso del rol director
	El director de Programa es el encargado de supervisar y validar la gestión académica de los docentes dentro de su programa. Su función consiste en revisar las agendas registradas, aprobarlas o devolverlas con observaciones, y realizar seguimiento al cumplimiento de los avances reportados en las semanas 8 y 16, verificando evidencias y niveles de ejecución. Asimismo, puede consultar información académica de los docentes y utilizar herramientas de analítica descriptiva para evaluar el desempeño del programa y generar reportes consolidados que apoyen la toma de decisiones.
 
Fig. 12 Caso de uso rol Director
	Casos de uso del rol Docente
	El docente es el usuario principal del sistema SIGAP y tiene como función planificar, registrar y hacer seguimiento a su labor académica durante el período académico. A través del sistema, crea y edita su agenda, distribuye sus horas entre las funciones sustantivas, registra actividades y reporta avances en los cortes establecidos de la Semana 8 y Semana 16, adjuntando evidencias digitales que respalden su cumplimiento. Además, puede consultar el estado de su agenda, su historial de avances y el porcentaje de ejecución de sus actividades.
 
Fig. 13 Caso de uso rol Docente
	Casos de uso del rol Consultor
	El Consultor o Auditor es un usuario con acceso de solo lectura cuya función principal es verificar la información registrada en el sistema con fines de auditoría, evaluación o acreditación. Puede consultar agendas docentes, revisar actividades, avances y evidencias, así como acceder a indicadores y dashboards institucionales. Este rol permite validar la trazabilidad y el cumplimiento de las funciones académicas sin intervenir en la información, facilitando procesos de control interno y externo.
