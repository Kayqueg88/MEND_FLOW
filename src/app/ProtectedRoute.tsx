import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './auth-context'

type PerfilUsuario = 'tecnico' | 'coordenador' | 'estoque'

type ProtectedRouteProps = {
  children: ReactNode
  perfisPermitidos?: PerfilUsuario[]
}

export function ProtectedRoute({
  children,
  perfisPermitidos,
}: ProtectedRouteProps) {
  const { session, usuario, carregando } = useAuth()

  if (carregando) {
    return <p>Carregando...</p>
  }

  if (!session || !usuario) {
    return <Navigate to="/login" replace />
  }

  if (
    perfisPermitidos &&
    !perfisPermitidos.includes(usuario.perfil)
  ) {
    return <Navigate to="/" replace />
  }

  return children
}