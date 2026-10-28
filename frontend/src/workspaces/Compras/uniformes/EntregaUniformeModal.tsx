import React, { useMemo, useState } from 'react';
import { getComprasErrorMessage } from '../../../hooks/useCompras';
import { useRegistrarEntregaUniforme, useUniformes } from '../../../hooks/useUniformes';
import type { CondicaoUniforme, EntregaUniforme, Uniforme } from '../../../types/domain';
import ColaboradorPicker from './ColaboradorPicker';
import { compararTamanho, normalizarBusca, todayIso } from './format';
import { AvisoEmail, Dica, ModalUniformes, SecaoTitulo } from './shared';
import { baixarTermoUniforme, imprimirTermoUniforme } from './termoUniformePdf';

interface Linha {
  uniformeId: string;
  condicao: CondicaoUniforme;
  quantidade: number;
}

const disponivel = (u: Uniforme | undefined, condicao: CondicaoUniforme) =>
  !u ? 0 : condicao === 'novo' ? u.qtdNova : u.qtdUsada;

const botaoPasso: React.CSSProperties = {
  width: '28px', height: '28px', border: '1px solid #e2e8f0', background: '#ffffff', borderRadius: '6px',
  cursor: 'pointer', fontWeight: 700, color: '#475569', lineHeight: 1,
};

const Catalogo: React.FC<{ uniformes: Uniforme[]; carregando: boolean; onEscolher: (u: Uniforme) => void }> = ({
  uniformes, carregando, onEscolher,
}) => {
  const [busca, setBusca] = useState('');
  const grupos = useMemo(() => {
    const termo = normalizarBusca(busca.trim());
    const mapa = new Map<string, Uniforme[]>();
    uniformes
      .filter((u) => !termo || normalizarBusca(`${u.nome} ${u.tamanho}`).includes(termo))
      .forEach((u) => mapa.set(u.nome, [...(mapa.get(u.nome) ?? []), u]));
    return [...mapa.entries()]
      .map(([nome, lista]) => [nome, lista.sort((a, b) => compararTamanho(a.tamanho, b.tamanho))] as const)
      .sort((a, b) => a[0].localeCompare(b[0]));
  }, [uniformes, busca]);

  return (
    <div>
      <input
        className="form-input"
        placeholder="Filtrar itens..."
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        style={{ marginBottom: '8px' }}
      />
      <div style={{ maxHeight: 'min(440px, 50vh)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {carregando && <span style={{ fontSize: '13px', color: '#94a3b8' }}>Carregando...</span>}
        {!carregando && grupos.length === 0 && <span style={{ fontSize: '13px', color: '#94a3b8' }}>Nenhum item encontrado.</span>}
        {grupos.map(([nome, tamanhos]) => (
          <div key={nome}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', marginBottom: '4px' }}>{nome}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {tamanhos.map((u) => {
                const total = u.qtdNova + u.qtdUsada;
                return (
                  <button
                    key={u.id}
                    type="button"
                    disabled={total === 0}
                    title={total === 0 ? 'Sem estoque' : `${u.qtdNova} novas · ${u.qtdUsada} usadas`}
                    onClick={() => onEscolher(u)}
                    style={{
                      padding: '5px 10px', borderRadius: '8px', fontSize: '12px', cursor: total === 0 ? 'not-allowed' : 'pointer',
                      border: '1px solid #e2e8f0', background: total === 0 ? '#f8fafc' : '#ffffff',
                      color: total === 0 ? '#cbd5e1' : '#1e293b', fontWeight: 700,
                    }}
                  >
                    {u.tamanho}
                    <span style={{ marginLeft: '6px', fontWeight: 400, color: total === 0 ? '#cbd5e1' : '#64748b' }}>{total}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const EntregaUniformeModal: React.FC<{ colaboradorIdInicial?: string; onClose: () => void }> = ({
  colaboradorIdInicial = '', onClose,
}) => {
  const [colaboradorId, setColaboradorId] = useState(colaboradorIdInicial);
  const [dataEntrega, setDataEntrega] = useState(todayIso());
  const [observacoes, setObservacoes] = useState('');
  const [emailDestino, setEmailDestino] = useState('');
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [registrada, setRegistrada] = useState<EntregaUniforme | null>(null);

  const uniformesQuery = useUniformes();
  const registrar = useRegistrarEntregaUniforme();
  const uniformes = useMemo(() => uniformesQuery.data ?? [], [uniformesQuery.data]);
  const porId = useMemo(() => new Map(uniformes.map((u) => [u.id, u])), [uniformes]);
  const totalPecas = linhas.reduce((acc, l) => acc + l.quantidade, 0);

  const escolher = (u: Uniforme) => {
    const condicao: CondicaoUniforme = u.qtdNova > 0 ? 'novo' : 'usado';
    setLinhas((atual) => {
      const existente = atual.findIndex((l) => l.uniformeId === u.id && l.condicao === condicao);
      if (existente >= 0) {
        return atual.map((l, i) => (i === existente ? { ...l, quantidade: l.quantidade + 1 } : l));
      }
      return [...atual, { uniformeId: u.id, condicao, quantidade: 1 }];
    });
  };

  const atualizar = (index: number, patch: Partial<Linha>) =>
    setLinhas((atual) => atual.map((l, i) => (i === index ? { ...l, ...patch } : l)));

  const mudarCondicao = (index: number, condicao: CondicaoUniforme) =>
    setLinhas((atual) => {
      const linha = atual[index];
      const outra = atual.findIndex((l, i) => i !== index && l.uniformeId === linha.uniformeId && l.condicao === condicao);
      if (outra < 0) return atual.map((l, i) => (i === index ? { ...l, condicao } : l));
      return atual
        .map((l, i) => (i === outra ? { ...l, quantidade: l.quantidade + linha.quantidade } : l))
        .filter((_, i) => i !== index);
    });

  const confirmar = () => {
    if (!colaboradorId) {
      alert('Escolha quem vai receber os uniformes.');
      return;
    }
    if (linhas.length === 0) {
      alert('Escolha ao menos uma peça.');
      return;
    }
    const excedida = linhas.find((l) => l.quantidade > disponivel(porId.get(l.uniformeId), l.condicao));
    if (excedida) {
      const u = porId.get(excedida.uniformeId);
      alert(`Não há ${excedida.quantidade} peça(s) ${excedida.condicao === 'novo' ? 'novas' : 'usadas'} de ${u?.nome} ${u?.tamanho}.`);
      return;
    }
    const email = emailDestino.trim();
    if (!email || !email.includes('@')) {
      alert('Informe o e-mail que vai receber o aviso.');
      return;
    }
    registrar.mutate(
      { colaboradorId, dataEntrega, observacoes: observacoes.trim(), emailDestino: email, itens: linhas },
      { onSuccess: (entrega) => setRegistrada(entrega) },
    );
  };

  if (registrada) {
    return (
      <ModalUniformes
        title="Entrega registrada"
        width={480}
        onClose={onClose}
        footerExtra={
          <>
            <button type="button" className="reports-action-btn secondary" onClick={() => void baixarTermoUniforme(registrada)}>
              <i className="bi bi-download" /> Baixar PDF
            </button>
            <button type="button" className="reports-action-btn primary" onClick={() => void imprimirTermoUniforme(registrada)}>
              <i className="bi bi-printer" /> Imprimir termo
            </button>
          </>
        }
      >
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <i className="bi bi-check-circle" style={{ fontSize: '34px', color: '#10b981' }} aria-hidden="true" />
          <p style={{ margin: '10px 0 4px', fontSize: '15px', fontWeight: 600, color: '#1e293b' }}>
            Termo {registrada.numero}
          </p>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
            {registrada.totalEntregue} peça(s) entregue(s) para {registrada.colaboradorNome}. O estoque já foi atualizado.
            Imprima o termo para o colaborador assinar.
            {registrada.emailAviso && (
              registrada.emailEnviado
                ? ` O aviso foi enviado para ${registrada.emailAviso}.`
                : ` A entrega foi registrada, mas o aviso não saiu para ${registrada.emailAviso}.`
            )}
          </p>
        </div>
      </ModalUniformes>
    );
  }

  return (
    <ModalUniformes
      title="Entregar uniforme"
      width={1180}
      submitLabel={totalPecas ? `Confirmar entrega (${totalPecas} peça${totalPecas === 1 ? '' : 's'})` : 'Confirmar entrega'}
      isPending={registrar.isPending}
      error={registrar.isError ? getComprasErrorMessage(registrar.error, 'Não foi possível registrar a entrega.') : null}
      onClose={onClose}
      onSubmit={confirmar}
    >
      <div className="form-grid two-cols" style={{ gridTemplateColumns: '1fr 180px' }}>
        <label>
          Quem vai receber?
          <ColaboradorPicker id="uniforme-entrega-colaborador" value={colaboradorId} onChange={setColaboradorId} autoFocus={!colaboradorIdInicial} />
        </label>
        <label>
          Data da entrega
          <input className="form-input" type="date" required value={dataEntrega} onChange={(e) => setDataEntrega(e.target.value)} />
        </label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        <div>
          <SecaoTitulo>Clique no tamanho para adicionar</SecaoTitulo>
          <Catalogo uniformes={uniformes} carregando={uniformesQuery.isLoading} onEscolher={escolher} />
        </div>

        <div>
          <SecaoTitulo>Nesta entrega</SecaoTitulo>
          {linhas.length === 0 ? (
            <div style={{ border: '1.5px dashed #e2e8f0', borderRadius: '8px', padding: '28px 16px', textAlign: 'center', fontSize: '13px', color: '#94a3b8' }}>
              Nenhuma peça ainda. Escolha os tamanhos ao lado.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: 'min(440px, 50vh)', overflowY: 'auto' }}>
              {linhas.map((linha, index) => {
                const u = porId.get(linha.uniformeId);
                const saldo = disponivel(u, linha.condicao);
                const excede = linha.quantidade > saldo;
                return (
                  <div
                    key={`${linha.uniformeId}-${linha.condicao}`}
                    style={{ border: `1px solid ${excede ? '#fecaca' : '#e2e8f0'}`, borderRadius: '8px', padding: '10px 12px', background: excede ? '#fef2f2' : '#ffffff' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                      <div style={{ fontWeight: 600, fontSize: '13px', color: '#1e293b' }}>
                        {u?.nome} <span style={{ color: '#0f85c1' }}>— {u?.tamanho}</span>
                      </div>
                      <button type="button" className="btn-icon" title="Remover" onClick={() => setLinhas(linhas.filter((_, i) => i !== index))}>
                        <i className="bi bi-x-lg" />
                      </button>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', gap: '8px', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {(['novo', 'usado'] as const).map((c) => {
                          const ativo = linha.condicao === c;
                          const qtd = disponivel(u, c);
                          return (
                            <button
                              key={c}
                              type="button"
                              disabled={qtd === 0 && !ativo}
                              onClick={() => mudarCondicao(index, c)}
                              style={{
                                padding: '3px 9px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
                                cursor: qtd === 0 && !ativo ? 'not-allowed' : 'pointer',
                                border: `1px solid ${ativo ? '#0f85c1' : '#e2e8f0'}`,
                                background: ativo ? '#0f85c1' : '#ffffff',
                                color: ativo ? '#ffffff' : qtd === 0 ? '#cbd5e1' : '#475569',
                              }}
                            >
                              {c === 'novo' ? 'Nova' : 'Usada'} ({qtd})
                            </button>
                          );
                        })}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button type="button" style={botaoPasso} aria-label="Diminuir" disabled={linha.quantidade <= 1} onClick={() => atualizar(index, { quantidade: linha.quantidade - 1 })}>−</button>
                        <span style={{ minWidth: '24px', textAlign: 'center', fontWeight: 700, fontSize: '14px' }}>{linha.quantidade}</span>
                        <button type="button" style={botaoPasso} aria-label="Aumentar" onClick={() => atualizar(index, { quantidade: linha.quantidade + 1 })}>+</button>
                      </div>
                    </div>
                    {excede && <div style={{ fontSize: '11px', color: '#ef4444', marginTop: '4px' }}>Só há {saldo} disponível(is) neste estoque.</div>}
                  </div>
                );
              })}
            </div>
          )}

          <label style={{ display: 'block', marginTop: '12px' }}>
            Observações
            <textarea className="form-input" rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Opcional — sai impresso no termo" />
          </label>
          <AvisoEmail
            id="uniforme-entrega-email"
            value={emailDestino}
            onChange={setEmailDestino}
            texto="Obrigatório. O aviso leva as peças da entrega e o termo em PDF."
          />
        </div>
      </div>

      <Dica>Ao confirmar, as peças saem do estoque e o termo é gerado para impressão e assinatura.</Dica>
    </ModalUniformes>
  );
};

export default EntregaUniformeModal;
