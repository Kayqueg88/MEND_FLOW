import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../../app/providers'
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

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    })

    if (error) {
      setMensagem('E-mail ou senha inválidos.')
      setEntrando(false)
      return
    }

    /*
      Não fazemos navigate('/') aqui.

      Agora esperamos o AuthProvider confirmar:
      1. a sessão;
      2. o usuário;
      3. o perfil.
    */

    setEntrando(false)
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

      {mensagem && <p>{mensagem}</p>}
    </div>
  )
}