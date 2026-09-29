import { useId, useState } from 'react';
import { createPortal } from 'react-dom';
import QueryDataPanel from '../../components/QueryDataPanel';
import { getComercialErrorMessage, useClientesComercial } from '../../hooks/useComercialClientes';
import {
  useDeleteVeiculoComercial,
  useSaveVeiculoComercial,
  useVeiculosComercial,
} from '../../hooks/useVeiculosComercial';
import type { VeiculoComercial } from '../../types/domain';

type RotuloForm = { clienteId: string; rotulo: string };

type VeiculoForm = {
  id?: string;
  nome: string;
  anttFixo: string;
  anttPorKm: string;
  ativo: boolean;
  rotulos: RotuloForm[];
};

const formVazio = (): VeiculoForm => ({
  nome: '',
  anttFixo: '',
  anttPorKm: '',
  ativo: true,
  rotulos: [],
});

const formDoVeiculo = (veiculo: VeiculoComercial): VeiculoForm => ({
  id: veiculo.id,
  nome: veiculo.nome,
  anttFixo: String(Number(veiculo.anttFixo)).replace('.', ','),
  anttPorKm: String(Number(veiculo.anttPorKm)).replace('.', ','),
  ativo: veiculo.ativo,
  rotulos: veiculo.rotulosCliente.map((item) => ({ clienteId: item.clienteId, rotulo: item.rotulo })),
});

const decimalApi = (valor: string) => {
  const texto = valor.trim();
  return texto.includes(',') ? texto.replace(/\./g, '').replace(',', '.') : texto;
};

const fmtNumero = (valor: string | number | null | undefined, casas = 2) => {
  const numero = Number(valor);
  if (valor === null || valor === undefined || valor === '' || Number.isNaN(numero)) return '—';
  return numero.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: 4 });
};

const INFO_CC = 'Coeficiente de Carga e Descarga: valor fixo em R$ do piso mínimo de frete da ANTT, cobrado por viagem independentemente da distância.';
const INFO_CCD = 'Coeficiente de Custo de Deslocamento: valor em R$ por km rodado do piso mínimo de frete da ANTT.';

function InfoTip({ texto }: { texto: string }) {
  return (
    <span className="info-tip" tabIndex={0} aria-label={texto}>
      <i className="bi bi-info-circle" aria-hidden="true" />
      <span className="info-tip-balao" role="tooltip">{texto}</span>
    </span>
  );
}

function VeiculoModal({
  inicial,
  onClose,
}: {
  inicial: VeiculoForm;
  onClose: () => void;
}) {
  const [form, setForm] = useState<VeiculoForm>(inicial);
  const saveVeiculo = useSaveVeiculoComercial();
  const clientesQuery = useClientesComercial({ page: 1, pageSize: 100, ativos: true });
  const clientes = clientesQuery.data?.results ?? [];
  const usados = new Set(form.rotulos.map((item) => item.clienteId));
  const valido = form.nome.trim() && form.anttFixo.trim() && form.anttPorKm.trim();

  const setRotulo = (index: number, patch: Partial<RotuloForm>) => {
    setForm((atual) => ({
      ...atual,
      rotulos: atual.rotulos.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }));
  };

  const salvar = () => {
    saveVeiculo.mutate({
      id: form.id,
      payload: {
        nome: form.nome.trim(),
        anttFixo: decimalApi(form.anttFixo),
        anttPorKm: decimalApi(form.anttPorKm),
        ativo: form.ativo,
        rotulosCliente: form.rotulos.filter((item) => item.clienteId && item.rotulo.trim()),
      },
    }, {
      onSuccess: onClose,
      onError: (err) => alert(getComercialErrorMessage(err)),
    });
  };

  return createPortal(
    <div className="search-backdrop" style={{ display: 'flex', alignItems: 'center', padding: '24px 16px' }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card comercial-veiculo-modal" role="dialog" aria-modal="true">
        <div className="modal-header">
          <h2>{form.id ? 'Editar tipo de veículo' : 'Novo tipo de veículo'}</h2>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Fechar"><i className="bi bi-x-lg" /></button>
        </div>
        <div className="modal-body">
          <div className="comercial-veiculo-grid">
            <label className="comercial-veiculo-field is-nome">
              <span>Nome padrão</span>
              <input value={form.nome} placeholder="Ex.: Bitrem 9 eixos" onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </label>
            <label className="comercial-veiculo-field">
              <span>CC ANTT (R$) <InfoTip texto={INFO_CC} /></span>
              <input inputMode="decimal" value={form.anttFixo} onChange={(e) => setForm({ ...form, anttFixo: e.target.value })} />
            </label>
            <label className="comercial-veiculo-field">
              <span>CCD ANTT (R$/km) <InfoTip texto={INFO_CCD} /></span>
              <input inputMode="decimal" value={form.anttPorKm} onChange={(e) => setForm({ ...form, anttPorKm: e.target.value })} />
            </label>            <label className="comercial-veiculo-ativo">
              <input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} />
              <span>Ativo</span>
            </label>
          </div>

          <div className="comercial-veiculo-rotulos">
            <div className="comercial-veiculo-rotulos-head">
              <strong>Rótulos por cliente</strong>
              <span>Nome exibido na proposta e no PDF desse cliente.</span>
            </div>
            {form.rotulos.length === 0 ? (
              <p className="comercial-veiculo-rotulos-vazio">Todos os clientes veem o nome padrão.</p>
            ) : form.rotulos.map((item, index) => (
              <div key={index} className="comercial-veiculo-rotulo-row">
                <select value={item.clienteId} onChange={(e) => setRotulo(index, { clienteId: e.target.value })}>
                  <option value="">Selecione o cliente</option>
                  {clientes.map((cliente) => (
                    <option key={cliente.id} value={cliente.id} disabled={cliente.id !== item.clienteId && usados.has(cliente.id)}>
                      {cliente.nomeFantasia || cliente.razaoSocial}
                    </option>
                  ))}
                </select>
                <input value={item.rotulo} placeholder="Rótulo para o cliente" onChange={(e) => setRotulo(index, { rotulo: e.target.value })} />
                <button
                  type="button"
                  className="btn-icon"
                  title="Remover rótulo"
                  onClick={() => setForm((atual) => ({ ...atual, rotulos: atual.rotulos.filter((_, i) => i !== index) }))}
                >
                  <i className="bi bi-trash" />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="reports-action-btn secondary"
              onClick={() => setForm((atual) => ({ ...atual, rotulos: [...atual.rotulos, { clienteId: '', rotulo: '' }] }))}
            >
              Adicionar rótulo
            </button>
          </div>
        </div>
        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="reports-action-btn secondary" onClick={onClose}>Cancelar</button>
          <button
            type="button"
            className="reports-action-btn primary"
            style={{ backgroundColor: '#118CC4', borderColor: '#118CC4' }}
            disabled={!valido || saveVeiculo.isPending}
            onClick={salvar}
          >
            {saveVeiculo.isPending ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function ComercialVeiculosCatalogo({ canManage }: { canManage: boolean }) {
  const [aberta, setAberta] = useState(false);
  const [editando, setEditando] = useState<VeiculoForm | null>(null);
  const painelId = useId();
  const veiculosQuery = useVeiculosComercial({ enabled: aberta });
  const deleteVeiculo = useDeleteVeiculoComercial();
  const veiculos = veiculosQuery.data ?? [];

  const excluir = (veiculo: VeiculoComercial) => {
    if (!window.confirm(`Excluir o tipo de veículo "${veiculo.nome}"?`)) return;
    deleteVeiculo.mutate(veiculo.id, { onError: (err) => alert(getComercialErrorMessage(err)) });
  };

  return (
    <section className={`comercial-param-card comercial-param-accordion comercial-veiculos-card${aberta ? ' is-open' : ''}`}>
      <button
        type="button"
        className="comercial-param-accordion-toggle"
        aria-expanded={aberta}
        aria-controls={painelId}
        onClick={() => setAberta((atual) => !atual)}
      >
        <span className="comercial-param-accordion-copy">
          <span className="comercial-param-accordion-title">Tipos de veículo</span>
          <span className="comercial-param-accordion-desc">Veículos disponíveis nas tabelas de frete, com custos da ANTT e nomes por cliente.</span>
        </span>
        <i className={`bi ${aberta ? 'bi-chevron-up' : 'bi-chevron-down'}`} aria-hidden="true" />
      </button>
      {aberta ? (
        <div id={painelId} className="comercial-param-accordion-body">
          <QueryDataPanel
            query={veiculosQuery}
            variant="compact"
            refreshVariant="overlay"
            loadingMessage="Carregando veículos..."
            refreshingMessage="Atualizando veículos..."
            errorMessage="Não foi possível carregar os tipos de veículo."
          >
            <div className="table-container">
              <table className="data-table tabela-frete-mini comercial-veiculos-table">
                <colgroup>
                  <col className="comercial-veiculos-col-nome" />
                  <col className="comercial-veiculos-col-valor" />
                  <col className="comercial-veiculos-col-valor" />
                  <col />
                  {canManage ? <col className="comercial-veiculos-col-acoes" /> : null}
                </colgroup>
                <thead>
                  <tr>
                    <th>Veículo</th>
                    <th>
                      CC ANTT (R$)
                      <InfoTip texto={INFO_CC} />
                    </th>
                    <th>
                      CCD ANTT (R$/km)
                      <InfoTip texto={INFO_CCD} />
                    </th>
                    <th>Rótulos por cliente</th>
                    {canManage ? <th aria-label="Ações" /> : null}
                  </tr>
                </thead>
                <tbody>
                  {veiculos.length === 0 ? (
                    <tr>
                      <td colSpan={canManage ? 5 : 4} className="comercial-browse-empty">Nenhum tipo de veículo cadastrado.</td>
                    </tr>
                  ) : veiculos.map((veiculo) => (
                    <tr key={veiculo.id} className={veiculo.ativo ? undefined : 'is-inativo'}>
                      <td>
                        <strong>{veiculo.nome}</strong>
                        {!veiculo.ativo ? <span className="comercial-veiculo-inativo"> · inativo</span> : null}
                      </td>
                      <td>{fmtNumero(veiculo.anttFixo)}</td>
                      <td>{fmtNumero(veiculo.anttPorKm, 4)}</td>
                      <td
                        className="comercial-veiculo-rotulos-cell"
                        title={veiculo.rotulosCliente.map((item) => `${item.clienteNome}: ${item.rotulo}`).join('\n')}
                      >
                        {veiculo.rotulosCliente.length
                          ? veiculo.rotulosCliente.map((item) => `${item.clienteNome}: ${item.rotulo}`).join(' · ')
                          : '—'}
                      </td>
                      {canManage ? (
                        <td className="comercial-veiculo-acoes">
                          <button type="button" className="btn-icon" title="Editar" onClick={() => setEditando(formDoVeiculo(veiculo))}>
                            <i className="bi bi-pencil" />
                          </button>
                          <button type="button" className="btn-icon" title="Excluir" disabled={deleteVeiculo.isPending} onClick={() => excluir(veiculo)}>
                            <i className="bi bi-trash" />
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </QueryDataPanel>
          {canManage ? (
            <div className="comercial-param-add">
              <button type="button" className="reports-action-btn secondary" onClick={() => setEditando(formVazio())}>
                Novo tipo de veículo
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      {editando ? <VeiculoModal inicial={editando} onClose={() => setEditando(null)} /> : null}
    </section>
  );
}
