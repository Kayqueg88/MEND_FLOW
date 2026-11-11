import type { MovimentacaoEquipamento } from './tipos-evento';
import { formatarData, descricaoAcessorio, traduzirSituacao } from './formatacao-evento';
type Props = {
    movimentacoes: MovimentacaoEquipamento[];
    setMostrarHistorico: (valor: boolean) => void;
};
export function HistoricoMovimentacoes({ movimentacoes, setMostrarHistorico }: Props) {
    return (<div id="historico-movimentacoes" style={{ marginTop: '20px' }}>
                <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
            marginBottom: '12px',
        }}>
                  <div>
                    <h3 style={{ marginBottom: '4px' }}>Histórico de movimentações</h3>
                    <p style={{ marginTop: 0 }}>
                      {movimentacoes.length} movimentação(ões) registrada(s) neste pedido.
                    </p>
                  </div>
                  <button type="button" onClick={() => setMostrarHistorico(false)}>
                    Fechar histórico
                  </button>
                </div>
                {movimentacoes.length === 0 ? (<p>Nenhuma movimentação registrada neste pedido.</p>) : (<div style={{ display: 'grid', gap: '12px' }}>
                    {[...movimentacoes]
                .sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime())
                .map(movimentacao => (<article key={movimentacao.id} style={{
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    padding: '14px',
                }}>
                          <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '12px',
                    flexWrap: 'wrap',
                    alignItems: 'flex-start',
                }}>
                            <div>
                              <strong>
                                {movimentacao.tipo === 'entrega' ? 'ENTREGA' : 'DEVOLUÇÃO'}
                              </strong>
                              <div>
                                {movimentacao.pessoa_nome} · {movimentacao.itens.length} rádio(s)
                              </div>
                            </div>
                            <small>{formatarData(movimentacao.criado_em)}</small>
                          </div>
                          <p style={{ marginBottom: '6px' }}>
                            <strong>Registrado por:</strong>{' '}
                            {movimentacao.tecnico?.nome ?? 'Usuário não identificado'}
                          </p>
                          {movimentacao.observacao && (<p style={{ marginTop: 0 }}>
                              <strong>Observação:</strong> {movimentacao.observacao}
                            </p>)}
                          <details>
                            <summary style={{ cursor: 'pointer' }}>
                              Ver {movimentacao.itens.length} rádio(s)
                            </summary>
                            {movimentacao.itens.length === 0 ? (<p>Nenhum rádio registrado nesta movimentação.</p>) : (<div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(min(210px, 100%), 1fr))',
                        gap: '10px',
                        marginTop: '12px',
                    }}>
                                {movimentacao.itens.map(item => (<div key={item.id} style={{
                            border: '1px solid var(--border)',
                            borderRadius: '10px',
                            padding: '10px',
                        }}>
                                    <div>
                                      <strong>Rádio {item.numero_radio}</strong>
                                    </div>
                                    <div>{descricaoAcessorio(item)}</div>
                                    {movimentacao.tipo === 'devolucao' && (<div style={{ marginTop: '8px' }}>
                                        <div>
                                          Rádio: {traduzirSituacao(item.situacao_radio)}
                                        </div>
                                        <div>
                                          Acessório: {traduzirSituacao(item.situacao_acessorio)}
                                        </div>
                                      </div>)}
                                    {item.observacao && (<div style={{ marginTop: '8px' }}>
                                        Observação: {item.observacao}
                                      </div>)}
                                  </div>))}
                              </div>)}
                          </details>
                        </article>))}
                  </div>)}
              </div>);
}
