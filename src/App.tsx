import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom'

import { ProtectedRoute } from './app/ProtectedRoute'

import { Login } from './features/auth/login'
import { Perfil } from './features/auth/Perfil'

import { Home } from './features/eventos/Home'
import { Eventos } from './features/eventos/Eventos'
import { NovoEvento } from './features/eventos/NovoEvento'
import { Historico } from './features/eventos/Historico'
import { Recebimentos } from './features/eventos/Recebimentos'

function App() {
  return (
    <BrowserRouter>
      <Routes>
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
              perfisPermitidos={['tecnico']}
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

        <Route
          path="*"
          element={<Navigate to="/" replace />}
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App