import type { Evento as DadosEvento } from './tipos-evento'
import { traduzirStatus } from './formatacao-evento'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../../app/auth-context'
import { supabase } from '../../lib/supabase'

type Evento = Pick<DadosEvento, 'id' | 'cliente_nome' | 'cliente_contato' | 'endereco' | 'inicio' | 'fim' | 'possui_grade' | 'status'>

type FiltroEventos = 'todos' | 'para_fazer' | 'concluidos'

export function Eventos({ historico = false }: { historico?: boolean } = {}) {
  const { usuario } = useAuth()

  const [eventos, setEventos] = useState<Evento[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [{ pagina, filtro }, setConsulta] = useState<{ pagina: number; filtro: FiltroEventos }>(
    () => ({ pagina: 0, filtro: historico ? 'concluidos' : 'todos' }),
  )
  const [temProxima, setTemProxima] = useState(false)
  const [tentativa, setTentativa] = useState(0)
  const tamanhoPagina = 25

  useEffect(() => {
    let ativo = true
    const controller = new AbortController()
    async function carregarEventos() {
      await Promise.resolve()
      if (!ativo) return
      setCarregando(true)
      setErro('')
      setEventos([])
      setTemProxima(false)
      try {
        if (!usuario) return
        const campos = 'id, cliente_nome, cliente_contato, endereco, inicio, fim, possui_grade, status'
        let consulta = supabase.from('eventos').select(usuario.perfil === 'tecnico'
          ? `${campos}, eventos_tecnicos!inner(tecnico_id)` : campos)
        if (usuario.perfil === 'tecnico') consulta = consulta.eq('eventos_tecnicos.tecnico_id', usuario.id)
        if (filtro !== 'todos') consulta = consulta.in('status', filtro === 'para_fazer'
          ? ['agendado', 'em_andamento'] : ['finalizado', 'recebido'])
        const { data, error } = await consulta.order('inicio', { ascending: !historico || filtro === 'para_fazer' })
          .order('id', { ascending: true })
          .range(pagina * tamanhoPagina, pagina * tamanhoPagina + tamanhoPagina)
          .abortSignal(controller.signal)
        if (!ativo) return
        if (error) throw error
        const registros = (data ?? []) as unknown as Evento[]
        setEventos(registros.slice(0, tamanhoPagina))
        setTemProxima(registros.length > tamanhoPagina)
      } catch {
        if (ativo) setErro('Não foi possível carregar os eventos.')
      } finally {
        if (ativo) setCarregando(false)
      }
    }
    void carregarEventos()
    return () => { ativo = false; controller.abort() }
  }, [pagina, filtro, tentativa, usuario, historico])

  return (
    <div>
      <header>
        <Link to="/">
          Voltar para Home
        </Link>

        <h1>
          {historico ? 'Histórico de eventos' : usuario?.perfil === 'tecnico'
            ? 'Meus eventos'
            : 'Eventos'}
        </h1>

        <p>
          Usuário: {usuario?.nome}
        </p>
        <Link to={historico ? '/eventos' : '/historico'}>
          {historico ? 'Ver agenda de eventos' : 'Ver histórico de eventos'}
        </Link>
      </header>

      <hr />

      <main>
        <label>
          Filtrar eventos:{' '}
          <select value={filtro} onChange={event => {
            const valor = event.target.value
            if (valor !== filtro && (valor === 'todos' || valor === 'para_fazer' || valor === 'concluidos')) {
              setCarregando(true)
              setConsulta({ pagina: 0, filtro: valor })
            }
          }}>
            <option value="todos">Todos os eventos</option>
            <option value="para_fazer">Eventos para fazer</option>
            <option value="concluidos">Eventos concluídos</option>
          </select>
        </label>
        <p>{filtro === 'para_fazer' ? 'Eventos agendados e em andamento.'
          : filtro === 'concluidos' ? 'Eventos finalizados e recebidos pelo estoque.'
            : 'Eventos de todos os status.'}</p>
        {carregando && (
          <p>Carregando eventos...</p>
        )}

        {erro && (
          <div role="alert"><p>{erro}</p><button onClick={() => setTentativa(v => v + 1)}>Tentar novamente</button></div>
        )}

        {!carregando && !erro && eventos.length === 0 && (
          <p>Nenhum evento encontrado.</p>
        )}

        {!carregando && !erro && eventos.length > 0 && (
          <div>
            {eventos.map((evento) => (
              <article key={evento.id}>
                <h2>{evento.cliente_nome}</h2>

                <p>
                  <strong>Status:</strong>{' '}
                  {traduzirStatus(evento.status)}
                </p>

                <p>
                  <strong>Endereço:</strong>{' '}
                  {evento.endereco}
                </p>

                <p>
                  <strong>Início previsto:</strong>{' '}
                  {new Date(evento.inicio).toLocaleString('pt-BR')}
                </p>

                <p>
                  <strong>Fim previsto:</strong>{' '}
                  {new Date(evento.fim).toLocaleString('pt-BR')}
                </p>

                <p>
                  <strong>Grade:</strong>{' '}
                  {evento.possui_grade ? 'Sim' : 'Não'}
                </p>

                {evento.cliente_contato && (
                  <p>
                    <strong>Contato:</strong>{' '}
                    {evento.cliente_contato}
                  </p>
                )}

                <Link to={`/eventos/${evento.id}`}>
                  Ver evento
                </Link>

                <hr />
              </article>
            ))}
          </div>
        )}
        {!carregando && !erro && <nav aria-label="Paginação de eventos">
          <button type="button" disabled={pagina === 0} onClick={() => setConsulta(atual => ({ ...atual, pagina: Math.max(0, atual.pagina - 1) }))}>Anterior</button>
          <span> Página {pagina + 1} </span>
          <button type="button" disabled={!temProxima} onClick={() => setConsulta(atual => ({ ...atual, pagina: atual.pagina + 1 }))}>Próxima</button>
        </nav>}
      </main>
    </div>
  )
}
