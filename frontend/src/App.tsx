import { Routes, Route, Navigate } from 'react-router-dom'
import DashboardPlaneacion from './pages/planeacion/DashboardPlaneacion'
import Docentes from './pages/planeacion/Docentes'
import DashboardDirector from './pages/director/DashboardDirector'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/planeacion/dashboard" replace />} />
      <Route path="/planeacion/dashboard" element={<DashboardPlaneacion />} />
      <Route path="/planeacion/docentes" element={<Docentes />} />
      <Route path="/director/dashboard" element={<DashboardDirector />} />
    </Routes>
  )
}

export default App