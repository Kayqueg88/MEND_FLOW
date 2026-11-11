import type { ItemDevolucaoRascunho, SituacaoRadio, SituacaoAcessorio } from './tipos-evento';
import { descricaoAcessorio } from './formatacao-evento';
type Props = {
    erroDevolucao: string;
    pessoaDevolucao: string;
    salvandoDevolucao: boolean;
    setPessoaDevolucao: (valor: string) => void;
    itensDevolucaoForm: ItemDevolucaoRascunho[];
    atualizarItemDevolucao: (id: string, alteracoes: Partial<ItemDevolucaoRascunho>) => void;
    observacaoDevolucao: string;
    setObservacaoDevolucao: (valor: string) => void;
    registrarDevolucao: () => Promise<void>;
    cancelarDevolucao: () => void;
};
export function FormularioDevolucao({ erroDevolucao, pessoaDevolucao, salvandoDevolucao, setPessoaDevolucao, itensDevolucaoForm, atualizarItemDevolucao, observacaoDevolucao, setObservacaoDevolucao, registrarDevolucao, cancelarDevolucao }: Props) {
    return (<div>
                    <hr />
                    <h3>Registrar devolução de equipamentos</h3>
                    {erroDevolucao && <p role="alert">{erroDevolucao}</p>}
                    <label>
                      Quem devolveu os equipamentos:
                      <br />
                      <input type="text" value={pessoaDevolucao} disabled={salvandoDevolucao} onChange={event => setPessoaDevolucao(event.target.value)} placeholder="Ex.: Eduardo"/>
                    </label>
                    <p>
                      Selecione somente os rádios que estão sendo devolvidos agora.
                    </p>
                    {itensDevolucaoForm.map(item => (<fieldset key={item.item_entrega_origem_id} disabled={salvandoDevolucao} style={{ marginBottom: '12px' }}>
                        <legend>
                          <label>
                            <input type="checkbox" checked={item.selecionado} onChange={event => atualizarItemDevolucao(item.item_entrega_origem_id, {
                selecionado: event.target.checked,
            })}/>{' '}
                            Rádio {item.numero_radio} — {descricaoAcessorio(item)}
                          </label>
                        </legend>
                        {item.selecionado && (<>
                            <label>
                              Situação do rádio:
                              <br />
                              <select value={item.situacao_radio} onChange={event => atualizarItemDevolucao(item.item_entrega_origem_id, {
                    situacao_radio: event.target.value as SituacaoRadio,
                })}>
                                <option value="devolvido">Devolvido</option>
                                <option value="danificado">Danificado</option>
                                <option value="perdido">Perdido</option>
                              </select>
                            </label>
                            {item.tipo_acessorio !== 'sem_acessorio' && (<>
                                <br />
                                <br />
                                <label>
                                  Situação do acessório:
                                  <br />
                                  <select value={item.situacao_acessorio} onChange={event => atualizarItemDevolucao(item.item_entrega_origem_id, {
                        situacao_acessorio: event.target.value as SituacaoAcessorio,
                    })}>
                                    <option value="devolvido">Devolvido</option>
                                    <option value="danificado">Danificado</option>
                                    <option value="perdido">Perdido</option>
                                  </select>
                                </label>
                              </>)}
                            <br />
                            <br />
                            <label>
                              Observação:
                              <br />
                              <input type="text" value={item.observacao} onChange={event => atualizarItemDevolucao(item.item_entrega_origem_id, {
                    observacao: event.target.value,
                })} placeholder="Opcional"/>
                            </label>
                          </>)}
                      </fieldset>))}
                    <label>
                      Observação geral da devolução:
                      <br />
                      <textarea value={observacaoDevolucao} disabled={salvandoDevolucao} onChange={event => setObservacaoDevolucao(event.target.value)} placeholder="Opcional"/>
                    </label>
                    <br />
                    <br />
                    <button type="button" onClick={() => void registrarDevolucao()} disabled={salvandoDevolucao}>
                      {salvandoDevolucao ? 'Salvando devolução...' : 'Salvar devolução'}
                    </button>{' '}
                    <button type="button" onClick={cancelarDevolucao} disabled={salvandoDevolucao}>
                      Cancelar
                    </button>
                  </div>);
}
