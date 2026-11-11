import type { Evento as DadosEvento } from './tipos-evento'
import { formatarData, traduzirStatus } from './formatacao-evento'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../../app/auth-context'
import { supabase } from '../../lib/supabase'

type Evento = Pick<DadosEvento, 'id' | 'cliente_nome' | 'cliente_contato' | 'endereco' | 'inicio' | 'fim' | 'possui_grade' | 'status' | 'iniciado_em' | 'finalizado_em'>

type FiltroEventos = 'todos' | 'para_fazer' | 'concluidos'

function formatarDuracao(inicio: string | null, fim: string | null) {
  if (!inicio || !fim) return '—'
  const minutos = Math.floor((Date.parse(fim) - Date.parse(inicio)) / 60_000)
  if (!Number.isFinite(minutos) || minutos < 0) return '—'
  const horas = Math.floor(minutos / 60)
  const restante = minutos % 60
  return horas ? [`${horas}h`, restante && `${restante} min`].filter(Boolean).join(' ') : `${minutos} min`
}

export function Eventos({ historico = false }: { historico?: boolean } = {}) {
  const { usuario } = useAuth()

  const [eventos, setEventos] = useState<Evento[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [{ pagina, filtro, busca }, setConsulta] = useState<{ pagina: number; filtro: FiltroEventos; busca?: string }>(
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
          + (historico ? ', iniciado_em, finalizado_em' : '')
        let consulta = supabase.from('eventos').select(usuario.perfil === 'tecnico'
          ? `${campos}, eventos_tecnicos!inner(tecnico_id)` : campos)
        if (usuario.perfil === 'tecnico') consulta = consulta.eq('eventos_tecnicos.tecnico_id', usuario.id)
        if (filtro !== 'todos') consulta = consulta.in('status', filtro === 'para_fazer'
          ? ['agendado', 'em_andamento'] : ['finalizado', 'recebido'])
        if (busca) {
          const termo = busca.replace(/[\\%_*]/g, '\\$&').replace(/[\\"]/g, '\\$&')
          consulta = consulta.or('cliente_nome.ilike."%' + termo + '%",endereco.ilike."%' + termo + '%"')
        }
        if (historico && filtro === 'concluidos') {
          consulta = consulta.order('finalizado_em', { ascending: false, nullsFirst: false })
        }
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
  }, [pagina, filtro, busca, tentativa, usuario, historico])

  return (
    <section className="event-list">
      <header>
        <h1>
          {historico ? 'Histórico de eventos' : usuario?.perfil === 'tecnico'
            ? 'Meus eventos'
            : 'Eventos'}
        </h1>

      </header>

      <div className="event-toolbar">
        {historico && <form role="search" onSubmit={event => {
          event.preventDefault()
          const termo = String(new FormData(event.currentTarget).get('busca') ?? '').trim()
          setConsulta(atual => ({ ...atual, pagina: 0, busca: termo }))
        }}>
          <label>Cliente ou endereço<input type="search" name="busca" maxLength={120} /></label>
          <button type="submit">Buscar</button>
          {busca && <button type="reset" onClick={() => setConsulta(atual => ({ ...atual, pagina: 0, busca: '' }))}>Limpar</button>}
        </form>}
        <label>
          Filtrar eventos:{' '}
          <select value={filtro} onChange={event => {
            const valor = event.target.value
            if (valor !== filtro && (valor === 'todos' || valor === 'para_fazer' || valor === 'concluidos')) {
              setCarregando(true)
              setConsulta(atual => ({ ...atual, pagina: 0, filtro: valor }))
            }
          }}>
            <option value="todos">Todos os eventos</option>
            <option value="para_fazer">Eventos para fazer</option>
            <option value="concluidos">Eventos concluídos</option>
          </select>
        </label>
      </div>
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
          <div className="event-grid">
            {eventos.map((evento) => (
              <article className="event-card" key={evento.id}>
                <h2>{evento.cliente_nome}</h2>

                <p>
                  <span className="event-status">{traduzirStatus(evento.status)}</span>
                </p>

                <p>
                  <strong>Endereço:</strong>{' '}
                  {evento.endereco}
                </p>

                {historico && (evento.status === 'finalizado' || evento.status === 'recebido') ? (
                  <dl className="event-execution">
                    <div><dt>Início real</dt><dd>{evento.iniciado_em ? formatarData(evento.iniciado_em) : '—'}</dd></div>
                    <div><dt>Fim real</dt><dd>{evento.finalizado_em ? formatarData(evento.finalizado_em) : '—'}</dd></div>
                    <div><dt>Duração real</dt><dd>{formatarDuracao(evento.iniciado_em, evento.finalizado_em)}</dd></div>
                  </dl>
                ) : <>
                <p>
                  <strong>Início previsto:</strong>{' '}
                  {formatarData(evento.inicio)}
                </p>

                <p>
                  <strong>Fim previsto:</strong>{' '}
                  {formatarData(evento.fim)}
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
                </>}

                <Link to={`/eventos/${evento.id}`}>
                  Ver evento
                </Link>

              </article>
            ))}
          </div>
        )}
        {!carregando && !erro && (pagina > 0 || temProxima) && <nav className="event-pagination" aria-label="Paginação de eventos">
          <button type="button" disabled={pagina === 0} onClick={() => setConsulta(atual => ({ ...atual, pagina: Math.max(0, atual.pagina - 1) }))}>Anterior</button>
          <span> Página {pagina + 1} </span>
          <button type="button" disabled={!temProxima} onClick={() => setConsulta(atual => ({ ...atual, pagina: atual.pagina + 1 }))}>Próxima</button>
        </nav>}
    </section>
  )
}
