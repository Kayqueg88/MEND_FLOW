import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { AppLayout } from './app/AppLayout'
import { ProtectedRoute } from './app/ProtectedRoute'
import { Login } from './features/auth/login'
import { Perfil } from './features/auth/Perfil'
import { Home } from './features/eventos/Home'
import { Eventos } from './features/eventos/Eventos'
import { Historico } from './features/eventos/Historico'
import { Recebimentos } from './features/eventos/Recebimentos'

const DetalheEvento = lazy(() => import('./features/eventos/DetalheEvento').then(m => ({ default: m.DetalheEvento })))
const NovoEvento = lazy(() => import('./features/eventos/NovoEvento').then(m => ({ default: m.NovoEvento })))

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={
          <ProtectedRoute perfisPermitidos={['tecnico', 'coordenador', 'estoque']}>
            <AppLayout>
              <Suspense fallback={<p>Carregando página...</p>}><Outlet /></Suspense>
            </AppLayout>
          </ProtectedRoute>
        }>
          <Route index element={<Home />} />
          <Route path="eventos" element={<Eventos />} />
          <Route path="eventos/:id" element={<DetalheEvento />} />
          <Route path="historico" element={<Historico />} />
          <Route path="perfil" element={<Perfil />} />
          <Route element={<ProtectedRoute perfisPermitidos={['coordenador']}><Outlet /></ProtectedRoute>}>
            <Route path="coordenador/novo-evento" element={<NovoEvento />} />
            <Route path="avisos" element={<div><h1>Avisos</h1><p>Esta funcionalidade está em desenvolvimento.</p></div>} />
          </Route>
          <Route path="recebimentos" element={
            <ProtectedRoute perfisPermitidos={['estoque']}><Recebimentos /></ProtectedRoute>
          } />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
