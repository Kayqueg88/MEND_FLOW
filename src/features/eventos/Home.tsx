import { Link } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../../app/auth-context'
import { supabase } from '../../lib/supabase'

export function Home() {
  const { usuario } = useAuth()
  const [erro, setErro] = useState('')
  const [saindo, setSaindo] = useState(false)

  async function sair() {
    setSaindo(true)
    setErro('')
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    } catch {
      setErro('Não foi possível sair. Verifique a conexão e tente novamente.')
    } finally {
      setSaindo(false)
    }
  }

  return (
    <div>
      <header>
        <h1>Sistema de Eventos</h1>

        <p>Olá, {usuario?.nome}</p>
        <p>Perfil: {usuario?.perfil}</p>

        <button onClick={sair} disabled={saindo}>
          Sair
        </button>
        {erro && <p role="alert">{erro}</p>}
      </header>

      <hr />

      <main>
        <h2>Início</h2>

        <p>Bem-vindo ao sistema de gestão de eventos.</p>

        {usuario?.perfil === 'coordenador' && (
          <nav>
            <ul>
              <li>
                <Link to="/eventos">
                  Eventos
                </Link>
              </li>

              <li>
                <Link to="/coordenador/novo-evento">
                  Criar evento
                </Link>
              </li>

              <li>
                <Link to="/avisos">
                  Avisos
                </Link>
              </li>

              <li>
                <Link to="/perfil">
                  Perfil
                </Link>
              </li>
            </ul>
          </nav>
        )}

        {usuario?.perfil === 'tecnico' && (
          <nav>
            <ul>
              <li>
                <Link to="/eventos">
                  Meus eventos
                </Link>
              </li>

              <li>
                <Link to="/historico">
                  Histórico
                </Link>
              </li>

              <li>
                <Link to="/perfil">
                  Perfil
                </Link>
              </li>
            </ul>
          </nav>
        )}

        {usuario?.perfil === 'estoque' && (
          <nav>
            <ul>
              <li>
                <Link to="/eventos">
                  Eventos
                </Link>
              </li>

              <li>
                <Link to="/recebimentos">
                  Recebimentos
                </Link>
              </li>

              <li>
                <Link to="/perfil">
                  Perfil
                </Link>
              </li>
            </ul>
          </nav>
        )}
      </main>
    </div>
  )
}
