import { HistoricoMovimentacoes } from './HistoricoMovimentacoes';
import { FormularioDevolucao } from './FormularioDevolucao';
import { FormularioEntrega } from './FormularioEntrega';
import { formatarData, descricaoAcessorio, traduzirStatus, mensagemFalhaMovimentacao } from './formatacao-evento';
import { CAMPOS_EVENTO, buscarAnexos, buscarMovimentacoes } from './consultas-evento';
import type { Evento, Tecnico, MovimentacaoEquipamento, ModeloAcessorio, ItemEntregaRascunho, ItemDevolucaoRascunho, Anexo } from './tipos-evento';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../app/auth-context';
import { supabase } from '../../lib/supabase';
import { criarFilaAnexos, enviarLoteAnexos, validarArquivos, type TipoAnexo } from '../../lib/anexos';
let contadorItemEntrega = 0;
function novoItemEntrega(): ItemEntregaRascunho {
    contadorItemEntrega += 1;
    return {
        chave: `item-entrega-${contadorItemEntrega}`,
        numero_radio: '',
        tipo_acessorio: 'sem_acessorio',
        modelo_acessorio_id: '',
        observacao: '',
    };
}
export function DetalheEvento() {
    const { id } = useParams();
    const { usuario } = useAuth();
    const [evento, setEvento] = useState<Evento | null>(null);
    const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
    const [movimentacoes, setMovimentacoes] = useState<MovimentacaoEquipamento[]>([]);
    const [modelosAcessorio, setModelosAcessorio] = useState<ModeloAcessorio[]>([]);
    const [mostrarEntrega, setMostrarEntrega] = useState(false);
    const [pessoaEntrega, setPessoaEntrega] = useState('');
    const [observacaoEntrega, setObservacaoEntrega] = useState('');
    const [itensEntregaForm, setItensEntregaForm] = useState<ItemEntregaRascunho[]>(() => [novoItemEntrega()]);
    const [salvandoEntrega, setSalvandoEntrega] = useState(false);
    const [erroEntrega, setErroEntrega] = useState('');
    // Uma trava compartilhada impede entrega, devolução e finalização concorrentes.
    const movimentacaoEmCurso = useRef<symbol | null>(null);
    const operacaoEntrega = useRef<{ assinatura: string; id: string } | null>(null);
    const operacaoDevolucao = useRef<{ assinatura: string; id: string } | null>(null);
    const [mostrarDevolucao, setMostrarDevolucao] = useState(false);
    const [pessoaDevolucao, setPessoaDevolucao] = useState('');
    const [observacaoDevolucao, setObservacaoDevolucao] = useState('');
    const [itensDevolucaoForm, setItensDevolucaoForm] = useState<ItemDevolucaoRascunho[]>([]);
    const [salvandoDevolucao, setSalvandoDevolucao] = useState(false);
    const [erroDevolucao, setErroDevolucao] = useState('');
    const [mostrarHistorico, setMostrarHistorico] = useState(false);
    const [mostrarPendentes, setMostrarPendentes] = useState(false);
    const [anexos, setAnexos] = useState<Anexo[]>([]);
    const [tipoAnexo, setTipoAnexo] = useState<TipoAnexo>('matriz');
    const [arquivos, setArquivos] = useState<File[]>([]);
    const [enviandoAnexo, setEnviandoAnexo] = useState(false);
    const [erroAnexo, setErroAnexo] = useState('');
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState('');
    const [alterandoStatus, setAlterandoStatus] = useState(false);
    const [erroStatus, setErroStatus] = useState('');
    const fila = useRef<ReturnType<typeof criarFilaAnexos> | null>(null);
    if (fila.current === null)
        fila.current = criarFilaAnexos();
    const emCurso = useRef(false);
    const rotaAtual = useRef(id);
    const geracao = useRef(0);
    const envioStatus = useRef<symbol | null>(null);
    const [errosSecoes, setErrosSecoes] = useState({
        modelos: '',
        tecnicos: '',
        movimentacoes: '',
        anexos: '',
    });
    const [tentativa, setTentativa] = useState(0);
    const [linkAnexo, setLinkAnexo] = useState('');
    // Após gravar, consulta somente o histórico; preserva anexos e demais seções.
    async function atualizarMovimentacoes() {
        if (!id)
            return;
        const versao = geracao.current;
        const ativo = () => rotaAtual.current === id && geracao.current === versao;
        try {
            const { data, error } = await buscarMovimentacoes(id, new AbortController().signal);
            if (!ativo())
                return;
            if (error)
                throw error;
            setMovimentacoes((data ?? []) as unknown as MovimentacaoEquipamento[]);
            setErrosSecoes(atuais => ({ ...atuais, movimentacoes: '' }));
        }
        catch {
            if (ativo())
                setErrosSecoes(atuais => ({ ...atuais,
                    movimentacoes: 'Registro salvo, mas não foi possível atualizar as movimentações. Tente carregar novamente.',
                }));
        }
    }
    async function carregarAnexos() {
        if (!id)
            return;
        const atual = geracao.current;
        try {
            const { data, error } = await buscarAnexos(id);
            if (rotaAtual.current !== id ||
                geracao.current !== atual) {
                return;
            }
            if (error) {
                throw error;
            }
            setAnexos(data ?? []);
            setErrosSecoes((atuais) => ({
                ...atuais,
                anexos: '',
            }));
        }
        catch {
            if (rotaAtual.current === id &&
                geracao.current === atual) {
                setErrosSecoes((atuais) => ({
                    ...atuais,
                    anexos: 'Não foi possível atualizar os anexos.',
                }));
            }
        }
    }
    useEffect(() => {
        let ativo = true;
        ++geracao.current;
        rotaAtual.current = id;
        const controller = new AbortController();
        const signal = controller.signal;
        async function carregarDados() {
            await Promise.resolve();
            if (!ativo)
                return;
            setEvento(null);
            setTecnicos([]);
            setMovimentacoes([]);
            setModelosAcessorio([]);
            setMostrarEntrega(false);
            setPessoaEntrega('');
            setObservacaoEntrega('');
            setItensEntregaForm([novoItemEntrega()]);
            setSalvandoEntrega(false);
            setErroEntrega('');
            movimentacaoEmCurso.current = null;
            operacaoEntrega.current = null;
            operacaoDevolucao.current = null;
            setMostrarDevolucao(false);
            setPessoaDevolucao('');
            setObservacaoDevolucao('');
            setItensDevolucaoForm([]);
            setSalvandoDevolucao(false);
            setErroDevolucao('');
            setMostrarHistorico(false);
            setMostrarPendentes(false);
            setAnexos([]);
            setArquivos([]);
            setEnviandoAnexo(false);
            setErroAnexo('');
            setAlterandoStatus(false);
            envioStatus.current = null;
            setErroStatus('');
            setLinkAnexo('');
            setErrosSecoes({
                modelos: '',
                tecnicos: '',
                movimentacoes: '',
                anexos: '',
            });
            setCarregando(true);
            setErro('');
            try {
                if (!id) {
                    throw new Error('Evento inválido.');
                }
                const { data: dados, error, } = await supabase
                    .from('eventos')
                    .select(CAMPOS_EVENTO)
                    .eq('id', id)
                    .abortSignal(signal)
                    .single();
                if (!ativo)
                    return;
                if (error || !dados) {
                    throw new Error('Não foi possível carregar o evento.');
                }
                setEvento(dados);
                async function buscarTecnicos() {
                    const vinculos = await supabase
                        .from('eventos_tecnicos')
                        .select('tecnico_id')
                        .eq('evento_id', id)
                        .abortSignal(signal);
                    if (vinculos.error) {
                        return {
                            data: null,
                            error: vinculos.error,
                        };
                    }
                    const ids = (vinculos.data ?? []).map((vinculo) => vinculo.tecnico_id);
                    if (!ids.length) {
                        return {
                            data: [],
                            error: null,
                        };
                    }
                    return supabase
                        .from('usuarios')
                        .select('id, nome, telefone')
                        .in('id', ids)
                        .abortSignal(signal);
                }
                const resultados = await Promise.allSettled([
                    buscarTecnicos(),
                    buscarMovimentacoes(id, signal),
                    buscarAnexos(id).abortSignal(signal),
                    supabase
                        .from('modelos_acessorio')
                        .select('id, tipo, nome')
                        .eq('ativo', true)
                        .order('tipo', { ascending: true })
                        .order('nome', { ascending: true })
                        .abortSignal(signal),
                ]);
                if (!ativo)
                    return;
                const [t, mov, a, modelos] = resultados;
                const erroT = t.status === 'rejected' || Boolean(t.value.error);
                const erroMov = mov.status === 'rejected' || Boolean(mov.value.error);
                const erroA = a.status === 'rejected' || Boolean(a.value.error);
                const erroModelos = modelos.status === 'rejected' || Boolean(modelos.value.error);
                if (!erroT && t.status === 'fulfilled') {
                    setTecnicos(t.value.data ?? []);
                }
                if (!erroMov && mov.status === 'fulfilled') {
                    setMovimentacoes((mov.value.data ?? []) as unknown as MovimentacaoEquipamento[]);
                }
                if (!erroA && a.status === 'fulfilled') {
                    setAnexos(a.value.data ?? []);
                }
                if (!erroModelos && modelos.status === 'fulfilled') {
                    setModelosAcessorio((modelos.value.data ?? []) as ModeloAcessorio[]);
                }
                setErrosSecoes({
                    modelos: erroModelos ? 'Não foi possível carregar os modelos de acessórios.' : '',
                    tecnicos: erroT ? 'Não foi possível carregar os técnicos.' : '',
                    movimentacoes: erroMov
                        ? 'Não foi possível carregar as movimentações de equipamentos.'
                        : '',
                    anexos: erroA ? 'Não foi possível carregar os anexos.' : '',
                });
            }
            catch (e) {
                if (ativo) {
                    setErro(e instanceof Error
                        ? e.message
                        : 'Não foi possível carregar o evento.');
                }
            }
            finally {
                if (ativo) {
                    setCarregando(false);
                }
            }
        }
        void carregarDados();
        return () => {
            ativo = false;
            rotaAtual.current = undefined;
            controller.abort();
        };
    }, [id, tentativa]);
    async function alterarStatusEvento(novoStatus: 'em_andamento' | 'finalizado') {
        if (!id ||
            !evento ||
            usuario?.perfil !== 'tecnico' ||
            evento.id !== id ||
            envioStatus.current ||
            alterandoStatus ||
            movimentacaoEmCurso.current ||
            mostrarEntrega ||
            mostrarDevolucao) {
            return;
        }
        // Repete a condição do botão no handler; a regra definitiva continua no banco.
        if (novoStatus === 'finalizado' && !todosRadiosResolvidos)
            return;
        if (evento.status !== (novoStatus === 'em_andamento' ? 'agendado' : 'em_andamento'))
            return;
        const versao = geracao.current;
        const operacao = Symbol();
        envioStatus.current = operacao;
        const ativo = () => rotaAtual.current === id && geracao.current === versao;
        setAlterandoStatus(true);
        setErroStatus('');
        try {
            const { data, error } = await supabase
                .from('eventos')
                .update({
                status: novoStatus,
            })
                .eq('id', id)
                .eq('status', evento.status)
                .select(CAMPOS_EVENTO)
                .single();
            if (!ativo())
                return;
            if (error || !data) {
                console.error('Erro ao alterar status do evento:', error);
                throw new Error(novoStatus ===
                    'em_andamento'
                    ? 'Não foi possível iniciar o evento.'
                    : 'Não foi possível finalizar o evento.');
            }
            /*
              IMPORTANTE:
              O frontend envia somente o status.

              iniciado_em e finalizado_em
              são preenchidos pelo banco através
              do trigger proteger_update_eventos.
            */
            setEvento(data);
        }
        catch (e) {
            console.error(e);
            if (ativo())
                setErroStatus(e instanceof Error
                    ? e.message
                    : 'Não foi possível alterar o status do evento.');
        }
        finally {
            if (envioStatus.current === operacao)
                envioStatus.current = null;
            if (ativo())
                setAlterandoStatus(false);
        }
    }
    function atualizarItemEntrega(chave: string, alteracoes: Partial<ItemEntregaRascunho>) {
        if (salvandoEntrega)
            return;
        setItensEntregaForm(atuais => atuais.map(item => item.chave === chave ? { ...item, ...alteracoes } : item));
    }
    function alterarTipoAcessorio(chave: string, tipo: ItemEntregaRascunho['tipo_acessorio']) {
        atualizarItemEntrega(chave, {
            tipo_acessorio: tipo,
            modelo_acessorio_id: '',
        });
    }
    function adicionarItemEntrega() {
        if (salvandoEntrega)
            return;
        setItensEntregaForm(atuais => [...atuais, novoItemEntrega()]);
    }
    function removerItemEntrega(chave: string) {
        if (salvandoEntrega)
            return;
        setItensEntregaForm(atuais => atuais.length === 1 ? atuais : atuais.filter(item => item.chave !== chave));
    }
    function cancelarEntrega() {
        if (salvandoEntrega)
            return;
        setMostrarEntrega(false);
        setPessoaEntrega('');
        setObservacaoEntrega('');
        setItensEntregaForm([novoItemEntrega()]);
        setErroEntrega('');
        operacaoEntrega.current = null;
    }
    async function registrarEntrega() {
        if (!id ||
            !usuario ||
            usuario.perfil !== 'tecnico' ||
            evento?.id !== id || envioStatus.current || alterandoStatus || errosSecoes.movimentacoes || mostrarDevolucao ||
            evento?.status !== 'em_andamento' ||
            salvandoEntrega ||
            movimentacaoEmCurso.current) {
            return;
        }
        const pessoa = pessoaEntrega.trim();
        if (!pessoa) {
            setErroEntrega('Informe quem recebeu os equipamentos.');
            return;
        }
        const numeros = itensEntregaForm.map(item => item.numero_radio.trim().toUpperCase());
        if (!numeros.length || numeros.some(numero => !numero)) {
            setErroEntrega('Informe o número de todos os rádios.');
            return;
        }
        if (new Set(numeros).size !== numeros.length) {
            setErroEntrega('O mesmo rádio foi informado mais de uma vez nesta entrega.');
            return;
        }
        const pendentes = new Set(radiosPendentes.map(item => item.numero_radio.trim().toUpperCase()));
        if (numeros.some(numero => pendentes.has(numero))) {
            setErroEntrega('Um dos rádios informados já possui entrega pendente neste evento.');
            return;
        }
        for (const item of itensEntregaForm) {
            if (item.tipo_acessorio !== 'sem_acessorio') {
                if (!item.modelo_acessorio_id) {
                    setErroEntrega(`Selecione o modelo do acessório do rádio ${item.numero_radio.trim()}.`);
                    return;
                }
                const modeloValido = modelosAcessorio.some(modelo => modelo.id === item.modelo_acessorio_id &&
                    modelo.tipo === item.tipo_acessorio);
                if (!modeloValido) {
                    setErroEntrega(`O modelo selecionado para o rádio ${item.numero_radio.trim()} é inválido.`);
                    return;
                }
            }
        }
        const operacao = Symbol();
        movimentacaoEmCurso.current = operacao;
        setSalvandoEntrega(true);
        setErroEntrega('');
        const versao = geracao.current;
        const eventoId = id;
        const ativo = () => rotaAtual.current === eventoId && geracao.current === versao;
        try {
            const parametros = {
                p_evento_id: eventoId,
                p_pessoa_nome: pessoa,
                p_observacao: observacaoEntrega.trim() || null,
                p_itens: itensEntregaForm.map(item => ({
                    numero_radio: item.numero_radio.trim().toUpperCase(),
                    tipo_acessorio: item.tipo_acessorio,
                    modelo_acessorio_id: item.tipo_acessorio === 'sem_acessorio'
                        ? null
                        : item.modelo_acessorio_id,
                    observacao: item.observacao.trim() || null,
                })),
            };
            const assinatura = JSON.stringify({ usuarioId: usuario.id, ...parametros });
            if (operacaoEntrega.current?.assinatura !== assinatura)
                operacaoEntrega.current = { assinatura, id: crypto.randomUUID() };
            const { error } = await supabase.rpc('registrar_entrega_equipamentos', {
                ...parametros, p_operacao_id: operacaoEntrega.current.id,
            });
            if (!ativo())
                return;
            if (error) {
                console.error('Erro ao registrar entrega:', error);
                throw new Error(error.message || 'Não foi possível registrar a entrega.');
            }
            setMostrarEntrega(false);
            operacaoEntrega.current = null;
            setPessoaEntrega('');
            setObservacaoEntrega('');
            setItensEntregaForm([novoItemEntrega()]);
            setErroEntrega('');
            await atualizarMovimentacoes();
        }
        catch (e) {
            if (ativo()) {
                setErroEntrega(mensagemFalhaMovimentacao(e, 'entrega'));
            }
        }
        finally {
            if (movimentacaoEmCurso.current === operacao)
                movimentacaoEmCurso.current = null;
            if (ativo())
                setSalvandoEntrega(false);
        }
    }
    function abrirDevolucao() {
        if (movimentacaoEmCurso.current || envioStatus.current || alterandoStatus || mostrarEntrega ||
            usuario?.perfil !== 'tecnico' || evento?.id !== id || evento?.status !== 'em_andamento' ||
            errosSecoes.movimentacoes || radiosPendentes.length === 0)
            return;
        setMostrarEntrega(false);
        setErroEntrega('');
        setMostrarDevolucao(true);
        setErroDevolucao('');
        setPessoaDevolucao('');
        setObservacaoDevolucao('');
        setItensDevolucaoForm(radiosPendentes.map(item => ({
            modelo_acessorio: item.modelo_acessorio,
            item_entrega_origem_id: item.id,
            numero_radio: item.numero_radio,
            tipo_acessorio: item.tipo_acessorio,
            modelo_acessorio_id: item.modelo_acessorio_id,
            selecionado: false,
            situacao_radio: 'devolvido',
            situacao_acessorio: item.tipo_acessorio === 'sem_acessorio'
                ? 'nao_se_aplica'
                : 'devolvido',
            observacao: '',
        })));
    }
    function atualizarItemDevolucao(itemOrigemId: string, alteracoes: Partial<ItemDevolucaoRascunho>) {
        if (salvandoDevolucao)
            return;
        setItensDevolucaoForm(atuais => atuais.map(item => item.item_entrega_origem_id === itemOrigemId
            ? { ...item, ...alteracoes }
            : item));
    }
    function cancelarDevolucao() {
        if (salvandoDevolucao)
            return;
        setMostrarDevolucao(false);
        setPessoaDevolucao('');
        setObservacaoDevolucao('');
        setItensDevolucaoForm([]);
        setErroDevolucao('');
        operacaoDevolucao.current = null;
    }
    async function registrarDevolucao() {
        if (!id ||
            !usuario ||
            usuario.perfil !== 'tecnico' ||
            evento?.id !== id || envioStatus.current || alterandoStatus || errosSecoes.movimentacoes || mostrarEntrega ||
            evento?.status !== 'em_andamento' ||
            salvandoDevolucao ||
            movimentacaoEmCurso.current) {
            return;
        }
        const pessoa = pessoaDevolucao.trim();
        if (!pessoa) {
            setErroDevolucao('Informe quem devolveu os equipamentos.');
            return;
        }
        const selecionados = itensDevolucaoForm.filter(item => item.selecionado);
        if (selecionados.length === 0) {
            setErroDevolucao('Selecione pelo menos um rádio para devolver.');
            return;
        }
        for (const item of selecionados) {
            if (!radiosPendentes.some(pendente => pendente.id === item.item_entrega_origem_id)) {
                setErroDevolucao('Um dos rádios selecionados não está mais pendente. Atualize as movimentações.');
                return;
            }
            if (!['devolvido', 'perdido', 'danificado'].includes(item.situacao_radio)) {
                setErroDevolucao(`Informe a situação do rádio ${item.numero_radio}.`);
                return;
            }
            if (item.tipo_acessorio !== 'sem_acessorio' &&
                !['devolvido', 'perdido', 'danificado'].includes(item.situacao_acessorio)) {
                setErroDevolucao(`Informe a situação do acessório do rádio ${item.numero_radio}.`);
                return;
            }
        }
        const operacao = Symbol();
        movimentacaoEmCurso.current = operacao;
        setSalvandoDevolucao(true);
        setErroDevolucao('');
        const versao = geracao.current;
        const eventoId = id;
        const ativo = () => rotaAtual.current === eventoId && geracao.current === versao;
        try {
            const parametros = {
                p_evento_id: eventoId,
                p_pessoa_nome: pessoa,
                p_observacao: observacaoDevolucao.trim() || null,
                p_itens: selecionados.map(item => ({
                    item_entrega_origem_id: item.item_entrega_origem_id,
                    numero_radio: item.numero_radio,
                    tipo_acessorio: item.tipo_acessorio,
                    modelo_acessorio_id: item.modelo_acessorio_id,
                    situacao_radio: item.situacao_radio,
                    situacao_acessorio: item.tipo_acessorio === 'sem_acessorio' ? 'nao_se_aplica' : item.situacao_acessorio,
                    observacao: item.observacao.trim() || null,
                })),
            };
            const assinatura = JSON.stringify({ usuarioId: usuario.id, ...parametros });
            if (operacaoDevolucao.current?.assinatura !== assinatura)
                operacaoDevolucao.current = { assinatura, id: crypto.randomUUID() };
            const { error } = await supabase.rpc('registrar_devolucao_equipamentos', {
                ...parametros, p_operacao_id: operacaoDevolucao.current.id,
            });
            if (!ativo())
                return;
            if (error) {
                console.error('Erro ao registrar devolução:', error);
                throw new Error(error.message || 'Não foi possível registrar a devolução.');
            }
            setMostrarDevolucao(false);
            operacaoDevolucao.current = null;
            setPessoaDevolucao('');
            setObservacaoDevolucao('');
            setItensDevolucaoForm([]);
            setErroDevolucao('');
            setMostrarPendentes(false);
            await atualizarMovimentacoes();
        }
        catch (e) {
            if (ativo()) {
                setErroDevolucao(mensagemFalhaMovimentacao(e, 'devolucao'));
            }
        }
        finally {
            if (movimentacaoEmCurso.current === operacao)
                movimentacaoEmCurso.current = null;
            if (ativo())
                setSalvandoDevolucao(false);
        }
    }
    async function enviarAnexos() {
        if (emCurso.current) {
            return;
        }
        if (!id ||
            usuario?.perfil !==
                'coordenador' ||
            !arquivos.length) {
            setErroAnexo('Selecione pelo menos um arquivo e verifique sua permissão.');
            return;
        }
        try {
            validarArquivos(arquivos);
        }
        catch (e) {
            setErroAnexo(e instanceof Error
                ? e.message
                : 'Arquivos inválidos.');
            return;
        }
        emCurso.current = true;
        const atual = geracao.current;
        setEnviandoAnexo(true);
        setErroAnexo('');
        try {
            const ativo = () => rotaAtual.current === id &&
                geracao.current === atual;
            await enviarLoteAnexos(fila.current!, id, tipoAnexo, arquivos, usuario.id, (arquivo) => {
                if (ativo()) {
                    setArquivos((atuais) => atuais.filter((item) => item !== arquivo));
                }
            }, ativo);
        }
        catch (e) {
            if (rotaAtual.current === id &&
                geracao.current === atual) {
                setErroAnexo(e instanceof Error
                    ? e.message
                    : 'Não foi possível concluir o envio.');
            }
        }
        finally {
            if (rotaAtual.current === id &&
                geracao.current === atual) {
                await carregarAnexos();
                setEnviandoAnexo(false);
            }
            emCurso.current = false;
        }
    }
    async function abrirAnexo(caminho: string) {
        setErroAnexo('');
        setLinkAnexo('');
        const janela = window.open('about:blank', '_blank');
        const versao = geracao.current;
        if (janela) {
            janela.opener = null;
        }
        try {
            const { data, error, } = await supabase.storage
                .from('eventos_anexos')
                .createSignedUrl(caminho, 60);
            if (error || !data) {
                throw new Error('Não foi possível abrir o arquivo. Tente novamente.');
            }
            if (rotaAtual.current !== id || geracao.current !== versao) {
                janela?.close();
                return;
            }
            if (janela) {
                janela.location.href =
                    data.signedUrl;
            }
            else {
                setLinkAnexo(data.signedUrl);
            }
        }
        catch {
            janela?.close();
            if (rotaAtual.current === id && geracao.current === versao)
                setErroAnexo('Não foi possível abrir o arquivo. Tente novamente.');
        }
    }
    const inputAnexo = useRef<HTMLInputElement | null>(null);
    const anexosMatriz = anexos.filter((anexo) => anexo.tipo === 'matriz');
    const anexosGrade = anexos.filter((anexo) => anexo.tipo === 'grade');
    const anexosTermo = anexos.filter((anexo) => anexo.tipo ===
        'termo_locacao');
    function listarAnexos(lista: Anexo[]) {
        if (!lista.length)
            return <p>Nenhum arquivo enviado.</p>;
        return (<ul>
        {lista.map(anexo => (<li key={anexo.id}>
            <button type="button" onClick={() => abrirAnexo(anexo.arquivo_url)}>
              Abrir arquivo
            </button>
            {' - '}{formatarData(anexo.criado_em)}
          </li>))}
      </ul>);
    }
    if (carregando || (evento && evento.id !== id))
        return <p>Carregando evento...</p>;
    if (erro || !evento) {
        return (<div>
        <Link to="/eventos">Voltar</Link>
        <p>{erro || 'Evento não encontrado.'}</p>
        <button type="button" onClick={() => setTentativa(valor => valor + 1)}>Tentar novamente</button>
      </div>);
    }
    const ehTecnico = usuario?.perfil === 'tecnico';
    const itensEntrega = movimentacoes
        .filter(movimentacao => movimentacao.tipo === 'entrega')
        .flatMap(movimentacao => movimentacao.itens);
    const itensDevolvidos = new Set(movimentacoes
        .filter(movimentacao => movimentacao.tipo === 'devolucao')
        .flatMap(movimentacao => movimentacao.itens)
        .filter(item => item.situacao_radio !== null &&
        (item.tipo_acessorio === 'sem_acessorio' ||
            (item.situacao_acessorio !== null && item.situacao_acessorio !== 'nao_se_aplica')))
        .map(item => item.item_entrega_origem_id)
        .filter((itemId): itemId is string => Boolean(itemId)));
    const radiosPendentes = itensEntrega.filter(item => !itensDevolvidos.has(item.id));
    const todosRadiosResolvidos = !errosSecoes.movimentacoes && radiosPendentes.length === 0;
    const totalEntregues = itensEntrega.length;
    const totalResolvidos = totalEntregues - radiosPendentes.length;
    return (<div>
      <Link to="/eventos">Voltar para eventos</Link>
      <h1>{evento.cliente_nome}</h1>

      <section>
        <h2>Informações do evento</h2>
        <p><strong>Status:</strong> {traduzirStatus(evento.status)}</p>
        <p><strong>Endereço:</strong> {evento.endereco}</p>
        <p><strong>Contato:</strong> {evento.cliente_contato ?? 'Não informado'}</p>
        <p><strong>Início previsto:</strong> {formatarData(evento.inicio)}</p>
        <p><strong>Fim previsto:</strong> {formatarData(evento.fim)}</p>
        <p><strong>Possui grade:</strong> {evento.possui_grade ? 'Sim' : 'Não'}</p>
        <p><strong>Observações:</strong> {evento.observacoes ?? 'Nenhuma observação'}</p>
      </section>

      <hr />

      <section>
        <h2>Técnicos responsáveis</h2>
        {errosSecoes.tecnicos && <p role="alert">{errosSecoes.tecnicos}</p>}
        {!errosSecoes.tecnicos && (tecnicos.length === 0 ? (<p>Nenhum técnico associado.</p>) : (<ul>
            {tecnicos.map(tecnico => (<li key={tecnico.id}>
                <strong>{tecnico.nome}</strong>
                {tecnico.telefone && ' - ' + tecnico.telefone}
              </li>))}
          </ul>))}
      </section>

      <hr />

      <section>
        <h2>Movimentações de equipamentos</h2>
        {errosSecoes.movimentacoes && (<p role="alert">{errosSecoes.movimentacoes}</p>)}
        {!errosSecoes.movimentacoes && (<>
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '12px',
                marginBottom: '16px',
            }}>
              <div>
                <strong>Entregues</strong>
                <br />
                {totalEntregues}
              </div>
              <div>
                <strong>Resolvidos</strong>
                <br />
                {totalResolvidos}
              </div>
              <button type="button" aria-expanded={mostrarPendentes} aria-controls="equipamentos-pendentes" onClick={() => setMostrarPendentes(valor => !valor)} disabled={radiosPendentes.length === 0}>
                <strong>Pendentes</strong>
                <br />
                {radiosPendentes.length}
              </button>
              <button type="button" aria-expanded={mostrarHistorico} aria-controls="historico-movimentacoes" onClick={() => setMostrarHistorico(valor => !valor)}>
                <strong>Movimentações</strong>
                <br />
                {movimentacoes.length}
              </button>
            </div>
            {ehTecnico && evento.status === 'em_andamento' && (<div style={{ marginBottom: '16px' }}>
                {!mostrarEntrega && !mostrarDevolucao && (<>
                    <button type="button" disabled={alterandoStatus || salvandoEntrega || salvandoDevolucao} onClick={() => {
                        setErroEntrega('');
                        setMostrarDevolucao(false);
                        setMostrarEntrega(true);
                    }}>
                      Registrar entrega
                    </button>{' '}
                    <button type="button" disabled={alterandoStatus ||
                        salvandoEntrega ||
                        salvandoDevolucao ||
                        radiosPendentes.length === 0} onClick={abrirDevolucao}>
                      Registrar devolução
                    </button>
                  </>)}
                {mostrarEntrega && <FormularioEntrega erroEntrega={erroEntrega} erroModelos={errosSecoes.modelos} pessoaEntrega={pessoaEntrega} salvandoEntrega={salvandoEntrega} setPessoaEntrega={setPessoaEntrega} itensEntregaForm={itensEntregaForm} modelosAcessorio={modelosAcessorio} atualizarItemEntrega={atualizarItemEntrega} alterarTipoAcessorio={alterarTipoAcessorio} removerItemEntrega={removerItemEntrega} adicionarItemEntrega={adicionarItemEntrega} observacaoEntrega={observacaoEntrega} setObservacaoEntrega={setObservacaoEntrega} registrarEntrega={registrarEntrega} cancelarEntrega={cancelarEntrega}/>}
                {mostrarDevolucao && <FormularioDevolucao erroDevolucao={erroDevolucao} pessoaDevolucao={pessoaDevolucao} salvandoDevolucao={salvandoDevolucao} setPessoaDevolucao={setPessoaDevolucao} itensDevolucaoForm={itensDevolucaoForm} atualizarItemDevolucao={atualizarItemDevolucao} observacaoDevolucao={observacaoDevolucao} setObservacaoDevolucao={setObservacaoDevolucao} registrarDevolucao={registrarDevolucao} cancelarDevolucao={cancelarDevolucao}/>}
              </div>)}
            {mostrarPendentes && radiosPendentes.length > 0 && (<div id="equipamentos-pendentes">
                <h3>Pendentes de devolução</h3>
                <ul>
                  {radiosPendentes.map(item => (<li key={item.id}>
                      Rádio {item.numero_radio} — {descricaoAcessorio(item)}
                    </li>))}
                </ul>
              </div>)}
            {mostrarHistorico && <HistoricoMovimentacoes movimentacoes={movimentacoes} setMostrarHistorico={setMostrarHistorico}/>}

          </>)}
      </section>
      <hr />

      <section>
        <h2>Anexos</h2>
        {errosSecoes.anexos && <p role="alert">{errosSecoes.anexos}</p>}
        {erroAnexo && <p role="alert">{erroAnexo}</p>}
        {linkAnexo && (<p>
            <a href={linkAnexo} target="_blank" rel="noopener noreferrer">
              Abrir arquivo (link válido por 60 segundos)
            </a>
          </p>)}
        {Object.values(errosSecoes).some(Boolean) && (<button type="button" disabled={enviandoAnexo || salvandoEntrega || salvandoDevolucao || alterandoStatus} onClick={() => setTentativa(valor => valor + 1)}>
            Tentar carregar novamente
          </button>)}
        {!errosSecoes.anexos && (<>
            <h3>Matriz</h3>
            {listarAnexos(anexosMatriz)}
            <h3>Grade</h3>
            {listarAnexos(anexosGrade)}
            <h3>Termo de locação</h3>
            {listarAnexos(anexosTermo)}
          </>)}
        {usuario?.perfil === 'coordenador' && (<>
            <hr />
            <h3>Adicionar novos anexos</h3>
            <select aria-label="Tipo de anexo" disabled={enviandoAnexo || arquivos.length > 0} value={tipoAnexo} onChange={event => setTipoAnexo(event.target.value as TipoAnexo)}>
              <option value="matriz">Matriz</option>
              <option value="grade">Grade</option>
              <option value="termo_locacao">Termo de locação</option>
            </select>
            <input ref={inputAnexo} id="arquivoAnexo" type="file" multiple aria-label="Arquivos para anexar" disabled={enviandoAnexo} onChange={event => setArquivos(Array.from(event.target.files ?? []))}/>
            <p>Até 20 arquivos por envio, com no máximo 20 MB cada.</p>
            <button type="button" disabled={enviandoAnexo} onClick={() => {
                setArquivos([]);
                if (inputAnexo.current)
                    inputAnexo.current.value = '';
            }}>
              Limpar seleção
            </button>
            {arquivos.length > 0 && (<ul>
                {arquivos.map(arquivo => (<li key={arquivo.name + '-' + arquivo.lastModified}>{arquivo.name}</li>))}
              </ul>)}
            <button type="button" onClick={enviarAnexos} disabled={enviandoAnexo || arquivos.length === 0}>
              {enviandoAnexo ? 'Enviando...' : 'Enviar anexos'}
            </button>
          </>)}
      </section>

      <hr />

      <section>
        <h2>Execução</h2>
        <p><strong>Status:</strong> {traduzirStatus(evento.status)}</p>
        <p><strong>Iniciado em:</strong> {evento.iniciado_em
            ? formatarData(evento.iniciado_em) : 'Evento ainda não iniciado'}</p>
        <p><strong>Finalizado em:</strong> {evento.finalizado_em
            ? formatarData(evento.finalizado_em) : 'Evento ainda não finalizado'}</p>
        {erroStatus && <p role="alert">{erroStatus}</p>}
        {ehTecnico && evento.status === 'agendado' && (<button type="button" disabled={alterandoStatus} onClick={() => alterarStatusEvento('em_andamento')}>
            {alterandoStatus ? 'Iniciando...' : 'Iniciar evento'}
          </button>)}
        {ehTecnico && evento.status === 'em_andamento' && (<>
            <button type="button" disabled={alterandoStatus ||
                salvandoEntrega ||
                salvandoDevolucao ||
                mostrarEntrega ||
                mostrarDevolucao ||
                !todosRadiosResolvidos} onClick={() => alterarStatusEvento('finalizado')}>
              {alterandoStatus ? 'Finalizando...' : 'Finalizar evento'}
            </button>
            {!todosRadiosResolvidos && <p>{errosSecoes.movimentacoes
                    ? 'Carregue as movimentações antes de finalizar o evento.'
                    : 'Existem rádios ou acessórios pendentes de devolução neste pedido.'}</p>}
            {(mostrarEntrega || mostrarDevolucao) && (<p>Salve ou cancele a movimentação aberta antes de finalizar o evento.</p>)}
          </>)}
        {ehTecnico && evento.status === 'finalizado' && <p>Evento finalizado.</p>}
        {ehTecnico && evento.status === 'recebido' && <p>Evento recebido pelo estoque.</p>}
      </section>
    </div>);
}
