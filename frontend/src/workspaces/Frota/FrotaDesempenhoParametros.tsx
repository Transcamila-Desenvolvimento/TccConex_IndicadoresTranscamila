import React, { useEffect, useState } from 'react';
import QueryDataPanel from '../../components/QueryDataPanel';
import { userHasFuncao } from '../../constants/funcoes';
import { useAuth } from '../../contexts/AuthContext';
import { getFrotaErrorMessage, useParametrosDesempenho, useSalvarParametrosDesempenho } from '../../hooks/useFrotaDesempenho';
import type { FaixaBonificacao, FaixaBonificacaoModo, ParametroBonificacao } from '../../types/domain';

const MODOS: { valor: FaixaBonificacaoModo; rotulo: string }[] = [
  { valor: 'integral', rotulo: '100% do bônus' },
  { valor: 'proporcional', rotulo: 'Proporcional à nota' },
  { valor: 'percentual', rotulo: 'Percentual fixo' },
  { valor: 'zero', rotulo: 'Sem bônus' },
];

const FrotaDesempenhoParametros: React.FC = () => {
  const { user } = useAuth();
  const podeAlterar = userHasFuncao(user, 'Frota', 'alterar-parametros-desempenho');
  const consulta = useParametrosDesempenho();
  const salvar = useSalvarParametrosDesempenho();
  const [form, setForm] = useState<ParametroBonificacao | null>(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (consulta.data) setForm(structuredClone(consulta.data));
  }, [consulta.data]);

  const atualizarFaixa = (indice: number, campo: keyof FaixaBonificacao, valor: string) => {
    setForm((atual) => {
      if (!atual) return atual;
      const faixas = atual.faixas.map((faixa, posicao) => posicao === indice ? { ...faixa, [campo]: valor } : faixa);
      return { ...atual, faixas };
    });
  };

  const enviar = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form) return;
    setErro('');
    try {
      await salvar.mutateAsync(form);
    } catch (falha) {
      setErro(getFrotaErrorMessage(falha));
    }
  };

  return (
    <div className="desempenho-page">
      <header className="desempenho-head">
        <div>
          <h1 className="view-page-title">Parâmetros</h1>
          <p className="desempenho-lead">
            A nota do mês parte do valor inicial. Cada faixa define a parte do bônus que o motorista recebe.
          </p>
        </div>
        {podeAlterar && (
          <button type="submit" form="parametros-bonificacao" className="reports-action-btn primary" disabled={!form || salvar.isPending}>
            Salvar parâmetros
          </button>
        )}
      </header>
      <QueryDataPanel query={consulta} loadingMessage="Carregando parâmetros..." errorMessage="Não foi possível carregar os parâmetros.">
        {form && (
          <form id="parametros-bonificacao" onSubmit={enviar} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            <section className="desempenho-secao">
              <header className="desempenho-secao-head">
                <h2>Base do cálculo</h2>
              </header>
              <div className="desempenho-base">
                <label className="desempenho-field">
                  <span>Nota inicial</span>
                  <input type="text" value={form.notaInicial} readOnly={!podeAlterar} onChange={(event) => setForm({ ...form, notaInicial: event.target.value })} />
                </label>
                <label className="desempenho-field">
                  <span>Valor do bônus</span>
                  <input type="text" value={form.valorBonus} readOnly={!podeAlterar} onChange={(event) => setForm({ ...form, valorBonus: event.target.value })} />
                </label>
              </div>
            </section>

            <section className="desempenho-secao">
              <header className="desempenho-secao-head">
                <h2>Faixas de pagamento</h2>
                {podeAlterar && (
                  <button
                    type="button"
                    className="desempenho-link"
                    onClick={() => setForm({ ...form, faixas: [...form.faixas, { notaMin: '0', notaMax: '0', modo: 'zero', percentual: '0' }] })}
                  >
                    Adicionar faixa
                  </button>
                )}
              </header>
              <div className="desempenho-faixas">
                <span>De</span>
                <span>Até</span>
                <span>Pagamento</span>
                <span>Percentual</span>
                <span />
                {form.faixas.map((faixa, indice) => (
                  <React.Fragment key={`${faixa.id ?? 'nova'}-${indice}`}>
                    <input aria-label="Nota mínima" type="text" value={faixa.notaMin} readOnly={!podeAlterar} onChange={(event) => atualizarFaixa(indice, 'notaMin', event.target.value)} />
                    <input aria-label="Nota máxima" type="text" value={faixa.notaMax} readOnly={!podeAlterar} onChange={(event) => atualizarFaixa(indice, 'notaMax', event.target.value)} />
                    <select aria-label="Pagamento" value={faixa.modo} disabled={!podeAlterar} onChange={(event) => atualizarFaixa(indice, 'modo', event.target.value)}>
                      {MODOS.map((modo) => <option key={modo.valor} value={modo.valor}>{modo.rotulo}</option>)}
                    </select>
                    {faixa.modo === 'percentual' ? (
                      <input aria-label="Percentual" type="text" value={faixa.percentual} readOnly={!podeAlterar} onChange={(event) => atualizarFaixa(indice, 'percentual', event.target.value)} />
                    ) : (
                      <div className="desempenho-traco">—</div>
                    )}
                    {podeAlterar ? (
                      <button
                        type="button"
                        className="desempenho-icon"
                        aria-label="Remover faixa"
                        onClick={() => setForm({ ...form, faixas: form.faixas.filter((_, posicao) => posicao !== indice) })}
                      >
                        <i className="bi bi-trash" />
                      </button>
                    ) : <span />}
                  </React.Fragment>
                ))}
              </div>
            </section>
            {erro && <p className="desempenho-erro">{erro}</p>}
          </form>
        )}
      </QueryDataPanel>
    </div>
  );
};

export default FrotaDesempenhoParametros;
