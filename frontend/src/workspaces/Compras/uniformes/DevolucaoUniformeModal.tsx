import React, { useMemo, useState } from 'react';
import { getComprasErrorMessage } from '../../../hooks/useCompras';
import { useEntregasUniforme, useRegistrarDevolucaoUniforme } from '../../../hooks/useUniformes';
import type { EntregaUniforme } from '../../../types/domain';
import ColaboradorPicker from './ColaboradorPicker';
import { formatDateBr, inputCelula, todayIso } from './format';
import { AvisoEmail, CondicaoBadge, Dica, ModalUniformes, SecaoTitulo } from './shared';

interface Qtds {
  qtdBoa: number;
  qtdDanificada: number;
  qtdPerdida: number;
}

const VAZIO: Qtds = { qtdBoa: 0, qtdDanificada: 0, qtdPerdida: 0 };
const COLUNAS: Array<[keyof Qtds, string, string]> = [
  ['qtdBoa', 'Voltaram boas', 'voltam ao estoque como usadas'],
  ['qtdDanificada', 'Danificadas', 'vão para descarte'],
  ['qtdPerdida', 'Perdidas', 'não foram devolvidas'],
];

const soma = (q: Qtds) => q.qtdBoa + q.qtdDanificada + q.qtdPerdida;

const CartaoTermo: React.FC<{ entrega: EntregaUniforme; selecionado: boolean; onClick: () => void }> = ({
  entrega, selecionado, onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      textAlign: 'left', padding: '10px 12px', borderRadius: '8px', cursor: 'pointer', width: '100%',
      border: `1.5px solid ${selecionado ? '#0f85c1' : '#e2e8f0'}`, background: selecionado ? '#f0f9ff' : '#ffffff',
    }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
      <strong style={{ color: '#0f85c1' }}>{entrega.numero}</strong>
      <span style={{ color: '#64748b' }}>{formatDateBr(entrega.dataEntrega)}</span>
    </div>
    <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>
      {entrega.itens.filter((i) => i.pendente > 0).map((i) => `${i.pendente}× ${i.uniformeNome} ${i.uniformeTamanho}`).join(', ')}
    </div>
  </button>
);

const DevolucaoUniformeModal: React.FC<{
  entrega?: EntregaUniforme | null;
  onClose: () => void;
  onDevolucaoTotal: (colaboradorId: string) => void;
}> = ({ entrega: entregaInicial, onClose, onDevolucaoTotal }) => {
  const [colaboradorId, setColaboradorId] = useState('');
  const [entregaId, setEntregaId] = useState(entregaInicial?.id ?? '');
  const [dataDevolucao, setDataDevolucao] = useState(todayIso());
  const [observacoes, setObservacoes] = useState('');
  const [emailDestino, setEmailDestino] = useState('');
  const [aviso, setAviso] = useState('');
  const [qtds, setQtds] = useState<Record<string, Qtds>>({});

  const abertasQuery = useEntregasUniforme(
    { page: 1, pageSize: 100, colaboradorId, status: 'abertas' },
    !entregaInicial && Boolean(colaboradorId),
  );
  const registrar = useRegistrarDevolucaoUniforme();
  const abertas = useMemo(() => abertasQuery.data?.results ?? [], [abertasQuery.data]);

  const entrega = entregaInicial ?? abertas.find((e) => e.id === entregaId) ?? (abertas.length === 1 ? abertas[0] : null);
  const itensPendentes = useMemo(() => (entrega?.itens ?? []).filter((i) => i.pendente > 0), [entrega]);
  const temPerda = itensPendentes.some((i) => (qtds[i.id]?.qtdPerdida ?? 0) > 0);
  const totalInformado = itensPendentes.reduce((acc, i) => acc + soma(qtds[i.id] ?? VAZIO), 0);
  const totalPendente = itensPendentes.reduce((acc, i) => acc + i.pendente, 0);

  const atualizar = (itemId: string, campo: keyof Qtds, valor: number) =>
    setQtds((atual) => ({ ...atual, [itemId]: { ...(atual[itemId] ?? VAZIO), [campo]: Math.max(0, valor) } }));

  const devolverTudo = () =>
    setQtds(Object.fromEntries(itensPendentes.map((i) => [i.id, { ...VAZIO, qtdBoa: i.pendente }])));

  const confirmar = () => {
    if (!entrega) {
      alert('Selecione o termo que está sendo devolvido.');
      return;
    }
    const itens = itensPendentes
      .map((i) => ({ entregaItemId: i.id, ...(qtds[i.id] ?? VAZIO), qtdSemCondicoes: 0 }))
      .filter((i) => i.qtdBoa + i.qtdDanificada + i.qtdPerdida > 0);
    if (itens.length === 0) {
      alert('Informe a quantidade de ao menos um item.');
      return;
    }
    const excedido = itensPendentes.find((i) => soma(qtds[i.id] ?? VAZIO) > i.pendente);
    if (excedido) {
      alert(`"${excedido.uniformeNome} (${excedido.uniformeTamanho})" tem só ${excedido.pendente} peça(s) com o colaborador.`);
      return;
    }
    if (temPerda && !observacoes.trim()) {
      alert('Explique na observação o motivo das peças perdidas.');
      return;
    }
    const email = emailDestino.trim();
    if (!email || !email.includes('@')) {
      alert('Informe o e-mail que vai receber o aviso.');
      return;
    }
    registrar.mutate(
      { entregaId: entrega.id, dataDevolucao, observacoes: observacoes.trim(), emailDestino: email, itens },
      {
        onSuccess: (resultado) => {
          setAviso(
            resultado.emailEnviado
              ? `Aviso enviado para ${resultado.emailAviso}.`
              : `A devolução foi registrada, mas o aviso não saiu para ${email}.`,
          );
        },
      },
    );
  };

  if (aviso) {
    return (
      <ModalUniformes title="Devolução registrada" width={480} onClose={onClose}>
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <i className="bi bi-check-circle" style={{ fontSize: '34px', color: '#10b981' }} aria-hidden="true" />
          <p style={{ margin: '10px 0 0', fontSize: '13px', color: '#64748b' }}>{aviso}</p>
        </div>
      </ModalUniformes>
    );
  }

  return (
    <ModalUniformes
      title={entregaInicial ? `Devolução — termo ${entregaInicial.numero}` : 'Registrar devolução'}
      width={980}
      submitLabel="Confirmar devolução"
      isPending={registrar.isPending}
      error={registrar.isError ? getComprasErrorMessage(registrar.error, 'Não foi possível registrar a devolução.') : null}
      onClose={onClose}
      onSubmit={entrega ? confirmar : undefined}
    >
      {!entregaInicial && (
        <>
          <label style={{ display: 'block' }}>
            <span style={{ fontWeight: 600 }}>1. Quem está devolvendo?</span>
            <ColaboradorPicker
              id="uniforme-devolucao-colaborador"
              value={colaboradorId}
              autoFocus
              onChange={(id) => { setColaboradorId(id); setEntregaId(''); setQtds({}); }}
            />
          </label>

          <div
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
              marginTop: '12px', padding: '10px 12px', borderRadius: '8px', background: '#fff7ed', border: '1px solid #fed7aa',
            }}
          >
            <span style={{ fontSize: '12px', color: '#9a3412' }}>
              <i className="bi bi-arrow-return-left" /> <strong>Vai devolver tudo?</strong> Devolva todos os uniformes de todos os termos de uma vez.
            </span>
            <button
              type="button"
              className="reports-action-btn secondary"
              style={{ height: '30px', fontSize: '12px', padding: '0 12px' }}
              onClick={() => onDevolucaoTotal(colaboradorId)}
            >
              Devolução total
            </button>
          </div>

          {colaboradorId && (
            <>
              <SecaoTitulo>2. Qual termo?</SecaoTitulo>
              {abertasQuery.isLoading ? (
                <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>Carregando termos...</p>
              ) : abertas.length === 0 ? (
                <Dica cor="alerta">Este colaborador não tem nenhum uniforme pendente de devolução.</Dica>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px' }}>
                  {abertas.map((e) => (
                    <CartaoTermo
                      key={e.id}
                      entrega={e}
                      selecionado={entrega?.id === e.id}
                      onClick={() => { setEntregaId(e.id); setQtds({}); }}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      {entrega && (
        <>
          {entregaInicial && (
            <p style={{ margin: 0, fontSize: '13px', color: '#475569' }}>
              <strong>{entrega.colaboradorNome}</strong> · entregue em {formatDateBr(entrega.dataEntrega)}
            </p>
          )}

          <SecaoTitulo
            acao={
              <button type="button" className="reports-action-btn secondary" style={{ height: '30px', fontSize: '12px', padding: '0 12px' }} onClick={devolverTudo}>
                <i className="bi bi-check2-all" /> Devolveu tudo em bom estado
              </button>
            }
          >
            {entregaInicial ? 'O que voltou?' : '3. O que voltou?'}
          </SecaoTitulo>

          <div style={{ maxHeight: 'min(420px, 45vh)', overflowY: 'auto' }}>
            <table className="reports-table">
              <thead>
                <tr>
                  <th>Uniforme</th>
                  <th className="num" style={{ textAlign: 'right' }}>Com ele</th>
                  {COLUNAS.map(([campo, label, dica]) => (
                    <th key={campo} className="num" style={{ width: '120px', whiteSpace: 'normal', verticalAlign: 'top' }}>
                      {label}
                      <div style={{ fontSize: '10px', fontWeight: 400, color: '#94a3b8', textTransform: 'none' }}>{dica}</div>
                    </th>
                  ))}
                  <th className="num" style={{ textAlign: 'right' }}>Continua com ele</th>
                </tr>
              </thead>
              <tbody>
                {itensPendentes.map((item) => {
                  const q = qtds[item.id] ?? VAZIO;
                  const restara = item.pendente - soma(q);
                  return (
                    <tr key={item.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{item.uniformeNome} — {item.uniformeTamanho}</div>
                        <CondicaoBadge condicao={item.condicao} />
                      </td>
                      <td className="num" style={{ textAlign: 'right', fontWeight: 700 }}>{item.pendente}</td>
                      {COLUNAS.map(([campo]) => (
                        <td key={campo}>
                          <input
                            type="number"
                            min={0}
                            max={item.pendente}
                            style={{ ...inputCelula, textAlign: 'right' }}
                            value={q[campo] || ''}
                            placeholder="0"
                            onChange={(e) => atualizar(item.id, campo, parseInt(e.target.value) || 0)}
                          />
                        </td>
                      ))}
                      <td className="num" style={{ textAlign: 'right', fontWeight: 700, color: restara < 0 ? '#ef4444' : '#64748b' }}>
                        {restara < 0 ? 'Excedeu' : restara}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalInformado > 0 && totalInformado < totalPendente && (
            <Dica>
              {totalPendente - totalInformado} peça(s) continuarão com o colaborador e poderão ser devolvidas depois.
            </Dica>
          )}

          <div className="form-grid two-cols" style={{ gridTemplateColumns: '180px 1fr', marginTop: '12px' }}>
            <label>
              Data da devolução
              <input className="form-input" type="date" required value={dataDevolucao} onChange={(e) => setDataDevolucao(e.target.value)} />
            </label>
            <label>
              {temPerda ? 'Motivo da perda (obrigatório)' : 'Observações (opcional)'}
              <textarea
                className="form-input"
                rows={2}
                value={observacoes}
                placeholder={temPerda ? 'Ex: colaborador informou que extraviou 2 camisetas' : ''}
                onChange={(e) => setObservacoes(e.target.value)}
              />
            </label>
          </div>
          <AvisoEmail
            id="uniforme-devolucao-email"
            value={emailDestino}
            onChange={setEmailDestino}
            texto="Obrigatório. O aviso leva o que foi devolvido e o termo em PDF."
          />
        </>
      )}
    </ModalUniformes>
  );
};

export default DevolucaoUniformeModal;
