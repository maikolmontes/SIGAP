import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from './components/common/ProtectedRoute'
import { useAuth } from './context/AuthContext'
import SessionTimeoutModal from './components/common/SessionTimeoutModal'
import Login from './pages/auth/Login'
const RoleSelection = lazy(() => import('./pages/auth/RoleSelection'))
const DashboardPlaneacion = lazy(() => import('./pages/planeacion/DashboardPlaneacion'))
const Docentes = lazy(() => import('./pages/planeacion/Docentes'))
const Periodos = lazy(() => import('./pages/planeacion/Periodos'))
const Semanas = lazy(() => import('./pages/planeacion/Semanas'))
const Facultades = lazy(() => import('./pages/planeacion/Facultades'))
const Programas = lazy(() => import('./pages/planeacion/Programas'))
const GestionPerfiles = lazy(() => import('./pages/planeacion/GestionPerfiles'))
const Notificaciones = lazy(() => import('./pages/planeacion/Notificaciones'))
const ParametrosGenerales = lazy(() => import('./pages/planeacion/ParametrosGenerales'))
const DashboardDirector = lazy(() => import('./pages/director/DashboardDirector'))
const AgendasPorRevisar = lazy(() => import('./pages/director/AgendasPorRevisar'))
const DetalleAgenda = lazy(() => import('./pages/director/DetalleAgenda'))
const RevisionSemana = lazy(() => import('./pages/director/RevisionSemana'))
const DashboardRevision = lazy(() => import('./pages/revision/DashboardRevision'))
const AvancesRevision = lazy(() => import('./pages/revision/AvancesRevision'))
const ReportesDirector = lazy(() => import('./pages/director/ReportesDirector'))
const ObservacionesDirector = lazy(() => import('./pages/director/ObservacionesDirector'))
const DashboardDocente = lazy(() => import('./pages/docente/Dashboard'))
const AgendaDocente = lazy(() => import('./pages/docente/Agenda'))
const AvanceSemana = lazy(() => import('./pages/docente/AvanceSemana'))
const Evidencias = lazy(() => import('./pages/docente/Evidencias'))
const Perfil = lazy(() => import('./pages/common/Perfil'))
const Configuracion = lazy(() => import('./pages/common/Configuracion'))
const Analitica = lazy(() => import('./pages/common/Analitica'))

// Consultor Pages
const DashboardConsultor = lazy(() => import('./pages/consultor/DashboardConsultor'))
const DetalleAgendaConsultor = lazy(() => import('./pages/consultor/DetalleAgendaConsultor'))
const ObservacionesConsultor = lazy(() => import('./pages/consultor/ObservacionesConsultor'))



// Mientras se descarga el código de la página que se visita
const CargandoPagina = () => (
  <div role="status" aria-live="polite" className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="animate-spin w-9 h-9 border-4 border-blue-500 border-t-transparent rounded-full" />
    <span className="sr-only">Cargando…</span>
  </div>
)

function App() {
  const { showTimeoutModal, timeoutSeconds, extendSession, logout } = useAuth();

  return (
    <>
      {/* Modal de sesión por expirar — visible en cualquier página */}
      {showTimeoutModal && (
        <SessionTimeoutModal
          secondsRemaining={timeoutSeconds}
          onStayLoggedIn={extendSession}
          onLogout={logout}
        />
      )}

      <Suspense fallback={<CargandoPagina />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/role-selection" element={<RoleSelection />} />
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Planeación */}
        <Route element={<ProtectedRoute allowedRoles={['Planeacion', 'Admin']} />}>
          <Route path="/planeacion/dashboard" element={<DashboardPlaneacion />} />
          <Route path="/planeacion/docentes" element={<Docentes />} />
          <Route path="/planeacion/periodos" element={<Periodos />} />
          <Route path="/planeacion/semanas" element={<Semanas />} />
          <Route path="/planeacion/parametros" element={<ParametrosGenerales />} />
          <Route path="/planeacion/facultades" element={<Facultades />} />
          <Route path="/planeacion/programas" element={<Programas />} />
          <Route path="/planeacion/perfiles" element={<GestionPerfiles />} />
          <Route path="/planeacion/permisos" element={<GestionPerfiles />} />
          <Route path="/planeacion/notificaciones" element={<Notificaciones />} />
          <Route path="/planeacion/analitica" element={<Analitica rol="planeacion" />} />
        </Route>

        {/* Director */}
        <Route element={<ProtectedRoute allowedRoles={['Director']} />}>
          <Route path="/director/dashboard" element={<DashboardDirector />} />
          <Route path="/director/agendas" element={<AgendasPorRevisar />} />
          <Route path="/director/agendas/:id" element={<DetalleAgenda />} />
          <Route path="/director/agendas/:id/semana/:semana" element={<RevisionSemana />} />
          <Route path="/director/reportes" element={<ReportesDirector />} />
          <Route path="/director/observaciones" element={<ObservacionesDirector />} />
          <Route path="/director/analitica" element={<Analitica rol="director" />} />
        </Route>

        {/* Docente */}
        <Route element={<ProtectedRoute allowedRoles={['Docente']} />}>
          <Route path="/docente/dashboard" element={<DashboardDocente />} />
          <Route path="/docente/agenda" element={<AgendaDocente />} />
          <Route path="/docente/avance-semana-8" element={<AvanceSemana semana="8" />} />
          <Route path="/docente/avance-semana-16" element={<AvanceSemana semana="16" />} />
          <Route path="/docente/evidencias" element={<Evidencias />} />
        </Route>

        {/* Revisores de una función sustantiva (Investigación y los que se
            creen después). No se listan por nombre: ProtectedRoute deja pasar
            a cualquier rol con funciones asignadas en rol_funcion. */}
        <Route element={<ProtectedRoute requiereRevisionFuncion />}>
          <Route path="/revision/dashboard" element={<DashboardRevision />} />
          <Route path="/revision/semanas" element={<AvancesRevision />} />
          <Route path="/revision/semanas/:semana" element={<AvancesRevision />} />
          <Route path="/revision/semanas/:semana/docente/:id" element={<RevisionSemana modulo="revision" />} />
          <Route path="/revision/agendas/:id" element={<DetalleAgenda modulo="revision" />} />
        </Route>

        {/* Consultor */}
        <Route element={<ProtectedRoute allowedRoles={['Consultor']} />}>
          <Route path="/consultor/dashboard" element={<DashboardConsultor />} />
          <Route path="/consultor/agendas/:id" element={<DetalleAgendaConsultor />} />
          <Route path="/consultor/observaciones" element={<ObservacionesConsultor />} />
          <Route path="/consultor/analitica" element={<Analitica rol="consultor" />} />
        </Route>


        {/* Comunes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/perfil" element={<Perfil />} />
          <Route path="/configuracion" element={<Configuracion />} />
        </Route>
      </Routes>
      </Suspense>
    </>
  )
}

export default App