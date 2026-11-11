import { supabase } from './supabase'

export type TipoAnexo = 'matriz' | 'grade' | 'termo_locacao'
export const MAX_ARQUIVOS = 20
export const MAX_BYTES = 20 * 1024 * 1024

export function validarArquivos(arquivos: File[]) {
  if (arquivos.length > MAX_ARQUIVOS) throw new Error(`Selecione no máximo ${MAX_ARQUIVOS} arquivos por envio.`)
  for (const arquivo of arquivos) {
    if (!arquivo.size || arquivo.size > MAX_BYTES) {
      throw new Error(`${arquivo.name}: o arquivo deve ter entre 1 byte e 20 MB.`)
    }
  }
}

// Mantém o caminho e o ID entre tentativas enquanto o formulário está aberto.
export function criarFilaAnexos() {
  const tarefas = new Map<File, Map<string, { id: string; caminho: string; enviado: boolean; registrado: boolean }>>()
  return {
    async enviar(eventoId: string, tipo: TipoAnexo, arquivo: File, usuarioId: string) {
      validarArquivos([arquivo])
      let tipos = tarefas.get(arquivo)
      if (!tipos) { tipos = new Map(); tarefas.set(arquivo, tipos) }
      const chave = `${eventoId}/${tipo}`
      let tarefa = tipos.get(chave)
      if (!tarefa) {
        const id = crypto.randomUUID()
        const nome = arquivo.name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9._-]/g, '') || 'arquivo'
        tarefa = { id, caminho: `${chave}/${id}-${nome}`, enviado: false, registrado: false }
        tipos.set(chave, tarefa)
      }
      if (tarefa.registrado) return
      const bucket = supabase.storage.from('eventos_anexos')
      if (!tarefa.enviado) {
        const { error } = await bucket.upload(tarefa.caminho, arquivo)
        if (error) {
          // Uma resposta perdida pode ter ocorrido depois do upload efetivo.
          const { error: infoError } = await bucket.info(tarefa.caminho)
          if (infoError) throw new Error(`Erro ao enviar ${arquivo.name}. Tente novamente.`)
        }
        tarefa.enviado = true
      }
      const { error } = await supabase.from('anexos').insert({
        id: tarefa.id, evento_id: eventoId, tipo,
        arquivo_url: tarefa.caminho, enviado_por: usuarioId,
      })
      if (error) {
        const { data, error: consultaError } = await supabase.from('anexos')
          .select('id').eq('id', tarefa.id).eq('evento_id', eventoId).maybeSingle()
        if (consultaError || !data) {
          throw new Error(`O arquivo ${arquivo.name} foi enviado, mas seu registro não foi confirmado. Tente novamente nesta tela para concluir sem reenviar.`)
        }
      }
      tarefa.registrado = true
    },
  }
}

export async function enviarLoteAnexos(
  fila: ReturnType<typeof criarFilaAnexos>, eventoId: string, tipo: TipoAnexo,
  arquivos: File[], usuarioId: string, concluido: (arquivo: File) => void = () => {},
  ativo: () => boolean = () => true,
) {
  validarArquivos(arquivos)
  const erros: string[] = []
  for (let i = 0; i < arquivos.length && ativo(); i += 3) {
    const resultados = await Promise.allSettled(arquivos.slice(i, i + 3).map(async arquivo => {
      await fila.enviar(eventoId, tipo, arquivo, usuarioId)
      concluido(arquivo)
    }))
    for (const resultado of resultados) {
      if (resultado.status === 'rejected') erros.push(resultado.reason instanceof Error ? resultado.reason.message : 'Erro ao enviar arquivo.')
    }
  }
  if (erros.length) throw new Error(erros.join(' '))
}
