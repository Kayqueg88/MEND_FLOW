import { supabase } from './supabase'

export type DadosEvento = {
  cliente_nome: string; cliente_contato: string | null; endereco: string
  inicio: string; fim: string; observacoes: string | null; possui_grade: boolean; criado_por: string
}
export function criarOperacaoEvento() {
  return { id: crypto.randomUUID(), criado: false, rejeitada: false }
}

export async function salvarEvento(operacao: ReturnType<typeof criarOperacaoEvento>, dados: DadosEvento, tecnicos: string[]) {
  if (operacao.criado) return operacao.id
  operacao.rejeitada = false
  const { data, error } = await supabase.rpc('criar_evento_com_tecnicos', {
    p_evento_id: operacao.id,
    p_cliente_nome: dados.cliente_nome,
    p_cliente_contato: dados.cliente_contato,
    p_endereco: dados.endereco,
    p_inicio: dados.inicio,
    p_fim: dados.fim,
    p_observacoes: dados.observacoes,
    p_possui_grade: dados.possui_grade,
    p_tecnico_ids: [...new Set(tecnicos)],
  })
  if (error || data !== operacao.id) {
    // Uma resposta incerta nunca libera a criação com outro UUID.
    // Somente rejeição explícita e ausência confirmada permitem corrigir os dados.
    if (error && ['23502', '23503', '23514', '22001', '22007', '42501'].includes(error.code)) {
      try {
        const resultado = await supabase.from('eventos').select('id')
          .eq('id', operacao.id).eq('criado_por', dados.criado_por).maybeSingle()
        operacao.rejeitada = !resultado.error && !resultado.data
      } catch { /* Falha ao confirmar preserva a mesma operação. */ }
    }
    throw new Error(operacao.rejeitada
      ? 'Não foi possível salvar o evento. Verifique os dados e suas permissões e tente novamente.'
      : 'Não foi possível confirmar a criação. Tente novamente nesta tela.')
  }
  operacao.criado = true
  return operacao.id
}
