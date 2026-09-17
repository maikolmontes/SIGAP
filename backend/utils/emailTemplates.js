// ================================================================
// SIGAP — Plantillas HTML de correo institucional
// ----------------------------------------------------------------
// Diseño responsivo con tablas (compatible con Gmail/Outlook) y los
// colores institucionales de la Universidad CESMAG.
// ================================================================

const COLORES = {
    azul: '#1a2744',
    verde: '#00a896',
    naranja: '#ea580c',
    texto: '#1f2937',
    textoSuave: '#6b7280',
    borde: '#e5e7eb',
    fondo: '#f4f6f9'
};

const frontendUrl = () => (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');

// Construye una URL absoluta hacia una ruta del frontend
const url = (ruta = '/') => `${frontendUrl()}/${String(ruta).replace(/^\/+/, '')}`;

// Evita que datos con < > & rompan el HTML del correo
const esc = (valor) =>
    String(valor === null || valor === undefined ? '' : valor)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

// Convierte saltos de línea en <br> respetando el escapado
const nl2br = (valor) => esc(valor).replace(/\r?\n/g, '<br>');

const boton = (texto, enlace, color = COLORES.verde) => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0;">
    <tr>
      <td align="center" bgcolor="${color}" style="border-radius:6px;">
        <a href="${esc(enlace)}" target="_blank"
           style="display:inline-block;padding:13px 30px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:6px;">
          ${esc(texto)}
        </a>
      </td>
    </tr>
  </table>`;

// Bloque de datos clave (etiqueta / valor)
const tablaDatos = (filas = []) => {
    const visibles = filas.filter(([, valor]) => valor !== null && valor !== undefined && String(valor).trim() !== '');
    if (visibles.length === 0) return '';

    const cuerpo = visibles
        .map(
            ([etiqueta, valor]) => `
      <tr>
        <td style="padding:7px 14px 7px 0;font-size:13px;color:${COLORES.textoSuave};white-space:nowrap;vertical-align:top;">${esc(etiqueta)}</td>
        <td style="padding:7px 0;font-size:14px;color:${COLORES.texto};font-weight:bold;vertical-align:top;">${esc(valor)}</td>
      </tr>`
        )
        .join('');

    return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
         style="background:#f8fafc;border:1px solid ${COLORES.borde};border-radius:8px;padding:14px 18px;margin:10px 0 4px;">
    ${cuerpo}
  </table>`;
};

// Recuadro destacado (observaciones, advertencias)
const recuadro = (titulo, contenido, color = COLORES.naranja) => `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
         style="border-left:4px solid ${color};background:#fff7ed;border-radius:0 8px 8px 0;margin:18px 0;">
    <tr>
      <td style="padding:14px 18px;font-family:Arial,Helvetica,sans-serif;">
        <div style="font-size:13px;font-weight:bold;color:${color};text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">${esc(titulo)}</div>
        <div style="font-size:14px;color:${COLORES.texto};line-height:1.6;">${contenido}</div>
      </td>
    </tr>
  </table>`;

// ----------------------------------------------------------------
// Estructura base: cabecera azul, cuerpo blanco y pie institucional
// ----------------------------------------------------------------
const layout = ({ titulo, preheader = '', cuerpo }) => `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(titulo)}</title>
</head>
<body style="margin:0;padding:0;background:${COLORES.fondo};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${COLORES.fondo};padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600"
               style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(15,23,42,.08);font-family:Arial,Helvetica,sans-serif;">

          <!-- Cabecera -->
          <tr>
            <td style="background:${COLORES.azul};padding:26px 30px;">
              <div style="font-size:22px;font-weight:bold;color:#ffffff;letter-spacing:1px;">SIGAP</div>
              <div style="font-size:12px;color:#b9c4d8;margin-top:4px;">Sistema de Información de Gestión de Actividad Profesoral</div>
              <div style="font-size:12px;color:${COLORES.verde};margin-top:2px;font-weight:bold;">Universidad CESMAG</div>
            </td>
          </tr>

          <!-- Franja de color -->
          <tr><td style="height:4px;background:${COLORES.verde};font-size:0;line-height:0;">&nbsp;</td></tr>

          <!-- Contenido -->
          <tr>
            <td style="padding:30px;color:${COLORES.texto};font-size:15px;line-height:1.65;">
              <h1 style="margin:0 0 18px;font-size:20px;color:${COLORES.azul};">${esc(titulo)}</h1>
              ${cuerpo}
            </td>
          </tr>

          <!-- Pie -->
          <tr>
            <td style="background:#f8fafc;border-top:1px solid ${COLORES.borde};padding:20px 30px;">
              <p style="margin:0 0 6px;font-size:12px;color:${COLORES.textoSuave};line-height:1.5;">
                Este es un mensaje automático del SIGAP. Por favor no responda a este correo.
              </p>
              <p style="margin:0;font-size:12px;color:${COLORES.textoSuave};line-height:1.5;">
                Universidad CESMAG — Pasto, Nariño, Colombia<br>
                Si tiene dudas, comuníquese con la Oficina de Planeación.
              </p>
            </td>
          </tr>
        </table>

        <div style="max-width:600px;margin:14px auto 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#9aa4b2;">
          &copy; ${new Date().getFullYear()} Universidad CESMAG &middot; SIGAP
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;

const saludo = (nombre) => `<p style="margin:0 0 14px;">Cordial saludo, <strong>${esc(nombre || 'docente')}</strong>:</p>`;

// ================================================================
// 1. Agenda enviada a revisión  (Docente -> Director)
// ================================================================
const plantillaAgendaEnviada = ({ director, docente, programa, periodo, totalFunciones, enlace }) => {
    const destino = enlace || url('/director/agendas');
    return {
        subject: `Nueva agenda para revisión — ${docente}`,
        html: layout({
            titulo: 'Agenda docente lista para revisión',
            preheader: `${docente} radicó su agenda del período ${periodo || ''} para revisión.`,
            cuerpo: `
        ${saludo(director)}
        <p style="margin:0 0 14px;">
          El docente <strong>${esc(docente)}</strong> completó y radicó su agenda profesoral.
          Ya está disponible en el SIGAP para su revisión y aprobación.
        </p>
        ${tablaDatos([
            ['Docente', docente],
            ['Programa', programa],
            ['Período', periodo],
            ['Funciones diligenciadas', totalFunciones]
        ])}
        ${boton('Revisar agenda en SIGAP', destino)}
        <p style="margin:0;font-size:13px;color:${COLORES.textoSuave};">
          Desde el módulo de revisión podrá aprobar la agenda o devolverla con observaciones.
        </p>`
        })
    };
};

// ================================================================
// 2. Agenda aprobada  (Director -> Docente)
// ================================================================
const plantillaAgendaAprobada = ({ docente, director, periodo, programa, totalHoras, enlace }) => {
    const destino = enlace || url('/docente/agenda');
    return {
        subject: `Su agenda profesoral fue aprobada — ${periodo || 'período vigente'}`,
        html: layout({
            titulo: 'Agenda aprobada',
            preheader: 'Su agenda profesoral fue aprobada por la dirección de programa.',
            cuerpo: `
        ${saludo(docente)}
        <p style="margin:0 0 14px;">
          Le informamos que su agenda profesoral fue <strong style="color:${COLORES.verde};">APROBADA</strong>
          por la dirección del programa. Con esto queda cerrado el trámite de radicación para el período.
        </p>
        ${tablaDatos([
            ['Período', periodo],
            ['Programa', programa],
            ['Aprobada por', director],
            ['Total de horas', totalHoras ? `${totalHoras} horas semanales` : null],
            ['Fecha de aprobación', new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })]
        ])}
        ${boton('Ver mi agenda en SIGAP', destino)}
        <p style="margin:0;font-size:13px;color:${COLORES.textoSuave};">
          Recuerde registrar la ejecución de sus indicadores en la <strong>semana 8</strong> y la <strong>semana 16</strong>,
          adjuntando las evidencias correspondientes.
        </p>`
        })
    };
};

// ================================================================
// 3. Agenda devuelta con observaciones  (Director -> Docente)
// ================================================================
const plantillaAgendaDevuelta = ({ docente, director, periodo, observaciones, fechaLimite, enlace }) => {
    const destino = enlace || url('/docente/agenda');
    return {
        subject: `Su agenda profesoral requiere ajustes — ${periodo || 'período vigente'}`,
        html: layout({
            titulo: 'Agenda devuelta con observaciones',
            preheader: 'La dirección de programa devolvió su agenda con observaciones para corrección.',
            cuerpo: `
        ${saludo(docente)}
        <p style="margin:0 0 14px;">
          La dirección del programa revisó su agenda profesoral y la devolvió para que realice
          algunos ajustes antes de su aprobación definitiva.
        </p>
        ${tablaDatos([
            ['Período', periodo],
            ['Revisada por', director],
            ['Fecha límite para corregir', fechaLimite]
        ])}
        ${recuadro('Observaciones del director', nl2br(observaciones || 'Sin observaciones registradas.'))}
        ${boton('Corregir mi agenda', destino, COLORES.naranja)}
        <p style="margin:0;font-size:13px;color:${COLORES.textoSuave};">
          Una vez aplique los ajustes, guarde nuevamente cada función para que la agenda vuelva a quedar en revisión.
        </p>`
        })
    };
};

// ================================================================
// 4. Bienvenida de nuevo usuario
// ================================================================
const plantillaBienvenida = ({ usuario, roles, programa, correo, enlace }) => {
    const destino = enlace || url('/login');
    return {
        subject: 'Bienvenido(a) al SIGAP — Universidad CESMAG',
        html: layout({
            titulo: 'Su cuenta en SIGAP fue creada',
            preheader: 'Ya puede ingresar al SIGAP con su cuenta institucional de Google.',
            cuerpo: `
        ${saludo(usuario)}
        <p style="margin:0 0 14px;">
          Su cuenta en el <strong>Sistema de Información de Gestión de Actividad Profesoral (SIGAP)</strong>
          ha sido creada. El ingreso se realiza con su <strong>cuenta institucional de Google</strong>,
          por lo que no necesita recordar una contraseña adicional.
        </p>
        ${tablaDatos([
            ['Correo de acceso', correo],
            ['Perfil(es) asignado(s)', roles],
            ['Programa', programa]
        ])}
        ${boton('Ingresar al SIGAP', destino)}
        <p style="margin:0;font-size:13px;color:${COLORES.textoSuave};">
          Pulse <em>"Iniciar sesión con Google"</em> y seleccione su correo institucional
          <strong>@cesmag.edu.co</strong>. Si presenta inconvenientes, comuníquese con la Oficina de Planeación.
        </p>`
        })
    };
};

// ================================================================
// 5. Apertura de período académico
// ================================================================
const plantillaPeriodoAperturado = ({ nombre, periodo, fechaInicio, fechaFin, enlace }) => {
    const destino = enlace || url('/login');
    return {
        subject: `Período académico ${periodo} habilitado en SIGAP`,
        html: layout({
            titulo: `Apertura del período ${periodo}`,
            preheader: `Ya puede estructurar su agenda profesoral del período ${periodo}.`,
            cuerpo: `
        ${saludo(nombre)}
        <p style="margin:0 0 14px;">
          La Oficina de Planeación habilitó el período académico <strong>${esc(periodo)}</strong> en el SIGAP.
          Desde ya puede ingresar al sistema para estructurar y radicar su agenda profesoral.
        </p>
        ${tablaDatos([
            ['Período', periodo],
            ['Fecha de inicio', fechaInicio],
            ['Fecha de cierre', fechaFin]
        ])}
        ${boton('Ingresar al SIGAP', destino)}
        <p style="margin:0;font-size:13px;color:${COLORES.textoSuave};">
          Le recomendamos radicar su agenda con anticipación para dar tiempo a la revisión de la dirección de programa.
        </p>`
        })
    };
};

// ================================================================
// 6. Recordatorio de plazo próximo a vencer
// ================================================================
const plantillaRecordatorioPlazo = ({ docente, periodo, estadoAgenda, fechaLimite, diasRestantes, enlace }) => {
    const destino = enlace || url('/docente/agenda');
    const urgente = diasRestantes !== null && diasRestantes !== undefined && Number(diasRestantes) <= 3;
    return {
        subject: `Recordatorio: su agenda del período ${periodo || 'vigente'} sigue pendiente`,
        html: layout({
            titulo: 'Recordatorio de radicación de agenda',
            preheader: 'Su agenda profesoral aún no ha sido radicada para revisión.',
            cuerpo: `
        ${saludo(docente)}
        <p style="margin:0 0 14px;">
          Según los registros del SIGAP, su agenda profesoral del período
          <strong>${esc(periodo || 'vigente')}</strong> aún no se encuentra radicada para revisión.
        </p>
        ${tablaDatos([
            ['Estado actual', estadoAgenda],
            ['Fecha límite', fechaLimite],
            ['Días restantes', diasRestantes !== null && diasRestantes !== undefined ? String(diasRestantes) : null]
        ])}
        ${urgente ? recuadro('Atención', 'El plazo de radicación está por vencer. Complete su agenda lo antes posible.') : ''}
        ${boton('Completar mi agenda', destino, urgente ? COLORES.naranja : COLORES.verde)}`
        })
    };
};

// ================================================================
// 7. Asignaciones cargadas por Planeación
// ================================================================
const plantillaAsignacionesCargadas = ({ docente, periodo, totalEspacios, enlace }) => {
    const destino = enlace || url('/docente/agenda');
    return {
        subject: `Su carga académica del período ${periodo || 'vigente'} ya está disponible`,
        html: layout({
            titulo: 'Carga académica disponible en SIGAP',
            preheader: 'Planeación cargó su asignación horaria del período.',
            cuerpo: `
        ${saludo(docente)}
        <p style="margin:0 0 14px;">
          La Oficina de Planeación cargó su asignación académica institucional en el SIGAP.
          Ya puede ingresar para estructurar su agenda profesoral con base en esa carga.
        </p>
        ${tablaDatos([
            ['Período', periodo],
            ['Espacios académicos asignados', totalEspacios]
        ])}
        ${boton('Estructurar mi agenda', destino)}
        <p style="margin:0;font-size:13px;color:${COLORES.textoSuave};">
          Si detecta alguna inconsistencia en su carga horaria, repórtela a la dirección de su programa.
        </p>`
        })
    };
};

// ================================================================
// 8. Correo de prueba (diagnóstico de configuración SMTP)
// ================================================================
const plantillaPrueba = ({ solicitante } = {}) => ({
    subject: 'Prueba de configuración de correo — SIGAP',
    html: layout({
        titulo: 'Configuración de correo verificada',
        preheader: 'El servicio de notificaciones del SIGAP está operativo.',
        cuerpo: `
      <p style="margin:0 0 14px;">
        Si usted está leyendo este mensaje, el servicio de notificaciones por correo del SIGAP
        quedó configurado correctamente.
      </p>
      ${tablaDatos([
          ['Fecha y hora', new Date().toLocaleString('es-CO')],
          ['Solicitado por', solicitante],
          ['Servidor SMTP', process.env.EMAIL_HOST || 'smtp.gmail.com'],
          ['Cuenta emisora', process.env.EMAIL_USER || '(no configurada)']
      ])}
      ${boton('Ir al SIGAP', url('/login'))}`
    })
});

module.exports = {
    COLORES,
    url,
    layout,
    plantillaAgendaEnviada,
    plantillaAgendaAprobada,
    plantillaAgendaDevuelta,
    plantillaBienvenida,
    plantillaPeriodoAperturado,
    plantillaRecordatorioPlazo,
    plantillaAsignacionesCargadas,
    plantillaPrueba
};
