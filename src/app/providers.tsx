import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

type PerfilUsuario = 'tecnico' | 'coordenador' | 'estoque'

type UsuarioAplicacao = {
  id: string
  nome: string
  email: string
  perfil: PerfilUsuario
}

type AuthContextType = {
  session: Session | null
  usuario: UsuarioAplicacao | null
  carregando: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [usuario, setUsuario] = useState<UsuarioAplicacao | null>(null)
  const [carregando, setCarregando] = useState(true)

  async function carregarUsuario(userId: string) {
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, nome, email, perfil')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Erro ao carregar perfil:', error)
      setUsuario(null)
      return
    }

    setUsuario(data)
  }

  useEffect(() => {
    let ativo = true

    async function recuperarSessao() {
      setCarregando(true)

      const { data, error } = await supabase.auth.getSession()

      if (!ativo) return

      if (error) {
        console.error('Erro ao recuperar sessão:', error)
        setSession(null)
        setUsuario(null)
        setCarregando(false)
        return
      }

      setSession(data.session)

      if (data.session?.user) {
        await carregarUsuario(data.session.user.id)
      } else {
        setUsuario(null)
      }

      if (ativo) {
        setCarregando(false)
      }
    }

    recuperarSessao()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, novaSession) => {
      setCarregando(true)
      setSession(novaSession)

      if (novaSession?.user) {
        carregarUsuario(novaSession.user.id).finally(() => {
          if (ativo) {
            setCarregando(false)
          }
        })
      } else {
        setUsuario(null)
        setCarregando(false)
      }
    })

    return () => {
      ativo = false
      subscription.unsubscribe()
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{
        session,
        usuario,
        carregando,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth deve ser usado dentro do AuthProvider')
  }

  return context
}