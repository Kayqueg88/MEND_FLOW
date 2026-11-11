import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../../app/auth-context'
import { supabase } from '../../lib/supabase'

export function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [entrando, setEntrando] = useState(false)

  const navigate = useNavigate()

  const {
    session,
    usuario,
    carregando,
    erroPerfil,
    tentarNovamente,
  } = useAuth()

  useEffect(() => {
    if (!carregando && session && usuario) {
      navigate('/', { replace: true })
    }
  }, [carregando, session, usuario, navigate])

  async function fazerLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setEntrando(true)
    setMensagem('')

    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha })
      if (error) {
        setMensagem(error.code === 'email_not_confirmed'
          ? 'Confirme seu e-mail antes de entrar.'
          : error.status === 429
            ? 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
            : error.code === 'invalid_credentials'
              ? 'E-mail ou senha inválidos.'
              : 'Não foi possível entrar. Verifique sua conexão e tente novamente.')
      }
    } catch {
      setMensagem('Não foi possível entrar. Verifique sua conexão e tente novamente.')
    } finally {
      setEntrando(false)
    }
  }

  return (
    <div>
      <h1>Login</h1>

      <form onSubmit={fazerLogin}>
        <div>
          <label htmlFor="email">
            E-mail
          </label>

          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
        </div>

        <div>
          <label htmlFor="senha">
            Senha
          </label>

          <input
            id="senha"
            type="password"
            value={senha}
            onChange={(event) => setSenha(event.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        <button
          type="submit"
          disabled={entrando || carregando}
        >
          {entrando || carregando
            ? 'Entrando...'
            : 'Entrar'}
        </button>
      </form>

      {mensagem && <p role="alert">{mensagem}</p>}
      {erroPerfil && <div role="alert"><p>{erroPerfil}</p>
        <button type="button" disabled={carregando} onClick={tentarNovamente}>Tentar carregar novamente</button>
      </div>}
    </div>
  )
}
