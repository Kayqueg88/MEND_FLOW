import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom'
import { lazy, Suspense } from 'react'

import { ProtectedRoute } from './app/ProtectedRoute'

import { Login } from './features/auth/login'
import { Perfil } from './features/auth/Perfil'

import { Home } from './features/eventos/Home'
import { Eventos } from './features/eventos/Eventos'
const DetalheEvento = lazy(() => import('./features/eventos/DetalheEvento').then(m => ({ default: m.DetalheEvento })))
const NovoEvento = lazy(() => import('./features/eventos/NovoEvento').then(m => ({ default: m.NovoEvento })))
import { Historico } from './features/eventos/Historico'
import { Recebimentos } from './features/eventos/Recebimentos'

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<p>Carregando página...</p>}><Routes>

        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />

        <Route
          path="/eventos"
          element={
            <ProtectedRoute
              perfisPermitidos={[
                'tecnico',
                'coordenador',
                'estoque',
              ]}
            >
              <Eventos />
            </ProtectedRoute>
          }
        />

        <Route
          path="/eventos/:id"
          element={
            <ProtectedRoute
              perfisPermitidos={[
                'tecnico',
                'coordenador',
                'estoque',
              ]}
            >
              <DetalheEvento />
            </ProtectedRoute>
          }
        />

        <Route
          path="/coordenador/novo-evento"
          element={
            <ProtectedRoute
              perfisPermitidos={['coordenador']}
            >
              <NovoEvento />
            </ProtectedRoute>
          }
        />

        <Route
          path="/historico"
          element={
            <ProtectedRoute
              perfisPermitidos={['tecnico', 'coordenador', 'estoque']}
            >
              <Historico />
            </ProtectedRoute>
          }
        />

        <Route
          path="/recebimentos"
          element={
            <ProtectedRoute
              perfisPermitidos={['estoque']}
            >
              <Recebimentos />
            </ProtectedRoute>
          }
        />

        <Route
          path="/perfil"
          element={
            <ProtectedRoute
              perfisPermitidos={[
                'tecnico',
                'coordenador',
                'estoque',
              ]}
            >
              <Perfil />
            </ProtectedRoute>
          }
        />

        <Route path="/avisos" element={<ProtectedRoute perfisPermitidos={['coordenador']}>
          <div><h1>Avisos</h1><p>Esta funcionalidade está em desenvolvimento.</p><a href="/">Voltar para o início</a></div>
        </ProtectedRoute>} />

        <Route
          path="*"
          element={
            <Navigate
              to="/"
              replace
            />
          }
        />

      </Routes></Suspense>
    </BrowserRouter>
  )
}

export default App
