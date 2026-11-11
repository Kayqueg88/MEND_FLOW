import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { AuthContext, type UsuarioAplicacao } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [usuario, setUsuario] = useState<UsuarioAplicacao | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erroPerfil, setErroPerfil] = useState('')
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    let ativo = true
    let versao = 0
    let usuarioAtual: UsuarioAplicacao | null = null
    let sessaoAtual: Session | null = null
    let consultaId: string | null = null
    let recebeuEvento = false

    async function aplicarSessao(nova: Session | null) {
      if (!ativo) return
      sessaoAtual = nova
      setSession(nova)
      const id = nova?.user.id
      if (id && (usuarioAtual?.id === id || consultaId === id)) return
      const atual = ++versao
      usuarioAtual = null
      consultaId = id ?? null
      setUsuario(null)
      setErroPerfil('')
      setCarregando(Boolean(id))
      if (!id) return
      try {
        const { data, error } = await supabase.from('usuarios')
          .select('id, nome, email, perfil').eq('id', id).single()
        if (!ativo || atual !== versao || sessaoAtual?.user.id !== id) return
        if (error || !data || !['tecnico', 'coordenador', 'estoque'].includes(data.perfil)) {
          throw new Error('Perfil indisponível')
        }
        usuarioAtual = data
        setUsuario(data)
      } catch {
        if (ativo && atual === versao) {
          setErroPerfil('Sua sessão foi autenticada, mas não foi possível carregar seu perfil. Tente novamente ou solicite a verificação do cadastro e das permissões.')
        }
      } finally {
        if (ativo && atual === versao) {
          consultaId = null
          setCarregando(false)
        }
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nova) => {
      recebeuEvento = true
      void Promise.resolve().then(() => { if (ativo) void aplicarSessao(nova) })
    })
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!ativo || recebeuEvento) return
      if (error) throw error
      return aplicarSessao(data.session)
    }).catch(() => {
      if (!ativo || recebeuEvento) return
      setSession(null)
      setUsuario(null)
      setErroPerfil('Não foi possível recuperar sua sessão. Tente novamente.')
      setCarregando(false)
    })
    return () => { ativo = false; ++versao; subscription.unsubscribe() }
  }, [tentativa])

  return <AuthContext.Provider value={{ session, usuario, carregando, erroPerfil,
    tentarNovamente: () => { setCarregando(true); setTentativa(v => v + 1) },
  }}>{children}</AuthContext.Provider>
}
