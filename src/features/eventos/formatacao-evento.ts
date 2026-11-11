import type { StatusEvento, ItemMovimentacao, SituacaoRadio, SituacaoAcessorio } from './tipos-evento';
export function mensagemFalhaMovimentacao(erro: unknown, tipo: 'entrega' | 'devolucao') {
    const mensagem = erro instanceof Error ? erro.message : '';
    if (!mensagem || /failed to fetch|fetch failed|networkerror|network request failed|load failed|connectionreset/i.test(mensagem)) {
        const nome = tipo === 'entrega' ? 'a entrega' : 'a devolução';
        return `Não foi possível confirmar ${nome}. Tente novamente sem alterar os dados para reutilizar a mesma operação.`;
    }
    return mensagem;
}
export function formatarData(data: string) {
    return new Date(data).toLocaleString('pt-BR');
}
export function descricaoAcessorio(item: Pick<ItemMovimentacao, 'tipo_acessorio' | 'modelo_acessorio'>) {
    if (item.tipo_acessorio === 'sem_acessorio') {
        return 'Sem acessório';
    }
    return item.modelo_acessorio?.nome ??
        (item.tipo_acessorio === 'fone' ? 'Fone' : 'Mike');
}
export function traduzirSituacao(status: SituacaoRadio | SituacaoAcessorio | null) {
    if (!status)
        return 'Pendente';
    return {
        devolvido: 'Devolvido',
        perdido: 'Perdido',
        danificado: 'Danificado',
        nao_se_aplica: 'Não se aplica',
    }[status];
}
export function traduzirStatus(status: StatusEvento) {
    switch (status) {
        case 'agendado':
            return 'Agendado';
        case 'em_andamento':
            return 'Em andamento';
        case 'finalizado':
            return 'Finalizado';
        case 'recebido':
            return 'Recebido';
    }
}
