import { useEffect, useRef, useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from './auth-context'
import './app-shell.css'

export function AppLayout({ children }: { children: ReactNode }) {
  const { usuario } = useAuth()
  const location = useLocation()
  const [menu, setMenu] = useState<string | null>(null)
  const [saindo, setSaindo] = useState(false)
  const [erro, setErro] = useState('')
  const abrir = useRef<HTMLButtonElement>(null)
  const fechar = useRef<HTMLButtonElement>(null)
  const aberto = menu === location.key
  const perfil = usuario?.perfil
  const itens = [
    { rota: '/', nome: 'Início' },
    { rota: '/eventos', nome: perfil === 'tecnico' ? 'Meus eventos' : 'Eventos' },
    { rota: '/coordenador/novo-evento', nome: 'Criar evento', perfil: 'coordenador' },
    { rota: '/historico', nome: 'Histórico' },
    { rota: '/avisos', nome: 'Avisos', perfil: 'coordenador' },
    { rota: '/recebimentos', nome: 'Recebimentos', perfil: 'estoque' },
    { rota: '/perfil', nome: 'Perfil' },
  ]

  function fecharMenu() {
    setMenu(null)
    abrir.current?.focus()
  }

  useEffect(() => {
    if (!aberto) return
    fechar.current?.focus()
    function aoPressionar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') fecharMenu()
    }
    document.addEventListener('keydown', aoPressionar)
    return () => document.removeEventListener('keydown', aoPressionar)
  }, [aberto])

  async function sair() {
    setSaindo(true)
    setErro('')
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    } catch {
      setErro('Não foi possível sair. Tente novamente.')
    } finally {
      setSaindo(false)
    }
  }

  return (
    <div className="app-shell">
      {aberto && <div className="shell-overlay" onClick={fecharMenu} />}
      <aside id="menu-principal" className={aberto ? 'shell-sidebar is-open' : 'shell-sidebar'}>
        <div className="shell-brand">
          <strong>MEND</strong>
          <button ref={fechar} className="shell-toggle" type="button" onClick={fecharMenu}>Fechar menu</button>
        </div>
        <nav aria-label="Navegação principal">
          {itens.filter(item => !item.perfil || item.perfil === perfil).map(item => (
            <NavLink key={item.rota} to={item.rota} end={item.rota === '/'} onClick={aberto ? fecharMenu : undefined}>
              {item.nome}
            </NavLink>
          ))}
        </nav>
        <div className="shell-account">
          <strong>{usuario?.nome}</strong>
          <small>{perfil === 'tecnico' ? 'Técnico' : perfil === 'coordenador' ? 'Coordenador' : 'Estoque'}</small>
          <button type="button" onClick={sair} disabled={saindo}>{saindo ? 'Saindo…' : 'Sair'}</button>
          {erro && <p role="alert">{erro}</p>}
        </div>
      </aside>
      <div className="shell-body">
        <header className="shell-topbar">
          <button ref={abrir} className="shell-toggle" type="button" aria-controls="menu-principal" aria-expanded={aberto}
            onClick={() => setMenu(aberto ? null : location.key)}>Menu</button>
          <strong>MEND Eventos</strong>
        </header>
        <main className="shell-content">{children}</main>
      </div>
    </div>
  )
}
