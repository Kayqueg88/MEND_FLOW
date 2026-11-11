import type { ItemEntregaRascunho, ModeloAcessorio } from './tipos-evento';
type Props = {
    erroEntrega: string;
    erroModelos: string;
    pessoaEntrega: string;
    salvandoEntrega: boolean;
    setPessoaEntrega: (valor: string) => void;
    itensEntregaForm: ItemEntregaRascunho[];
    modelosAcessorio: ModeloAcessorio[];
    atualizarItemEntrega: (chave: string, alteracoes: Partial<ItemEntregaRascunho>) => void;
    alterarTipoAcessorio: (chave: string, tipo: ItemEntregaRascunho['tipo_acessorio']) => void;
    removerItemEntrega: (chave: string) => void;
    adicionarItemEntrega: () => void;
    observacaoEntrega: string;
    setObservacaoEntrega: (valor: string) => void;
    registrarEntrega: () => Promise<void>;
    cancelarEntrega: () => void;
};
export function FormularioEntrega({ erroEntrega, erroModelos, pessoaEntrega, salvandoEntrega, setPessoaEntrega, itensEntregaForm, modelosAcessorio, atualizarItemEntrega, alterarTipoAcessorio, removerItemEntrega, adicionarItemEntrega, observacaoEntrega, setObservacaoEntrega, registrarEntrega, cancelarEntrega }: Props) {
    return (<div>
                    <hr />
                    <h3>Registrar entrega de equipamentos</h3>
                    {erroEntrega && <p role="alert">{erroEntrega}</p>}
                    {erroModelos && <p role="alert">{erroModelos}</p>}
                    <label>
                      Quem recebeu os equipamentos:
                      <br />
                      <input type="text" value={pessoaEntrega} disabled={salvandoEntrega} onChange={event => setPessoaEntrega(event.target.value)} placeholder="Ex.: Zezinho"/>
                    </label>
                    <br />
                    <br />
                    {itensEntregaForm.map((item, indice) => {
            const modelosDisponiveis = modelosAcessorio.filter(modelo => modelo.tipo === item.tipo_acessorio);
            return (<fieldset key={item.chave} disabled={salvandoEntrega}>
                          <legend>Rádio {indice + 1}</legend>
                          <label>
                            Número do rádio:
                            <br />
                            <input type="text" value={item.numero_radio} onChange={event => atualizarItemEntrega(item.chave, {
                    numero_radio: event.target.value,
                })} placeholder="Ex.: 01"/>
                          </label>
                          <br />
                          <br />
                          <label>
                            Acessório:
                            <br />
                            <select value={item.tipo_acessorio} onChange={event => alterarTipoAcessorio(item.chave, event.target.value as ItemEntregaRascunho['tipo_acessorio'])}>
                              <option value="sem_acessorio">Sem acessório</option>
                              <option value="fone">Fone</option>
                              <option value="mike">Mike</option>
                            </select>
                          </label>
                          {item.tipo_acessorio !== 'sem_acessorio' && (<>
                              <br />
                              <br />
                              <label>
                                Modelo:
                                <br />
                                <select value={item.modelo_acessorio_id} onChange={event => atualizarItemEntrega(item.chave, {
                        modelo_acessorio_id: event.target.value,
                    })}>
                                  <option value="">Selecione o modelo</option>
                                  {modelosDisponiveis.map(modelo => (<option key={modelo.id} value={modelo.id}>
                                      {modelo.nome}
                                    </option>))}
                                </select>
                              </label>
                            </>)}
                          <br />
                          <br />
                          <label>
                            Observação do rádio:
                            <br />
                            <input type="text" value={item.observacao} onChange={event => atualizarItemEntrega(item.chave, {
                    observacao: event.target.value,
                })} placeholder="Opcional"/>
                          </label>
                          {itensEntregaForm.length > 1 && (<>
                              <br />
                              <br />
                              <button type="button" onClick={() => removerItemEntrega(item.chave)}>
                                Remover rádio
                              </button>
                            </>)}
                        </fieldset>);
        })}
                    <br />
                    <button type="button" onClick={adicionarItemEntrega} disabled={salvandoEntrega}>
                      + Adicionar rádio
                    </button>
                    <br />
                    <br />
                    <label>
                      Observação geral da entrega:
                      <br />
                      <textarea value={observacaoEntrega} disabled={salvandoEntrega} onChange={event => setObservacaoEntrega(event.target.value)} placeholder="Opcional"/>
                    </label>
                    <br />
                    <br />
                    <button type="button" onClick={() => void registrarEntrega()} disabled={salvandoEntrega}>
                      {salvandoEntrega ? 'Salvando entrega...' : 'Salvar entrega'}
                    </button>{' '}
                    <button type="button" onClick={cancelarEntrega} disabled={salvandoEntrega}>
                      Cancelar
                    </button>
                  </div>);
}
