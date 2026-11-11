import type { TipoAnexo } from '../../lib/anexos';
export type StatusEvento = 'agendado' | 'em_andamento' | 'finalizado' | 'recebido';
export type Evento = {
    id: string;
    cliente_nome: string;
    cliente_contato: string | null;
    endereco: string;
    inicio: string;
    fim: string;
    observacoes: string | null;
    possui_grade: boolean;
    status: StatusEvento;
    iniciado_em: string | null;
    finalizado_em: string | null;
};
export type Tecnico = {
    id: string;
    nome: string;
    telefone: string | null;
};
export type SituacaoRadio = 'devolvido' | 'perdido' | 'danificado';
export type SituacaoAcessorio = 'nao_se_aplica' | 'devolvido' | 'perdido' | 'danificado';
export type ItemMovimentacao = {
    id: string;
    numero_radio: string;
    item_entrega_origem_id: string | null;
    tipo_acessorio: 'sem_acessorio' | 'fone' | 'mike';
    modelo_acessorio_id: string | null;
    situacao_radio: SituacaoRadio | null;
    situacao_acessorio: SituacaoAcessorio | null;
    observacao: string | null;
    modelo_acessorio: {
        nome: string;
        tipo: 'fone' | 'mike';
    } | null;
};
export type MovimentacaoEquipamento = {
    id: string;
    evento_id: string;
    tipo: 'entrega' | 'devolucao';
    pessoa_nome: string;
    registrado_por: string;
    observacao: string | null;
    criado_em: string;
    tecnico: {
        nome: string;
    } | null;
    itens: ItemMovimentacao[];
};
export type ModeloAcessorio = {
    id: string;
    tipo: 'fone' | 'mike';
    nome: string;
};
export type ItemEntregaRascunho = {
    chave: string;
    numero_radio: string;
    tipo_acessorio: 'sem_acessorio' | 'fone' | 'mike';
    modelo_acessorio_id: string;
    observacao: string;
};
export type ItemDevolucaoRascunho = {
    modelo_acessorio: ItemMovimentacao['modelo_acessorio'];
    item_entrega_origem_id: string;
    numero_radio: string;
    tipo_acessorio: 'sem_acessorio' | 'fone' | 'mike';
    modelo_acessorio_id: string | null;
    selecionado: boolean;
    situacao_radio: SituacaoRadio;
    situacao_acessorio: SituacaoAcessorio;
    observacao: string;
};
export type Anexo = {
    id: string;
    tipo: TipoAnexo;
    arquivo_url: string;
    criado_em: string;
};
