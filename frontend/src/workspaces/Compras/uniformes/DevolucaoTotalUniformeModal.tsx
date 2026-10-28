import React, { useState } from 'react';
import { getComprasErrorMessage } from '../../../hooks/useCompras';
import { useRegistrarDevolucaoTotalUniforme, useUniformesEmPosse } from '../../../hooks/useUniformes';
import type { DevolucaoTotalUniformeResultado } from '../../../types/domain';
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
  ['qtdPerdida', 'Não devolvidas', 'perdidas / extraviadas'],
];
const soma = (q: Qtds) => q.qtdBoa + q.qtdDanificada + q.qtdPerdida;

const DevolucaoTotalUniformeModal: React.FC<{ colaboradorIdInicial?: string; onClose: () => void }> = ({
  colaboradorIdInicial = '', onClose,
}) => {
  const [colaboradorId, setColaboradorId] = useState(colaboradorIdInicial);
  const [dataDevolucao, setDataDevolucao] = useState(todayIso());
  const [observacoes, setObservacoes] = useState('');
  const [emailDestino, setEmailDestino] = useState('');
  const [qtds, setQtds] = useState<Record<string, Qtds>>({});
  const [resultado, setResultado] = useState<DevolucaoTotalUniformeResultado | null>(null);

  const emPosseQuery = useUniformesEmPosse(colaboradorId);
  const registrar = useRegistrarDevolucaoTotalUniforme();
  const itens = emPosseQuery.data ?? [];
  const totalComEle = itens.reduce((acc, i) => acc + i.pendente, 0);
  const totalInformado = itens.reduce((acc, i) => acc + soma(qtds[i.id] ?? VAZIO), 0);
  const faltam = totalComEle - totalInformado;
  const temPerda = itens.some((i) => (qtds[i.id]?.qtdPerdida ?? 0) > 0);
  const termos = new Set(itens.map((i) => i.entregaNumero));

  const atualizar = (itemId: string, campo: keyof Qtds, valor: number) =>
    setQtds((atual) => ({ ...atual, [itemId]: { ...(atual[itemId] ?? VAZIO), [campo]: Math.max(0, valor) } }));

  const preencherTudo = (campo: keyof Qtds) =>
    setQtds(Object.fromEntries(itens.map((i) => [i.id, { ...VAZIO, [campo]: i.pendente }])));

  const confirmar = () => {
    const divergente = itens.find((i) => soma(qtds[i.id] ?? VAZIO) !== i.pendente);
    if (divergente) {
      alert(`Informe o destino de todas as peças de "${divergente.uniformeNome} ${divergente.uniformeTamanho}" (${divergente.pendente}).`);
      return;
    }
    if (temPerda && !observacoes.trim()) {
      alert('Explique na observação o motivo das peças não devolvidas.');
      return;
    }
    const email = emailDestino.trim();
    if (!email || !email.includes('@')) {
      alert('Informe o e-mail que vai receber o aviso.');
      return;
    }
    registrar.mutate(
      {
        colaboradorId,
        dataDevolucao,
        observacoes: observacoes.trim(),
        emailDestino: email,
        itens: itens.map((i) => ({ entregaItemId: i.id, ...(qtds[i.id] ?? VAZIO), qtdSemCondicoes: 0 })),
      },
      { onSuccess: setResultado },
    );
  };

  if (resultado) {
    return (
      <ModalUniformes title="Devolução total registrada" width={480} onClose={onClose}>
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <i className="bi bi-check-circle" style={{ fontSize: '34px', color: '#10b981' }} aria-hidden="true" />
          <p style={{ margin: '10px 0 4px', fontSize: '15px', fontWeight: 600, color: '#1e293b' }}>
            {resultado.totalPecas} peça(s) baixadas
          </p>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
            Termos encerrados: {resultado.termos.join(', ')}. O colaborador não tem mais uniformes pendentes.
            {resultado.emailAviso && (
              resultado.emailEnviado
                ? ` O aviso foi enviado para ${resultado.emailAviso}.`
                : ` A devolução foi registrada, mas o aviso não saiu para ${resultado.emailAviso}.`
            )}
          </p>
        </div>
      </ModalUniformes>
    );
  }

  const podeConfirmar = colaboradorId && itens.length > 0;

  return (
    <ModalUniformes
      title="Devolução total"
      width={1080}
      submitLabel={faltam > 0 ? `Faltam ${faltam} peça(s)` : 'Confirmar devolução total'}
      isPending={registrar.isPending}
      error={registrar.isError ? getComprasErrorMessage(registrar.error, 'Não foi possível registrar a devolução.') : null}
      onClose={onClose}
      onSubmit={podeConfirmar ? confirmar : undefined}
    >
      <div className="form-grid two-cols" style={{ gridTemplateColumns: '1fr 180px' }}>
        <label>
          Colaborador
          <ColaboradorPicker
            id="uniforme-devolucao-total-colaborador"
            value={colaboradorId}
            autoFocus={!colaboradorIdInicial}
            onChange={(id) => { setColaboradorId(id); setQtds({}); }}
          />
        </label>
        <label>
          Data da devolução
          <input className="form-input" type="date" required value={dataDevolucao} onChange={(e) => setDataDevolucao(e.target.value)} />
        </label>
      </div>

      {colaboradorId && emPosseQuery.isLoading && (
        <p style={{ fontSize: '13px', color: '#94a3b8', margin: '12px 0 0' }}>Carregando uniformes...</p>
      )}
      {colaboradorId && !emPosseQuery.isLoading && itens.length === 0 && (
        <Dica>Este colaborador não tem nenhum uniforme pendente. Nada a devolver.</Dica>
      )}

      {itens.length > 0 && (
        <>
          <SecaoTitulo
            acao={
              <div style={{ display: 'flex', gap: '6px' }}>
                <button type="button" className="reports-action-btn secondary" style={{ height: '30px', fontSize: '12px', padding: '0 12px' }} onClick={() => preencherTudo('qtdBoa')}>
                  <i className="bi bi-check2-all" /> Tudo voltou bom
                </button>
                <button type="button" className="reports-action-btn secondary" style={{ height: '30px', fontSize: '12px', padding: '0 12px' }} onClick={() => preencherTudo('qtdPerdida')}>
                  Nada foi devolvido
                </button>
              </div>
            }
          >
            {totalComEle} peça(s) em {termos.size} termo(s)
          </SecaoTitulo>

          <div style={{ maxHeight: 'min(460px, 50vh)', overflowY: 'auto' }}>
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
                  <th className="num" style={{ textAlign: 'right' }}>Falta</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((item) => {
                  const q = qtds[item.id] ?? VAZIO;
                  const falta = item.pendente - soma(q);
                  return (
                    <tr key={item.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{item.uniformeNome} — {item.uniformeTamanho}</div>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '11px', color: '#94a3b8' }}>
                          <CondicaoBadge condicao={item.condicao} />
                          Termo {item.entregaNumero} · {formatDateBr(item.dataEntrega)}
                        </div>
                      </td>
                      <td className="num" style={{ textAlign: 'right', fontWeight: 700 }}>{item.pendente}</td>
                      {COLUNAS.map(([campo]) => (
                        <td key={campo}>
                          <input
                            type="number"
                            min={0}
                            max={item.pendente}
                            placeholder="0"
                            style={{ ...inputCelula, textAlign: 'right' }}
                            value={q[campo] || ''}
                            onChange={(e) => atualizar(item.id, campo, parseInt(e.target.value) || 0)}
                          />
                        </td>
                      ))}
                      <td
                        className="num"
                        style={{ textAlign: 'right', fontWeight: 700, color: falta === 0 ? '#10b981' : '#ef4444' }}
                      >
                        {falta === 0 ? <i className="bi bi-check-lg" /> : falta < 0 ? 'Excedeu' : falta}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <label style={{ display: 'block', marginTop: '12px' }}>
            {temPerda ? 'Motivo das peças não devolvidas (obrigatório)' : 'Observações (opcional)'}
            <textarea
              className="form-input"
              rows={2}
              value={observacoes}
              placeholder={temPerda ? 'Ex: colaborador informou que extraviou 2 camisetas' : ''}
              onChange={(e) => setObservacoes(e.target.value)}
            />
          </label>
          <AvisoEmail
            id="uniforme-devolucao-total-email"
            value={emailDestino}
            onChange={setEmailDestino}
            texto="Obrigatório. O aviso leva todas as peças desta baixa e o termo de cada entrega em PDF."
          />
          <Dica>
            Na devolução total todas as peças precisam ter destino. Uma devolução é registrada em cada termo e todos são encerrados.
          </Dica>
        </>
      )}
    </ModalUniformes>
  );
};

export default DevolucaoTotalUniformeModal;
