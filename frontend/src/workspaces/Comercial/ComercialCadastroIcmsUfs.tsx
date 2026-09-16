import React, { useEffect, useMemo, useState } from 'react';
import QueryDataPanel from '../../components/QueryDataPanel';
import { useAuth } from '../../contexts/AuthContext';
import { userHasFuncao } from '../../constants/funcoes';
import {
  getComercialErrorMessage,
  useComercialIcmsUfs,
  useRestaurarComercialIcmsUfs,
  useSaveComercialIcmsUfs,
} from '../../hooks/useComercialClientes';
import type { IcmsUfAliquotas } from '../../types/domain';

type UfPanelProps = {
  uf: string;
  valor: number | undefined;
  isOpen: boolean;
  canManage: boolean;
  onToggle: () => void;
  onUpdate: (uf: string, valor: string) => void;
};

function UfPanel({ uf, valor, isOpen, canManage, onToggle, onUpdate }: UfPanelProps) {
  return (
    <section className={`icms-uf-origem${isOpen ? ' is-open' : ''}`}>
      <div className="tabela-frete-fold-bar">
        <button
          type="button"
          className="tabela-frete-fold-trigger"
          aria-expanded={isOpen}
          onClick={onToggle}
        >
          <i className={`bi ${isOpen ? 'bi-chevron-down' : 'bi-chevron-right'}`} aria-hidden />
          <span className="tabela-frete-fold-title">{uf}</span>
          <span className="icms-uf-item-meta">
            {valor != null ? `${valor}%` : '—'}
          </span>
        </button>
      </div>
      {isOpen ? (
        <div className="icms-uf-origem-body">
          <label className="icms-uf-aliquota-field">
            <span>Alíquota ICMS (%)</span>
            {canManage ? (
              <input
                className="icms-uf-aliquota-input"
                type="number"
                min={0}
                max={100}
                step={1}
                value={valor ?? ''}
                onChange={(e) => onUpdate(uf, e.target.value)}
                aria-label={`Alíquota ICMS de ${uf}`}
              />
            ) : (
              <strong>{valor != null ? `${valor}%` : '—'}</strong>
            )}
          </label>
        </div>
      ) : null}
    </section>
  );
}

const ComercialCadastroIcmsUfs: React.FC = () => {
  const { user } = useAuth();
  const canManage = userHasFuncao(user, 'Comercial', 'gerenciar-icms-ufs');
  const icmsQuery = useComercialIcmsUfs();
  const saveAliquotas = useSaveComercialIcmsUfs();
  const restaurarAliquotas = useRestaurarComercialIcmsUfs();
  const [aliquotas, setAliquotas] = useState<IcmsUfAliquotas>({});
  const [expandedRegioes, setExpandedRegioes] = useState<Set<string>>(() => new Set());
  const [expandedUfs, setExpandedUfs] = useState<Set<string>>(() => new Set());
  const ufs = icmsQuery.data?.ufs ?? [];
  const regioes = icmsQuery.data?.regioes ?? [];

  useEffect(() => {
    if (icmsQuery.data?.aliquotas) {
      setAliquotas({ ...icmsQuery.data.aliquotas });
    }
  }, [icmsQuery.data]);

  const isDirty = useMemo(() => {
    if (!icmsQuery.data?.aliquotas) return false;
    return JSON.stringify(aliquotas) !== JSON.stringify(icmsQuery.data.aliquotas);
  }, [aliquotas, icmsQuery.data?.aliquotas]);

  const toggleRegiao = (key: string) => {
    setExpandedRegioes((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleUf = (uf: string) => {
    setExpandedUfs((current) => {
      const next = new Set(current);
      if (next.has(uf)) next.delete(uf);
      else next.add(uf);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedRegioes(new Set(regioes.map((regiao) => regiao.key)));
    setExpandedUfs(new Set(ufs));
  };

  const collapseAll = () => {
    setExpandedRegioes(new Set());
    setExpandedUfs(new Set());
  };

  const updateAliquota = (uf: string, valor: string) => {
    const numero = Number(valor.replace(',', '.'));
    if (Number.isNaN(numero)) return;
    const limitado = Math.max(0, Math.min(100, Math.round(numero)));
    setAliquotas((current) => ({ ...current, [uf]: limitado }));
  };

  const handleSave = (event: React.FormEvent) => {
    event.preventDefault();
    saveAliquotas.mutate(aliquotas, {
      onError: (err) => alert(getComercialErrorMessage(err)),
    });
  };

  const handleRestaurar = () => {
    if (!window.confirm('Restaurar as alíquotas ICMS para o padrão Brasil? Alterações não salvas serão descartadas.')) {
      return;
    }
    restaurarAliquotas.mutate(undefined, {
      onSuccess: (data) => setAliquotas({ ...data.aliquotas }),
      onError: (err) => alert(getComercialErrorMessage(err)),
    });
  };

  return (
    <div className="fat-list-compact" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: '0 4px 4px' }}>
      <header className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '6px', height: '22px', backgroundColor: '#118CC4' }} />
          <h1 className="view-page-title">ICMS por UF</h1>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button type="button" className="reports-action-btn secondary" onClick={expandAll}>
            Expandir todas
          </button>
          <button type="button" className="reports-action-btn secondary" onClick={collapseAll}>
            Recolher todas
          </button>
          {canManage && (
            <>
              <button
                type="button"
                className="reports-action-btn secondary"
                disabled={restaurarAliquotas.isPending || saveAliquotas.isPending}
                onClick={handleRestaurar}
              >
                {restaurarAliquotas.isPending ? 'Restaurando...' : 'Padrão Brasil'}
              </button>
              <button
                type="button"
                className="reports-action-btn primary"
                style={{ backgroundColor: '#118CC4', borderColor: '#118CC4' }}
                disabled={!isDirty || saveAliquotas.isPending}
                onClick={handleSave}
              >
                {saveAliquotas.isPending ? 'Salvando...' : 'Salvar'}
              </button>
            </>
          )}
        </div>
      </header>

      <p className="tabela-frete-hint" style={{ marginBottom: 12 }}>
        Configure o percentual de ICMS de cada UF. Expanda a região e depois o estado para editar a alíquota.
      </p>

      <QueryDataPanel
        query={icmsQuery}
        refreshVariant="overlay"
        loadingMessage="Carregando alíquotas ICMS..."
        refreshingMessage="Atualizando alíquotas ICMS..."
        errorMessage="Não foi possível carregar as alíquotas ICMS."
      >
        <form className="icms-uf-list-wrap" onSubmit={handleSave}>
          <div className="icms-uf-list">
            {regioes.map((regiao) => {
              const regiaoOpen = expandedRegioes.has(regiao.key);
              return (
                <section key={regiao.key} className={`erp-card icms-uf-regiao${regiaoOpen ? ' is-open' : ''}`}>
                  <div className="tabela-frete-fold-bar">
                    <button
                      type="button"
                      className="tabela-frete-fold-trigger icms-uf-regiao-trigger"
                      aria-expanded={regiaoOpen}
                      onClick={() => toggleRegiao(regiao.key)}
                    >
                      <i className={`bi ${regiaoOpen ? 'bi-chevron-down' : 'bi-chevron-right'}`} aria-hidden />
                      <span className="tabela-frete-fold-title">{regiao.label}</span>
                      <span className="icms-uf-item-meta">
                        {regiao.ufs.length} {regiao.ufs.length === 1 ? 'UF' : 'UFs'}
                      </span>
                    </button>
                  </div>
                  {regiaoOpen ? (
                    <div className="icms-uf-regiao-body">
                      {regiao.ufs.map((uf) => (
                        <UfPanel
                          key={uf}
                          uf={uf}
                          valor={aliquotas[uf]}
                          isOpen={expandedUfs.has(uf)}
                          canManage={canManage}
                          onToggle={() => toggleUf(uf)}
                          onUpdate={updateAliquota}
                        />
                      ))}
                    </div>
                  ) : null}
                </section>
              );
            })}
          </div>
        </form>
      </QueryDataPanel>
    </div>
  );
};

export default ComercialCadastroIcmsUfs;
