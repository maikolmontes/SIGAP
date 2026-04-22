import { Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from './components/common/ProtectedRoute'
import Login from './pages/auth/Login'
import DashboardPlaneacion from './pages/planeacion/DashboardPlaneacion'
import Docentes from './pages/planeacion/Docentes'
import Periodos from './pages/planeacion/Periodos'
import DashboardDirector from './pages/director/DashboardDirector'
import Perfil from './pages/common/Perfil'
import Configuracion from './pages/common/Configuracion'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Navigate to="/planeacion/dashboard" replace />} />

      {/* Rutas Protegidas */}
      <Route element={<ProtectedRoute />}>
        {/* Planeación */}
        <Route path="/planeacion/dashboard" element={<DashboardPlaneacion />} />
        <Route path="/planeacion/docentes" element={<Docentes />} />
        <Route path="/planeacion/periodos" element={<Periodos />} />

        {/* Director */}
        <Route path="/director/dashboard" element={<DashboardDirector />} />

        {/* Comunes (Independiente del Rol principal) */}
        <Route path="/perfil" element={<Perfil />} />
        <Route path="/configuracion" element={<Configuracion />} />

      </Route>
    </Routes>
  )
}

export default App