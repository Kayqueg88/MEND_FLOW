import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { useAuth } from '../../app/auth-context'
import { supabase } from '../../lib/supabase'
import { criarFilaAnexos, enviarLoteAnexos, validarArquivos, type TipoAnexo } from '../../lib/anexos'
import { criarOperacaoEvento, salvarEvento } from '../../lib/criar-evento'

type Tecnico = {
  id: string
  nome: string
  email: string
}


export function NovoEvento() {
  const navigate = useNavigate()
  const { usuario } = useAuth()

  const [tecnicos, setTecnicos] = useState<Tecnico[]>([])
  const [tecnicosSelecionados, setTecnicosSelecionados] = useState<string[]>([])

  const [clienteNome, setClienteNome] = useState('')
  const [clienteContato, setClienteContato] = useState('')
  const [endereco, setEndereco] = useState('')
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [possuiGrade, setPossuiGrade] = useState(false)

  const [arquivosMatriz, setArquivosMatriz] = useState<File[]>([])
  const [arquivosGrade, setArquivosGrade] = useState<File[]>([])
  const [arquivosTermo, setArquivosTermo] = useState<File[]>([])

  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  const operacao = useRef<ReturnType<typeof criarOperacaoEvento> | null>(null)
  const fila = useRef(criarFilaAnexos())
  const emCurso = useRef(false)
  const montado = useRef(false)
  const [iniciada, setIniciada] = useState(false)

  useEffect(() => {
    let ativo = true
    montado.current = true
    const controller = new AbortController()
    async function carregarTecnicos() {
      try {
        const { data, error } = await supabase
          .from('usuarios')
          .select('id, nome, email')
          .eq('perfil', 'tecnico')
          .order('nome')
          .abortSignal(controller.signal)

        if (!ativo) return
        if (error) {
          setErro('Não foi possível carregar os técnicos. Recarregue a página antes de criar o evento.')
          return
        }

        setTecnicos(data ?? [])
      } catch {
        if (ativo) setErro('Não foi possível carregar os técnicos. Recarregue a página antes de criar o evento.')
      }
    }

    carregarTecnicos()
    return () => { ativo = false; montado.current = false; controller.abort() }
  }, [])

  function alternarTecnico(tecnicoId: string) {
    setTecnicosSelecionados((atuais) => {
      if (atuais.includes(tecnicoId)) {
        return atuais.filter((id) => id !== tecnicoId)
      }

      return [...atuais, tecnicoId]
    })
  }

  async function enviarArquivos(eventoId: string, tipo: TipoAnexo, arquivos: File[]) {
    if (!usuario) throw new Error('Usuário não encontrado.')
    await enviarLoteAnexos(fila.current, eventoId, tipo, arquivos, usuario.id, () => {}, () => montado.current)
  }

  async function criarEvento(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (emCurso.current) return

    if (!usuario) {
      setErro('Usuário não encontrado.')
      return
    }

    if (!clienteNome.trim() || !endereco.trim()) {
      setErro('Informe nome do cliente e endereço válidos.')
      return
    }

    if (tecnicosSelecionados.length === 0) {
      setErro('Selecione pelo menos um técnico.')
      return
    }

    if (!inicio || !fim) {
      setErro('Informe o início e o fim do evento.')
      return
    }

    if (!Number.isFinite(Date.parse(inicio)) || !Number.isFinite(Date.parse(fim)) || new Date(fim) <= new Date(inicio)) {
      setErro('O término deve ser posterior ao início.')
      return
    }

    try { validarArquivos([...arquivosMatriz, ...arquivosGrade, ...arquivosTermo]) }
    catch (e) { setErro(e instanceof Error ? e.message : 'Arquivos inválidos.'); return }

    emCurso.current = true
    setCarregando(true)
    setErro('')

    try {
      operacao.current ??= criarOperacaoEvento()
      setIniciada(true)
      const eventoId = await salvarEvento(operacao.current, {
        cliente_nome: clienteNome.trim(), cliente_contato: clienteContato.trim() || null,
        endereco: endereco.trim(), inicio: new Date(inicio).toISOString(), fim: new Date(fim).toISOString(),
        observacoes: observacoes.trim() || null, possui_grade: possuiGrade, criado_por: usuario.id,
      }, tecnicosSelecionados)
      if (!montado.current) return

      // 3. Envia anexos
      await enviarArquivos(
        eventoId,
        'matriz',
        arquivosMatriz
      )

      await enviarArquivos(
        eventoId,
        'grade',
        arquivosGrade
      )

      await enviarArquivos(
        eventoId,
        'termo_locacao',
        arquivosTermo
      )

      // 4. Abre o evento criado
      if (montado.current) navigate(`/eventos/${eventoId}`)
    } catch (error) {
      console.error(error)

      if (operacao.current?.rejeitada) {
        operacao.current = null
        if (montado.current) setIniciada(false)
      }

      if (montado.current) setErro(
        error instanceof Error
          ? error.message
          : 'Não foi possível concluir a criação do evento.'
      )

    } finally {
      emCurso.current = false
      if (montado.current) setCarregando(false)
    }
  }

  return (
    <div>
      <Link to="/">
        Voltar para Home
      </Link>

      <h1>Criar Evento</h1>

      {iniciada && <p role="status">Operação iniciada. Use o botão abaixo para concluir as etapas pendentes sem criar outro evento. Não feche esta tela durante a recuperação.</p>}
      <form onSubmit={criarEvento}>
        <fieldset disabled={carregando || iniciada}>
        <section>
          <h2>Dados do evento</h2>

          <div>
            <label htmlFor="clienteNome">
              Nome do cliente
            </label>

            <input
              id="clienteNome"
              type="text"
              value={clienteNome}
              onChange={(event) =>
                setClienteNome(event.target.value)
              }
              maxLength={300}
              required
            />
          </div>

          <div>
            <label htmlFor="clienteContato">
              Contato do cliente
            </label>

            <input
              id="clienteContato"
              type="text"
              value={clienteContato}
              onChange={(event) =>
                setClienteContato(event.target.value)
              }
            />
          </div>

          <div>
            <label htmlFor="endereco">
              Endereço
            </label>

            <input
              id="endereco"
              type="text"
              value={endereco}
              onChange={(event) =>
                setEndereco(event.target.value)
              }
              maxLength={300}
              required
            />
          </div>

          <div>
            <label htmlFor="inicio">
              Início previsto
            </label>

            <input
              id="inicio"
              type="datetime-local"
              value={inicio}
              onChange={(event) =>
                setInicio(event.target.value)
              }
              required
            />
          </div>

          <div>
            <label htmlFor="fim">
              Fim previsto
            </label>

            <input
              id="fim"
              type="datetime-local"
              value={fim}
              onChange={(event) =>
                setFim(event.target.value)
              }
              required
            />
          </div>

          <div>
            <label>
              <input
                type="checkbox"
                checked={possuiGrade}
                onChange={(event) =>
                  setPossuiGrade(event.target.checked)
                }
              />

              Possui grade
            </label>
          </div>

          <div>
            <label htmlFor="observacoes">
              Observações
            </label>

            <textarea
              id="observacoes"
              value={observacoes}
              onChange={(event) =>
                setObservacoes(event.target.value)
              }
            />
          </div>
        </section>

        <hr />

        <section>
          <h2>Técnicos disponiveis</h2>

          {tecnicos.length === 0 ? (
            <p>Nenhum técnico cadastrado.</p>
          ) : (
            tecnicos.map((tecnico) => (
              <div key={tecnico.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={tecnicosSelecionados.includes(
                      tecnico.id
                    )}
                    onChange={() =>
                      alternarTecnico(tecnico.id)
                    }
                  />

                  {tecnico.nome} - {tecnico.email}
                </label>
              </div>
            ))
          )}
        </section>

        <hr />

        <section>
          <h2>Anexos</h2>

          <p>
            Os anexos são opcionais e também poderão ser adicionados
            posteriormente.
          </p>
          <p>Até 20 arquivos no total, com no máximo 20 MB cada.</p>

          <div>
            <label htmlFor="matriz">
              Matriz
            </label>

            <input
              id="matriz"
              type="file"
              multiple
              onChange={(event) =>
                setArquivosMatriz(
                  event.target.files
                    ? Array.from(event.target.files)
                    : []
                )
              }
            />

            {arquivosMatriz.length > 0 && (
              <ul>
                {arquivosMatriz.map((arquivo) => (
                  <li
                    key={`${arquivo.name}-${arquivo.lastModified}`}
                  >
                    {arquivo.name}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <label htmlFor="grade">
              Grade
            </label>

            <input
              id="grade"
              type="file"
              multiple
              onChange={(event) =>
                setArquivosGrade(
                  event.target.files
                    ? Array.from(event.target.files)
                    : []
                )
              }
            />

            {arquivosGrade.length > 0 && (
              <ul>
                {arquivosGrade.map((arquivo) => (
                  <li
                    key={`${arquivo.name}-${arquivo.lastModified}`}
                  >
                    {arquivo.name}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <label htmlFor="termoLocacao">
              Termo de locação
            </label>

            <input
              id="termoLocacao"
              type="file"
              multiple
              onChange={(event) =>
                setArquivosTermo(
                  event.target.files
                    ? Array.from(event.target.files)
                    : []
                )
              }
            />

            {arquivosTermo.length > 0 && (
              <ul>
                {arquivosTermo.map((arquivo) => (
                  <li
                    key={`${arquivo.name}-${arquivo.lastModified}`}
                  >
                    {arquivo.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <hr />

        </fieldset>

        {erro && (
          <p>{erro}</p>
        )}

        <button
          type="submit"
          disabled={carregando}
        >
          {carregando
            ? 'Criando evento...'
            : 'Criar evento'}
        </button>
      </form>
    </div>
  )
}
