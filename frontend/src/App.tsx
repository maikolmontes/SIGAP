import { Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from './components/common/ProtectedRoute'
import Login from './pages/auth/Login'
import RoleSelection from './pages/auth/RoleSelection'
import DashboardPlaneacion from './pages/planeacion/DashboardPlaneacion'
import Docentes from './pages/planeacion/Docentes'
import Periodos from './pages/planeacion/Periodos'
import DashboardDirector from './pages/director/DashboardDirector'
import DashboardDocente from './pages/docente/Dashboard'
import AgendaDocente from './pages/docente/Agenda'
import Perfil from './pages/common/Perfil'
import Configuracion from './pages/common/Configuracion'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/role-selection" element={<RoleSelection />} />
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* Planeación */}
      <Route element={<ProtectedRoute allowedRoles={['Planeacion', 'Admin']} />}>
        <Route path="/planeacion/dashboard" element={<DashboardPlaneacion />} />
        <Route path="/planeacion/docentes" element={<Docentes />} />
        <Route path="/planeacion/periodos" element={<Periodos />} /> {/* 👈 TU APORTE */}
      </Route>

      {/* Director */}
      <Route element={<ProtectedRoute allowedRoles={['Director']} />}>
        <Route path="/director/dashboard" element={<DashboardDirector />} />
      </Route>

      {/* Docente */}
      <Route element={<ProtectedRoute allowedRoles={['Docente']} />}>
        <Route path="/docente/dashboard" element={<DashboardDocente />} />
        <Route path="/docente/agenda" element={<AgendaDocente />} />
      </Route>

      {/* Comunes */}
      <Route element={<ProtectedRoute />}>
        <Route path="/perfil" element={<Perfil />} />
        <Route path="/configuracion" element={<Configuracion />} />
      </Route>
    </Routes>
  )
}

export default App