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
    <div className="login-page">
      <aside className="login-intro" aria-label="MEND Eventos">
        <div className="login-intro__brand">MEND<span>EVENTOS</span></div>
        <div className="login-intro__message">
          <span className="login-intro__label">Gestão de eventos</span>
          <h2>Cada evento.<br />Todos os detalhes.</h2>
          <p>Da preparação à devolução, acompanhe o seu trabalho em um só lugar.</p>
        </div>
        <div className="login-intro__footer"><span aria-hidden="true" />Conexão entre equipe e operação</div>
      </aside>
      <section className="login-panel" aria-labelledby="login-titulo">
      <div className="login-panel__content">
      <div className="login-brand">MEND<span>EVENTOS</span></div>
      <header className="login-heading">
        <span className="login-intro__label">Área da equipe</span>
        <h1 id="login-titulo">Bem-vindo de volta.</h1>
        <p>Entre com sua conta para acessar os eventos.</p>
      </header>

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
            placeholder="seu.email@empresa.com"
            disabled={entrando || carregando}
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
            placeholder="Digite sua senha"
            disabled={entrando || carregando}
          />
        </div>

        <button
          type="submit"
          disabled={entrando || carregando}
        >
          {entrando || carregando
            ? 'Entrando...'
            : 'Entrar'}
          <span aria-hidden="true"> →</span>
        </button>
      </form>

      {mensagem && <p role="alert">{mensagem}</p>}
      {erroPerfil && <div role="alert"><p>{erroPerfil}</p>
        <button type="button" disabled={carregando} onClick={tentarNovamente}>Tentar carregar novamente</button>
      </div>}
      <p className="login-help">Precisa de acesso? Fale com o coordenador da sua equipe.</p>
      </div>
      <footer className="login-panel__footer">MEND · Gestão de eventos</footer>
      </section>
    </div>
  )
}
