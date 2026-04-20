import { Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from './components/common/ProtectedRoute'
import Login from './pages/auth/Login'
import DashboardPlaneacion from './pages/planeacion/DashboardPlaneacion'
import Docentes from './pages/planeacion/Docentes'
import DashboardDirector from './pages/director/DashboardDirector'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Navigate to="/planeacion/dashboard" replace />} />

      {/* Rutas Protegidas */}
      <Route element={<ProtectedRoute />}>
        <Route path="/planeacion/dashboard" element={<DashboardPlaneacion />} />
        <Route path="/planeacion/docentes" element={<Docentes />} />
        <Route path="/director/dashboard" element={<DashboardDirector />} />
      </Route>
    </Routes>
  )
}

export default App