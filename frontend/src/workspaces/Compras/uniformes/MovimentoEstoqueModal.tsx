import React, { useState } from 'react';
import { getComprasErrorMessage } from '../../../hooks/useCompras';
import { useMovimentarEstoqueUniforme } from '../../../hooks/useUniformes';
import type { CondicaoUniforme, MovimentoEstoqueUniformeTipo, Uniforme } from '../../../types/domain';
import { todayIso } from './format';
import { Dica, ModalUniformes, Segmentado } from './shared';

const TIPOS: { value: MovimentoEstoqueUniformeTipo; label: string; descricao: string; icone: string }[] = [
  { value: 'entrada', label: 'Entrada', descricao: 'Chegaram peças (compra)', icone: 'bi-box-arrow-in-down' },
  { value: 'ajuste', label: 'Ajuste', descricao: 'Corrigir saldo contado', icone: 'bi-sliders' },
  { value: 'descarte', label: 'Descarte', descricao: 'Peça inutilizada', icone: 'bi-trash3' },
];

const MovimentoEstoqueModal: React.FC<{
  uniforme: Uniforme;
  condicaoInicial?: CondicaoUniforme;
  onClose: () => void;
}> = ({ uniforme, condicaoInicial = 'novo', onClose }) => {
  const [tipo, setTipo] = useState<MovimentoEstoqueUniformeTipo>('entrada');
  const [condicao, setCondicao] = useState<CondicaoUniforme>(condicaoInicial);
  const [quantidade, setQuantidade] = useState(1);
  const [sentido, setSentido] = useState<'somar' | 'subtrair'>('somar');
  const [data, setData] = useState(todayIso());
  const [observacao, setObservacao] = useState('');
  const movimentar = useMovimentarEstoqueUniforme();

  const saldoAtual = condicao === 'novo' ? uniforme.qtdNova : uniforme.qtdUsada;
  const variacao = tipo === 'entrada' || (tipo === 'ajuste' && sentido === 'somar') ? quantidade : -quantidade;
  const saldoFinal = saldoAtual + variacao;

  const salvar = () => {
    if (quantidade <= 0) {
      alert('Informe uma quantidade maior que zero.');
      return;
    }
    if (tipo !== 'entrada' && !observacao.trim()) {
      alert(tipo === 'ajuste' ? 'Informe a justificativa do ajuste.' : 'Informe o motivo do descarte.');
      return;
    }
    movimentar.mutate(
      {
        id: uniforme.id,
        tipo,
        condicao,
        quantidade: tipo === 'ajuste' ? variacao : quantidade,
        observacao: observacao.trim(),
        data: tipo === 'entrada' ? data : undefined,
      },
      { onSuccess: onClose },
    );
  };

  return (
    <ModalUniformes
      title={`Movimentar estoque — ${uniforme.nome} ${uniforme.tamanho}`}
      width={600}
      submitLabel={tipo === 'entrada' ? 'Registrar entrada' : tipo === 'ajuste' ? 'Registrar ajuste' : 'Registrar descarte'}
      submitColor={tipo === 'descarte' ? '#ef4444' : undefined}
      isPending={movimentar.isPending}
      error={movimentar.isError ? getComprasErrorMessage(movimentar.error, 'Não foi possível registrar a movimentação.') : null}
      onClose={onClose}
      onSubmit={salvar}
    >
      <Segmentado opcoes={TIPOS} value={tipo} onChange={setTipo} />

      <div className="form-grid two-cols" style={{ marginTop: '16px' }}>
        <label>
          Qual estoque?
          <select className="form-input" value={condicao} onChange={(e) => setCondicao(e.target.value as CondicaoUniforme)}>
            <option value="novo">Peças novas (hoje: {uniforme.qtdNova})</option>
            <option value="usado">Peças usadas (hoje: {uniforme.qtdUsada})</option>
          </select>
        </label>
        {tipo === 'ajuste' ? (
          <label>
            O que fazer?
            <select className="form-input" value={sentido} onChange={(e) => setSentido(e.target.value as 'somar' | 'subtrair')}>
              <option value="somar">Aumentar o saldo</option>
              <option value="subtrair">Diminuir o saldo</option>
            </select>
          </label>
        ) : tipo === 'entrada' ? (
          <label>
            Data da entrada
            <input className="form-input" type="date" required value={data} onChange={(e) => setData(e.target.value)} />
          </label>
        ) : <div />}
        <label>
          Quantidade de peças
          <input
            className="form-input"
            type="number"
            min={1}
            autoFocus
            value={quantidade}
            onChange={(e) => setQuantidade(Math.max(1, parseInt(e.target.value) || 1))}
          />
        </label>
      </div>

      <label style={{ display: 'block', marginTop: '12px' }}>
        {tipo === 'entrada' ? 'Observação (opcional)' : tipo === 'ajuste' ? 'Justificativa do ajuste' : 'Motivo do descarte'}
        <textarea
          className="form-input"
          rows={2}
          value={observacao}
          placeholder={tipo === 'entrada' ? 'Ex: nota fiscal, fornecedor' : 'Obrigatório — fica registrado no histórico'}
          onChange={(e) => setObservacao(e.target.value)}
        />
      </label>

      <Dica cor={saldoFinal < 0 ? 'alerta' : 'info'}>
        Estoque {condicao === 'novo' ? 'de peças novas' : 'de peças usadas'}: <strong>{saldoAtual}</strong>
        {' → '}
        <strong>{saldoFinal}</strong> depois desta movimentação.
        {saldoFinal < 0 && ' Não há saldo suficiente.'}
      </Dica>
    </ModalUniformes>
  );
};

export default MovimentoEstoqueModal;
