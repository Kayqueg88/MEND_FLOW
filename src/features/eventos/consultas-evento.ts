import { supabase } from '../../lib/supabase';
export const CAMPOS_EVENTO = 'id, cliente_nome, cliente_contato, endereco, inicio, fim, observacoes, possui_grade, status, iniciado_em, finalizado_em';
export const CAMPOS_ANEXO = 'id, tipo, arquivo_url, criado_em';
export function buscarAnexos(eventoId: string) {
    return supabase.from('anexos').select(CAMPOS_ANEXO)
        .eq('evento_id', eventoId).order('criado_em', { ascending: false });
}
export function buscarMovimentacoes(eventoId: string, signal: AbortSignal) {
    return supabase
        .from('movimentacoes_equipamentos')
        .select(`
      id,
      evento_id,
      tipo,
      pessoa_nome,
      registrado_por,
      observacao,
      criado_em,
      tecnico:usuarios!movimentacoes_equipamentos_registrado_por_fkey (
        nome
      ),
      itens:movimentacoes_equipamentos_itens (
        id,
        numero_radio,
        item_entrega_origem_id,
        tipo_acessorio,
        modelo_acessorio_id,
        situacao_radio,
        situacao_acessorio,
        observacao,
        modelo_acessorio:modelos_acessorio (
          nome,
          tipo
        )
      )
    `)
        .eq('evento_id', eventoId)
        .order('criado_em', { ascending: true })
        .abortSignal(signal);
}
