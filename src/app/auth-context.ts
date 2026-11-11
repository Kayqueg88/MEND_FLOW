import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'

export type PerfilUsuario = 'tecnico' | 'coordenador' | 'estoque'
export type UsuarioAplicacao = { id: string; nome: string; email: string; perfil: PerfilUsuario }
export type AuthContextType = {
  session: Session | null
  usuario: UsuarioAplicacao | null
  carregando: boolean
  erroPerfil: string
  tentarNovamente: () => void
}
export const AuthContext = createContext<AuthContextType | undefined>(undefined)
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth deve ser usado dentro do AuthProvider')
  return context
}
