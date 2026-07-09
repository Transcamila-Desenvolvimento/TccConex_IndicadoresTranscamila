import React, { useState, useEffect, useMemo } from 'react';
import type { BillingRecord } from '../../types/domain';
import etlServerIcon from '../../assets/ETL-Server.svg';
import {
  useBillingRecords,
  useExportBillingRecords,
  useImportBillingXml,
  useCreateBillingRecord,
  useUpdateBillingRecord,
  useDeleteBillingRecord,
} from '../../hooks/useFinanceiroBilling';
import QueryDataPanel from '../../components/QueryDataPanel';
import { useAsyncQueryState } from '../../hooks/useAsyncQueryState';
import ExcelJS from 'exceljs';

const BRANCH_OPTIONS = ['Ibiporã', 'Rondonópolis', 'Barueri', 'Paranaguá', 'Armazém'] as const;

const FinanceiroBilling: React.FC = () => {
  const importBillingXml = useImportBillingXml();
  const createBillingRecord = useCreateBillingRecord();
  const updateBillingRecord = useUpdateBillingRecord();
  const deleteBillingRecord = useDeleteBillingRecord();
  const exportBillingRecords = useExportBillingRecords();

  useEffect(() => {
    const el = document.querySelector('.content') as HTMLElement | null;
    if (!el) return;
    const prev = el.style.overflowY;
    el.style.overflowY = 'hidden';
    return () => { el.style.overflowY = prev; };
  }, []);

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [branchFilter, setBranchFilter] = useState('Todas');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [isExporting, setIsExporting] = useState(false);

  const queryParams = useMemo(() => ({
    page: currentPage,
    pageSize,
    search: searchQuery.trim() || undefined,
    branch: branchFilter !== 'Todas' ? branchFilter : undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  }), [currentPage, searchQuery, branchFilter, startDate, endDate]);

  const billingQuery = useBillingRecords(queryParams);
  const billingPage = billingQuery.data;
  const listQueryState = useAsyncQueryState(billingQuery);
  const paginatedList = billingPage?.results ?? [];
  const totalItems = billingPage?.count ?? 0;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const clampedPage = Math.min(currentPage, totalPages) || 1;

  // Import Modal States
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importProgress, setImportProgress] = useState(-1); // -1 means inactive
  const [importSuccess, setImportSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Form Modal States (criar / editar)
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<BillingRecord | null>(null);
  const [formDate, setFormDate] = useState('');
  const [formBranch, setFormBranch] = useState<string>(BRANCH_OPTIONS[0]);
  const [formValue, setFormValue] = useState('');
  const [formNotesCount, setFormNotesCount] = useState('');


  // Close modal when clicking on backdrop
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('search-backdrop') && target.id === 'billing-import-modal') {
        closeImportModal();
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  const closeImportModal = () => {
    setIsImportModalOpen(false);
    setSelectedFile(null);
    setImportProgress(-1);
    setImportSuccess(false);
    setSuccessMessage('');
  };

  // Handle Drag & Drop Files
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      setSelectedFile(files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setSelectedFile(files[0]);
    }
  };

  // Import report file (XML processado no backend Django)
  const handleStartImport = () => {
    if (!selectedFile) return;

    setImportProgress(0);
    setImportSuccess(false);

    let progress = 0;
    const interval = setInterval(() => {
      progress = Math.min(progress + 10, 90);
      setImportProgress(progress);
    }, 150);

    importBillingXml.mutateAsync(selectedFile)
      .then((result) => {
        clearInterval(interval);
        setImportProgress(100);
        if (result.success) {
          setImportSuccess(true);
          const datesLabel = result.dates.join(', ');
          setSuccessMessage(
            `Faturamento de 5 filiais importado com sucesso para ${datesLabel} — R$ ${result.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em ${result.totalNotes} notas.`
          );
        } else {
          alert(result.detail ?? 'Não foi possível importar o arquivo.');
          setImportProgress(-1);
        }
      })
      .catch(() => {
        clearInterval(interval);
        alert('Erro ao importar. Verifique se o backend está rodando.');
        setImportProgress(-1);
      });
  };


  const handleOpenCreateModal = () => {
    setEditingRecord(null);
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormBranch(BRANCH_OPTIONS[0]);
    setFormValue('');
    setFormNotesCount('0');
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (record: BillingRecord) => {
    setEditingRecord(record);
    setFormDate(record.date);
    setFormBranch(record.branch);
    setFormValue(record.value.toString());
    setFormNotesCount(record.notesCount.toString());
    setIsFormModalOpen(true);
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      date: formDate,
      branch: formBranch,
      value: parseFloat(formValue) || 0,
      notesCount: parseInt(formNotesCount, 10) || 0,
    };

    if (editingRecord) {
      updateBillingRecord.mutate(
        { id: editingRecord.id, payload },
        {
          onSuccess: () => {
            setIsFormModalOpen(false);
            setEditingRecord(null);
            alert('Registro de faturamento atualizado com sucesso!');
          },
          onError: () => alert('Erro ao atualizar registro. Verifique se já existe faturamento para esta filial e data.'),
        }
      );
      return;
    }

    createBillingRecord.mutate(payload, {
      onSuccess: () => {
        setIsFormModalOpen(false);
        setCurrentPage(1);
        alert('Faturamento incluído manualmente com sucesso!');
      },
      onError: () => alert('Erro ao incluir faturamento. Verifique se já existe registro para esta filial e data.'),
    });
  };

  const handleDelete = (id: number) => {
    if (window.confirm('Deseja realmente excluir este registro de faturamento?')) {
      deleteBillingRecord.mutate(id, {
        onSuccess: () => alert('Registro de faturamento removido!'),
        onError: () => alert('Erro ao excluir registro. Verifique se o backend está rodando.'),
      });
    }
  };

  const handleExportExcel = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      // 1. Fetch ALL records matching current filters (unpaginated)
      const allRecords = await exportBillingRecords.mutateAsync({
        search: searchQuery.trim() || undefined,
        branch: branchFilter !== 'Todas' ? branchFilter : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });

      const records = allRecords.results;

      if (!records || records.length === 0) {
        alert('Nenhum registro encontrado para exportar.');
        return;
      }

      // 2. Initialize workbook and worksheet
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Faturamento', {
        views: [{ showGridLines: true }]
      });

      // 3. Title & Subtitle block
      sheet.mergeCells('A1:D1');
      const titleCell = sheet.getCell('A1');
      titleCell.value = 'Relatório de Faturamento Diário por Filial';
      titleCell.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FF1E293B' } };
      titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
      sheet.getRow(1).height = 30;

      sheet.mergeCells('A2:D2');
      const subtitleCell = sheet.getCell('A2');
      const nowStr = new Date().toLocaleString('pt-BR');
      subtitleCell.value = `Exportado em: ${nowStr} | Total de registros: ${records.length}`;
      subtitleCell.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF64748B' } };
      subtitleCell.alignment = { vertical: 'middle', horizontal: 'left' };
      sheet.getRow(2).height = 20;

      // Empty row
      sheet.getRow(3).height = 10;

      // 4. Headers
      const headerRow = sheet.getRow(4);
      headerRow.height = 26;
      const headers = ['Data', 'Filial', 'Valor (R$)', 'Qtd. Notas'];
      headers.forEach((h, idx) => {
        const cell = headerRow.getCell(idx + 1);
        cell.value = h;
        cell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF118CC4' }
        };
        cell.alignment = { vertical: 'middle', horizontal: idx === 1 ? 'left' : 'center' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'medium', color: { argb: 'FF0F76A5' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
      });

      // 5. Populate Data Rows
      records.forEach((rec, index) => {
        const rowIdx = index + 5;
        const row = sheet.getRow(rowIdx);
        row.height = 20;

        // Data (Date) format to DD/MM/YYYY
        let dateVal = rec.date;
        if (dateVal.includes('-')) {
          const [y, m, d] = dateVal.split('-');
          dateVal = `${d}/${m}/${y}`;
        }
        const cellDate = row.getCell(1);
        cellDate.value = dateVal;
        cellDate.alignment = { vertical: 'middle', horizontal: 'center' };

        // Filial
        const cellBranch = row.getCell(2);
        cellBranch.value = rec.branch;
        cellBranch.alignment = { vertical: 'middle', horizontal: 'left' };

        // Valor
        const cellValue = row.getCell(3);
        cellValue.value = Number(rec.value);
        cellValue.numFmt = '"R$" #,##0.00;("R$" #,##0.00);"-"';
        cellValue.alignment = { vertical: 'middle', horizontal: 'right' };

        // Qtd Notas
        const cellNotes = row.getCell(4);
        cellNotes.value = Number(rec.notesCount);
        cellNotes.numFmt = '#,##0';
        cellNotes.alignment = { vertical: 'middle', horizontal: 'right' };

        // Zebra striping style & borders
        const isEven = index % 2 === 0;
        const rowBg = isEven ? 'FFFFFFFF' : 'FFF8FAFC';
        [1, 2, 3, 4].forEach((colIdx) => {
          const cell = row.getCell(colIdx);
          cell.font = { name: 'Segoe UI', size: 10, color: { argb: 'FF334155' } };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: rowBg }
          };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          };
        });
      });

      // 6. Total Summary Row
      const totalRowIdx = records.length + 5;
      const totalRow = sheet.getRow(totalRowIdx);
      totalRow.height = 24;
      
      const labelCell = totalRow.getCell(1);
      labelCell.value = 'Total Geral';
      sheet.mergeCells(totalRowIdx, 1, totalRowIdx, 2);
      labelCell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FF1E293B' } };
      labelCell.alignment = { vertical: 'middle', horizontal: 'left' };

      const totalValueCell = totalRow.getCell(3);
      totalValueCell.value = { formula: `SUM(C5:C${totalRowIdx - 1})` };
      totalValueCell.numFmt = '"R$" #,##0.00;("R$" #,##0.00);"-"';
      totalValueCell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FF118CC4' } };
      totalValueCell.alignment = { vertical: 'middle', horizontal: 'right' };

      const totalNotesCell = totalRow.getCell(4);
      totalNotesCell.value = { formula: `SUM(D5:D${totalRowIdx - 1})` };
      totalNotesCell.numFmt = '#,##0';
      totalNotesCell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FF1E293B' } };
      totalNotesCell.alignment = { vertical: 'middle', horizontal: 'right' };

      // Total row background & borders
      [1, 2, 3, 4].forEach((colIdx) => {
        const cell = totalRow.getCell(colIdx);
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF1F5F9' }
        };
        cell.border = {
          top: { style: 'medium', color: { argb: 'FF118CC4' } },
          bottom: { style: 'double', color: { argb: 'FF118CC4' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
      });

      // 7. Width sizing adjustment
      sheet.getColumn(1).width = 16; // Data
      sheet.getColumn(2).width = 24; // Filial
      sheet.getColumn(3).width = 22; // Valor (R$)
      sheet.getColumn(4).width = 16; // Qtd. Notas

      // 8. Download workbook
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const filialName = branchFilter !== 'Todas' ? `_${branchFilter.replace(/\s+/g, '_')}` : '';
      link.download = `relatorio_faturamento_diario${filialName}_${new Date().toISOString().slice(0,10)}.xlsx`;
      
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Erro ao extrair relatório em Excel.');
    } finally {
      setIsExporting(false);
    }
  };


  // Reset pagination when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, branchFilter, startDate, endDate]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: '4px' }}>
      {/* Header */}
      <header className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '6px', height: '22px', backgroundColor: '#118CC4' }}></div>
          <h1 className="view-page-title">Faturamento Diário por Filial</h1>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button 
            type="button"
            className="reports-action-btn secondary" 
            style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '38px' }}
            onClick={handleExportExcel}
            disabled={isExporting}
          >
            {isExporting ? (
              <>
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" style={{ width: '14px', height: '14px', borderLeftColor: 'transparent', borderRadius: '50%', borderStyle: 'solid', borderWidth: '2px', animation: 'spinner-border .75s linear infinite', color: '#10b981' }}></span>
                <span>Exportando...</span>
              </>
            ) : (
              <>
                <i className="bi bi-file-earmark-excel" style={{ color: '#10b981', fontSize: '15px' }} />
                <span>Exportar Excel</span>
              </>
            )}
          </button>
          <button
            type="button"
            className="reports-action-btn primary"
            style={{ backgroundColor: '#118CC4', borderColor: '#118CC4', display: 'flex', alignItems: 'center', gap: '8px', height: '38px' }}
            onClick={handleOpenCreateModal}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            <span>Incluir Faturamento</span>
          </button>
          <button 
            type="button"
            className="reports-action-btn secondary" 
            id="btn-billing-import" 
            style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '38px' }}
            onClick={() => setIsImportModalOpen(true)}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z"></path>
            </svg>
            <span>Importar Relatório</span>
          </button>
        </div>
      </header>



      {/* Filters Toolbar */}
      <div className="reports-filters-bar" style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '20px' }}>
        <div className="reports-filter-left" style={{ display: 'flex', gap: '12px', flex: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          
          {/* Search Input */}
          <div className="reports-search-wrapper" style={{ minWidth: '240px' }}>
            <svg className="search-icon" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.637 10.637z"></path>
            </svg>
            <input 
              type="text" 
              placeholder="Buscar por filial, data ou valor..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Select Branch Filter */}
          <div className="reports-select-wrapper">
            <select 
              value={branchFilter} 
              onChange={(e) => setBranchFilter(e.target.value)}
            >
              <option value="Todas">Filial: Todas</option>
              {BRANCH_OPTIONS.map((branch) => (
                <option key={branch} value={branch}>{branch}</option>
              ))}
            </select>
          </div>

          {/* Date Range Filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#64748b' }}>
            <span>Período:</span>
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{ height: '34px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', color: '#334155', fontSize: '12.5px' }}
            />
            <span>até</span>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{ height: '34px', padding: '0 8px', border: '1px solid #cbd5e1', borderRadius: '4px', color: '#334155', fontSize: '12.5px' }}
            />
            {(startDate || endDate) && (
              <button 
                type="button" 
                onClick={() => { setStartDate(''); setEndDate(''); }}
                style={{ background: 'none', border: 'none', color: '#ef4444', fontWeight: 600, fontSize: '11px', cursor: 'pointer' }}
              >
                Limpar datas
              </button>
            )}
          </div>
        </div>

        <div className="reports-filter-right">
          <span className="reports-records-count"><strong>{totalItems}</strong> Registros</span>
        </div>
      </div>

      {/* Table Card */}
      <QueryDataPanel
        query={billingQuery}
        loadingMessage="Carregando faturamento..."
        refreshingMessage="Atualizando faturamento..."
        errorMessage="Não foi possível carregar o faturamento. Tente novamente."
      >
      <div className="erp-card reports-table-card" style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div className="billing-etl-bar" title="Integração ETL Server — em desenvolvimento">
          <img src={etlServerIcon} alt="" className="billing-etl-bar__icon" aria-hidden="true" />
          <span className="billing-etl-bar__label">ETL Server</span>
          <span className="billing-etl-bar__badge">Workflow Ativo</span>
          {/* Loader — reativar quando a integração ETL estiver ativa
          <span className="billing-etl-bar__spinner" aria-hidden="true">
            <span className="spinner" />
          </span>
          */}
        </div>
        <div className="table-container" style={{ flex: 1, overflowY: 'auto' }}>
          <table className="erp-table reports-table">
            <thead>
              <tr>
                <th style={{ borderRight: 'none', borderBottom: '1px solid #e2e8f0', color: '#94a3b8', fontWeight: 500 }}>Data</th>
                <th style={{ borderRight: 'none', borderBottom: '1px solid #e2e8f0', color: '#94a3b8', fontWeight: 500 }}>Filial</th>
                <th className="num" style={{ borderRight: 'none', borderBottom: '1px solid #e2e8f0', color: '#94a3b8', fontWeight: 500, textAlign: 'right' }}>Valor Faturado</th>
                <th style={{ width: '14%', borderRight: 'none', borderBottom: '1px solid #e2e8f0', color: '#94a3b8', fontWeight: 500, textAlign: 'center' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {listQueryState.canShowEmpty && paginatedList.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', color: '#64748b', fontStyle: 'italic', padding: '32px' }}>
                    Nenhum registro de faturamento diário encontrado para os filtros aplicados.
                  </td>
                </tr>
              ) : (
                paginatedList.map((item, idx) => {
                  const zebraClass = idx % 2 === 1 ? 'zebra-row' : '';
                  const parts = item.date.split('-');
                  const formattedDate = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : item.date;
                  const trend = item.trend ?? 'none';

                  return (
                    <tr key={item.id} className={zebraClass}>
                      <td style={{ borderBottom: '1px solid #f1f5f9', borderRight: 'none', fontWeight: 500 }}>{formattedDate}</td>
                      <td style={{ borderBottom: '1px solid #f1f5f9', borderRight: 'none', fontWeight: 600, color: '#1e293b' }}>{item.branch}</td>
                      <td className="num" style={{ borderBottom: '1px solid #f1f5f9', borderRight: 'none', fontWeight: 600, textAlign: 'right', color: '#0f172a' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px', width: '100%' }}>
                          <span>{item.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                          {trend === 'up' && (
                            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24" style={{ color: '#10b981', flexShrink: 0 }}>
                              <title>Maior que o faturamento anterior</title>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19.5v-15m0 0l-6.75 6.75M12 4.5l6.75 6.75" />
                            </svg>
                          )}
                          {trend === 'down' && (
                            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24" style={{ color: '#ef4444', flexShrink: 0 }}>
                              <title>Menor que o faturamento anterior</title>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m0 0l-6.75-6.75M12 19.5l6.75-6.75" />
                            </svg>
                          )}
                        </div>
                      </td>
                      <td style={{ borderBottom: '1px solid #f1f5f9', borderRight: 'none', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(item)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              backgroundColor: 'transparent',
                              color: '#64748b',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '4px 8px',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#eff6ff';
                              e.currentTarget.style.color = '#118CC4';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                              e.currentTarget.style.color = '#64748b';
                            }}
                          >
                            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                            </svg>
                            <span>Editar</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDelete(item.id)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              backgroundColor: 'transparent',
                              color: '#64748b',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '4px 8px',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#fef2f2';
                              e.currentTarget.style.color = '#ef4444';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                              e.currentTarget.style.color = '#64748b';
                            }}
                          >
                            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                            <span>Excluir</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Controls */}
      <div className="erp-pagination-bar">
        <span style={{ fontWeight: 500, marginRight: '4px' }}>
          Página <span className="erp-pagination-current">{clampedPage}</span> de <span className="erp-pagination-current">{totalPages}</span>
        </span>
        <button 
          type="button" 
          className="reports-action-btn secondary" 
          disabled={clampedPage <= 1}
          onClick={() => setCurrentPage(clampedPage - 1)}
          style={{ height: '32px', padding: '0 12px', fontSize: '12px', gap: '6px', opacity: clampedPage <= 1 ? 0.5 : 1, cursor: clampedPage <= 1 ? 'not-allowed' : 'pointer' }}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Anterior
        </button>
        <button 
          type="button" 
          className="reports-action-btn secondary" 
          disabled={clampedPage >= totalPages}
          onClick={() => setCurrentPage(clampedPage + 1)}
          style={{ height: '32px', padding: '0 12px', fontSize: '12px', gap: '6px', opacity: clampedPage >= totalPages ? 0.5 : 1, cursor: clampedPage >= totalPages ? 'not-allowed' : 'pointer' }}
        >
          Próximo
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>
      </QueryDataPanel>

      {/* MODAL: IMPORTAR RELATÓRIO */}
      {isImportModalOpen && (
        <div className="search-backdrop" id="billing-import-modal" style={{ display: 'flex', zIndex: 3000 }}>
          <div className="search-modal-card" style={{ width: '480px', padding: '24px' }}>
            <div className="search-input-wrapper" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>Importar Relatório de Faturamento</h3>
              <span className="search-close-key" style={{ cursor: 'pointer', fontSize: '12px' }} onClick={closeImportModal}>Fechar (X)</span>
            </div>

            {/* Drag & Drop Area */}
            {importProgress === -1 && (
              <div 
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                style={{ 
                  border: '2px dashed #cbd5e1', 
                  borderRadius: '8px', 
                  padding: '30px 20px', 
                  textAlign: 'center', 
                  backgroundColor: '#f8fafc',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = '#118CC4'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
                onClick={() => document.getElementById('billing-file-picker')?.click()}
              >
                <svg width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" style={{ color: '#94a3b8', marginBottom: '12px' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
                </svg>
                <p style={{ margin: 0, fontSize: '13.5px', fontWeight: 500, color: '#475569' }}>
                  Arraste seu relatório XML, CSV ou Excel aqui
                </p>
                <p style={{ margin: '4px 0 0 0', fontSize: '11.5px', color: '#94a3b8' }}>
                  ou clique para navegar pelos arquivos do seu computador
                </p>
                <input 
                  type="file" 
                  id="billing-file-picker" 
                  accept=".xml,.csv,.xls,.xlsx" 
                  style={{ display: 'none' }} 
                  onChange={handleFileChange}
                />
              </div>
            )}

            {/* Selected File Details */}
            {selectedFile && importProgress === -1 && (
              <div style={{ marginTop: '16px', padding: '10px 14px', backgroundColor: '#f1f5f9', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ color: '#64748b' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {selectedFile.name}
                    </span>
                    <span style={{ fontSize: '10.5px', color: '#94a3b8' }}>
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                </div>
                <button 
                  type="button" 
                  onClick={() => setSelectedFile(null)}
                  style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Remover
                </button>
              </div>
            )}

            {/* Importing Progress Bar */}
            {importProgress >= 0 && (
              <div style={{ marginTop: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#475569', fontWeight: 500, marginBottom: '6px' }}>
                  <span>{importSuccess ? 'Processamento Concluído!' : 'Importando relatório...'}</span>
                  <span>{importProgress}%</span>
                </div>
                
                {/* Progress bar line */}
                <div style={{ width: '100%', height: '8px', backgroundColor: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ 
                    width: `${importProgress}%`, 
                    height: '100%', 
                    backgroundColor: importSuccess ? '#10b981' : '#118CC4', 
                    borderRadius: '4px',
                    transition: 'width 0.1s linear'
                  }}></div>
                </div>

                {importSuccess && (
                  <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#f0fdf4', borderRadius: '6px', border: '1px solid #bbf7d0', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" style={{ color: '#10b981', flexShrink: 0, marginTop: '1px' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p style={{ margin: 0, fontSize: '12.5px', fontWeight: 600, color: '#166534' }}>
                        Sucesso!
                      </p>
                      <p style={{ margin: '2px 0 0 0', fontSize: '11.5px', color: '#15803d' }}>
                        {successMessage || "Faturamento importado com sucesso."}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Footer Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
              <button 
                type="button" 
                className="reports-action-btn secondary"
                onClick={closeImportModal}
                style={{ fontSize: '12.5px', height: '36px', borderColor: '#cbd5e1' }}
              >
                {importSuccess ? 'Concluir' : 'Cancelar'}
              </button>
              
              {!importSuccess && importProgress === -1 && (
                <button 
                  type="button" 
                  className="reports-action-btn primary"
                  disabled={!selectedFile}
                  onClick={handleStartImport}
                  style={{ 
                    backgroundColor: '#118CC4', 
                    borderColor: '#118CC4', 
                    fontSize: '12.5px', 
                    height: '36px',
                    opacity: selectedFile ? 1 : 0.5,
                    cursor: selectedFile ? 'pointer' : 'not-allowed'
                  }}
                >
                  Confirmar Importação
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: INCLUIR / EDITAR FATURAMENTO */}
      {isFormModalOpen && (
        <div
          className="search-backdrop"
          id="billing-form-modal"
          style={{ display: 'flex', zIndex: 3000 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsFormModalOpen(false);
          }}
        >
          <div className="search-modal-card" style={{ width: '500px' }}>
            <div className="search-input-wrapper" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>
                {editingRecord ? 'Editar Faturamento' : 'Incluir Faturamento Manual'}
              </h3>
              <span className="search-close-key" style={{ cursor: 'pointer', fontSize: '12px' }} onClick={() => setIsFormModalOpen(false)}>Fechar (X)</span>
            </div>

            <form style={{ padding: '20px 24px 24px 24px' }} onSubmit={handleSubmitForm}>
              <div style={{ display: 'flex', gap: '15px', marginBottom: '14px' }}>
                <div className="login-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label htmlFor="billing-form-date">Data</label>
                  <input
                    type="date"
                    id="billing-form-date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    style={{ background: '#f8fafc' }}
                  />
                </div>
                <div className="login-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label htmlFor="billing-form-branch">Filial</label>
                  <select
                    id="billing-form-branch"
                    required
                    value={formBranch}
                    onChange={(e) => setFormBranch(e.target.value)}
                  >
                    {BRANCH_OPTIONS.map((branch) => (
                      <option key={branch} value={branch}>{branch}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '15px', marginBottom: '14px' }}>
                <div className="login-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label htmlFor="billing-form-value">Valor Faturado (R$)</label>
                  <input
                    type="number"
                    id="billing-form-value"
                    step="0.01"
                    min="0"
                    required
                    value={formValue}
                    onChange={(e) => setFormValue(e.target.value)}
                    autoComplete="off"
                  />
                </div>
                <div className="login-group" style={{ flex: 1, marginBottom: 0 }}>
                  <label htmlFor="billing-form-notes">Qtd. Doctos.</label>
                  <input
                    type="number"
                    id="billing-form-notes"
                    min="0"
                    step="1"
                    required
                    value={formNotesCount}
                    onChange={(e) => setFormNotesCount(e.target.value)}
                    autoComplete="off"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                <button
                  type="button"
                  className="reports-action-btn secondary"
                  onClick={() => setIsFormModalOpen(false)}
                  style={{ fontSize: '12.5px', height: '36px', borderColor: '#cbd5e1' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="reports-action-btn primary"
                  disabled={createBillingRecord.isPending || updateBillingRecord.isPending}
                  style={{ backgroundColor: '#118CC4', borderColor: '#118CC4', fontSize: '12.5px', height: '36px' }}
                >
                  {editingRecord ? 'Salvar Alterações' : 'Incluir Faturamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinanceiroBilling;
