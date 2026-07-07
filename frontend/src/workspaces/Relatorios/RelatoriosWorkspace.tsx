import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

interface ReportTemplate {
  id: string;
  name: string;
  category: 'financeiro' | 'operacional';
  description: string;
  format: 'PDF' | 'EXCEL' | 'CSV';
}

const REPORT_TEMPLATES: ReportTemplate[] = [
  { id: '1', name: 'Canhotos Pendentes por Filial', category: 'operacional', description: 'Listagem de canhotos digitalizados e pendentes de recebimento agrupados por filial.', format: 'PDF' },
  { id: '4', name: 'Fluxo de Caixa Mensal Consolidado', category: 'financeiro', description: 'Valores a pagar, receber e saldo diário projetado para os próximos 30 dias.', format: 'CSV' },
  { id: '5', name: 'Despesas Gerais por Centro de Custo', category: 'financeiro', description: 'Distribuição percentual e absoluta de despesas lançadas no período.', format: 'PDF' },
];

const CATEGORY_STYLES: Record<ReportTemplate['category'], { label: string; color: string; bg: string }> = {
  financeiro: { label: 'Financeiro', color: '#0076ce', bg: '#eff6ff' },
  operacional: { label: 'Operacional', color: '#8b5cf6', bg: '#f5f3ff' },
};

const RelatoriosWorkspace: React.FC = () => {
  const { user, selectedFilial } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<'todos' | ReportTemplate['category']>('todos');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTemplates = REPORT_TEMPLATES.filter((template) => {
    const matchesCategory = selectedCategory === 'todos' || template.category === selectedCategory;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      template.name.toLowerCase().includes(q) ||
      template.description.toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });

  const filialLabel = selectedFilial || (user?.filiais ? 'Filial do usuário' : 'Consolidado');

  return (
    <div style={{ padding: '4px' }}>
      <header className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '6px', height: '22px', backgroundColor: '#118CC4' }} />
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#0f172a' }}>Inclusão de Relatórios</h1>
        </div>
      </header>

      <div className="erp-card" style={{ padding: '20px', marginBottom: '24px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '15px', fontWeight: 600, color: '#334155' }}>Catálogo de Relatórios</h3>
        <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
          Modelos disponíveis para o ambiente ativo ({filialLabel}). A rotina de geração e exportação será habilitada em uma fase futura do projeto.
        </p>
      </div>

      <div className="reports-filters-bar" style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '20px' }}>
        <div className="reports-filter-left" style={{ display: 'flex', gap: '12px', flex: 1, flexWrap: 'wrap' }}>
          <div className="reports-search-wrapper" style={{ minWidth: '240px' }}>
            <svg className="search-icon" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z" />
            </svg>
            <input
              type="text"
              placeholder="Buscar modelo de relatório..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="reports-select-wrapper">
            <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value as typeof selectedCategory)}>
              <option value="todos">Categoria: Todas</option>
              <option value="financeiro">Financeiro</option>
              <option value="operacional">Operacional</option>
            </select>
          </div>
        </div>

        <div className="reports-filter-right">
          <span className="reports-records-count"><strong>{filteredTemplates.length}</strong> Modelos</span>
        </div>
      </div>

      {filteredTemplates.length === 0 ? (
        <div className="erp-card" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
          Nenhum modelo encontrado com os filtros ativos.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {filteredTemplates.map((template) => {
            const cat = CATEGORY_STYLES[template.category];

            return (
              <div
                key={template.id}
                className="erp-card"
                style={{
                  padding: '20px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: cat.color, backgroundColor: cat.bg, padding: '2px 8px', borderRadius: '4px' }}>
                    {cat.label}
                  </span>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#475569', backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                    {template.format}
                  </span>
                </div>
                <div>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '14.5px', fontWeight: 600, color: '#1e293b' }}>
                    {template.name}
                  </h3>
                  <p style={{ margin: 0, fontSize: '12.5px', color: '#64748b', lineHeight: 1.4 }}>
                    {template.description}
                  </p>
                </div>
                <span style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>
                  Exportação em desenvolvimento
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RelatoriosWorkspace;
