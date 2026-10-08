// Reglas de los roles de SIGAP compartidas por la selección de rol y la pantalla de inicio.

export interface RolUsuario {
    id_rol: number
    nombre_rol: string
    descripcion_rol?: string
    /** Funciones sustantivas que este rol revisa (database/rol_funcion.sql) */
    funciones_revisa?: string[]
}

/** Nombre del rol sin tildes ni mayúsculas, para compararlo ("Planeación" = "planeacion"). */
export const normalizarRol = (nombre: string): string =>
    (nombre || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()

export type TipoRol = 'docente' | 'director' | 'planeacion' | 'consultor' | 'revision'

/** A qué módulo pertenece un rol. Cualquier otro rol con funciones a revisar entra al módulo de revisión. */
export const tipoDeRol = (rol: RolUsuario): TipoRol | null => {
    const n = normalizarRol(rol.nombre_rol)
    if (n.includes('docente')) return 'docente'
    if (n.includes('director')) return 'director'
    if (n.includes('planeacion') || n.includes('admin')) return 'planeacion'
    if (n.includes('consultor') || n.includes('auditor')) return 'consultor'
    if (rol.funciones_revisa?.length) return 'revision'
    return null
}

/** Pantalla a la que entra quien activa este rol. */
export const rutaInicialDeRol = (rol: RolUsuario): string => {
    switch (tipoDeRol(rol)) {
        case 'docente': return '/docente/dashboard'
        case 'director': return '/director/dashboard'
        case 'planeacion': return '/planeacion/dashboard'
        case 'consultor': return '/consultor/dashboard'
        case 'revision': return '/revision/dashboard'
        default: return '/perfil'
    }
}

// Los roles se guardan sin tilde y en singular ("Planeacion", "Docente"): así se muestran en la pantalla de inicio
const ETIQUETAS_PUBLICAS: Record<string, string> = {
    planeacion: 'Planeación',
    docente: 'Docentes',
    director: 'Directores',
    consultor: 'Consultores',
    investigacion: 'Investigación',
}

/** Rótulo de un rol para quien aún no inicia sesión. Un rol nuevo se muestra con su propio nombre. */
export const etiquetaPublicaDeRol = (nombreRol: string): string =>
    ETIQUETAS_PUBLICAS[normalizarRol(nombreRol)] ?? nombreRol

/** Roles que se muestran mientras llegan los reales del servidor (o si este no responde). */
export const ROLES_PUBLICOS_POR_DEFECTO = ['Planeación', 'Docentes', 'Directores', 'Consultores', 'Investigación']
