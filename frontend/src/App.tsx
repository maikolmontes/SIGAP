import { Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from './components/common/ProtectedRoute'
import Login from './pages/auth/Login'
import RoleSelection from './pages/auth/RoleSelection'
import DashboardPlaneacion from './pages/planeacion/DashboardPlaneacion'
import Docentes from './pages/planeacion/Docentes'
import DashboardDirector from './pages/director/DashboardDirector'
import DashboardDocente from './pages/docente/Dashboard'
import Perfil from './pages/common/Perfil'
import Configuracion from './pages/common/Configuracion'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/role-selection" element={<RoleSelection />} />
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* Rutas Protegidas - Planeación */}
      <Route element={<ProtectedRoute allowedRoles={['Planeacion', 'Admin']} />}>
        <Route path="/planeacion/dashboard" element={<DashboardPlaneacion />} />
        <Route path="/planeacion/docentes" element={<Docentes />} />
      </Route>

      {/* Rutas Protegidas - Director */}
      <Route element={<ProtectedRoute allowedRoles={['Director']} />}>
        <Route path="/director/dashboard" element={<DashboardDirector />} />
      </Route>

      {/* Rutas Protegidas - Docente */}
      <Route element={<ProtectedRoute allowedRoles={['Docente']} />}>
        <Route path="/docente/dashboard" element={<DashboardDocente />} />
      </Route>

      {/* Rutas Comunes (cualquier usuario autenticado) */}
      <Route element={<ProtectedRoute />}>
        <Route path="/perfil" element={<Perfil />} />
        <Route path="/configuracion" element={<Configuracion />} />
      </Route>
    </Routes>
  )
}

export default App