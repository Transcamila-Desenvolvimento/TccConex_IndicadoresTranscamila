import React, { useEffect, useMemo, useRef, useState } from 'react';
import QueryDataPanel from '../../components/QueryDataPanel';
import { useAuth } from '../../contexts/AuthContext';
import { userHasFuncao } from '../../constants/funcoes';
import {
  getComercialErrorMessage,
  useComercialParametros,
  useRestaurarComercialParametros,
  useSaveComercialParametros,
} from '../../hooks/useComercialClientes';
import type { ParametrosComercial } from '../../types/domain';

type ListaKey = 'validades' | 'vigencias' | 'prazosFaturamento';
type PadraoKey = 'validadePadrao' | 'vigenciaPadrao' | 'faturamentoPadrao';

type FormState = {
  validades: string[];
  validadePadrao: string;
  vigencias: string[];
  vigenciaPadrao: string;
  prazosFaturamento: string[];
  faturamentoPadrao: string;
  logoPdfUrl: string | null;
  logoEmailUrl: string | null;
};

const emptyForm = (): FormState => ({
  validades: [],
  validadePadrao: '',
  vigencias: [],
  vigenciaPadrao: '',
  prazosFaturamento: [],
  faturamentoPadrao: '',
  logoPdfUrl: null,
  logoEmailUrl: null,
});

const fromApi = (data: ParametrosComercial): FormState => ({
  validades: [...(data.validades ?? [])],
  validadePadrao: data.validadePadrao || '',
  vigencias: [...(data.vigencias ?? [])],
  vigenciaPadrao: data.vigenciaPadrao || '',
  prazosFaturamento: [...(data.prazosFaturamento ?? [])],
  faturamentoPadrao: data.faturamentoPadrao || '',
  logoPdfUrl: data.logoPdfUrl ?? null,
  logoEmailUrl: data.logoEmailUrl ?? null,
});

const readFileAsDataUrl = (file: File): Promise<string> => (
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    reader.readAsDataURL(file);
  })
);

type ListaEditorProps = {
  titulo: string;
  descricao: string;
  items: string[];
  padrao: string;
  canManage: boolean;
  novoLabel: string;
  onAdd: (valor: string) => void;
  onRemove: (valor: string) => void;
  onPadrao: (valor: string) => void;
};

function ListaEditor({
  titulo,
  descricao,
  items,
  padrao,
  canManage,
  novoLabel,
  onAdd,
  onRemove,
  onPadrao,
}: ListaEditorProps) {
  const [novo, setNovo] = useState('');

  const handleAdd = () => {
    const valor = novo.trim();
    if (!valor) return;
    onAdd(valor);
    setNovo('');
  };

  return (
    <section className="comercial-param-card">
      <header className="comercial-param-card-head">
        <h2>{titulo}</h2>
        <p>{descricao}</p>
      </header>
      <ul className="comercial-param-list">
        {items.map((item) => (
          <li key={item} className={item === padrao ? 'is-padrao' : undefined}>
            <label className="comercial-param-option">
              <input
                type="radio"
                name={`padrao-${titulo}`}
                checked={item === padrao}
                disabled={!canManage}
                onChange={() => onPadrao(item)}
              />
              <span>{item}</span>
              {item === padrao ? <em>padrão</em> : null}
            </label>
            {canManage ? (
              <button
                type="button"
                className="comercial-param-remove"
                title={`Remover ${item}`}
                disabled={items.length <= 1}
                onClick={() => onRemove(item)}
              >
                <i className="bi bi-trash" aria-hidden />
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {canManage ? (
        <div className="comercial-param-add">
          <input
            type="text"
            value={novo}
            maxLength={120}
            placeholder={novoLabel}
            onChange={(e) => setNovo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAdd();
              }
            }}
          />
          <button
            type="button"
            className="reports-action-btn secondary"
            disabled={!novo.trim()}
            onClick={handleAdd}
          >
            Adicionar
          </button>
        </div>
      ) : null}
    </section>
  );
}

type LogoFieldProps = {
  label: string;
  hint: string;
  value: string | null;
  canManage: boolean;
  onChange: (url: string | null) => void;
};

function LogoField({ label, hint, value, canManage, onChange }: LogoFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      window.alert('Selecione uma imagem (PNG, JPG ou WEBP).');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      window.alert('A logo deve ter no máximo 2 MB.');
      return;
    }
    try {
      onChange(await readFileAsDataUrl(file));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Não foi possível carregar a imagem.');
    }
  };

  return (
    <section className="comercial-param-card comercial-param-card--logo">
      <header className="comercial-param-card-head">
        <h2>{label}</h2>
        <p>{hint}</p>
      </header>
      <div className="comercial-param-logo">
        <div className="comercial-param-logo-preview">
          {value ? (
            <img src={value} alt={`Pré-visualização — ${label}`} />
          ) : (
            <span>Sem logo (usa a padrão do sistema)</span>
          )}
        </div>
        {canManage ? (
          <div className="comercial-param-logo-actions">
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              hidden
              onChange={(e) => {
                void handleFile(e.target.files?.[0] ?? null);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              className="reports-action-btn secondary"
              onClick={() => inputRef.current?.click()}
            >
              Escolher imagem
            </button>
            {value ? (
              <button
                type="button"
                className="reports-action-btn secondary"
                onClick={() => onChange(null)}
              >
                Remover
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

const ComercialCadastroParametros: React.FC = () => {
  const { user } = useAuth();
  const canManage = userHasFuncao(user, 'Comercial', 'gerenciar-parametros');
  const parametrosQuery = useComercialParametros();
  const saveParametros = useSaveComercialParametros();
  const restaurarParametros = useRestaurarComercialParametros();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [baseline, setBaseline] = useState<FormState>(emptyForm);

  useEffect(() => {
    if (parametrosQuery.data) {
      const next = fromApi(parametrosQuery.data);
      setForm(next);
      setBaseline(next);
    }
  }, [parametrosQuery.data]);

  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(baseline),
    [form, baseline],
  );

  const updateLista = (key: ListaKey, items: string[]) => {
    setForm((current) => {
      const next = { ...current, [key]: items };
      const padraoKey: PadraoKey = key === 'validades'
        ? 'validadePadrao'
        : key === 'vigencias'
          ? 'vigenciaPadrao'
          : 'faturamentoPadrao';
      if (!items.includes(next[padraoKey])) {
        next[padraoKey] = items[0] || '';
      }
      return next;
    });
  };

  const addItem = (key: ListaKey, valor: string) => {
    setForm((current) => {
      if (current[key].includes(valor)) return current;
      return { ...current, [key]: [...current[key], valor] };
    });
  };

  const removeItem = (key: ListaKey, valor: string) => {
    updateLista(key, form[key].filter((item) => item !== valor));
  };

  const handleSave = (event?: React.FormEvent) => {
    event?.preventDefault();
    saveParametros.mutate({
      validades: form.validades,
      validadePadrao: form.validadePadrao,
      vigencias: form.vigencias,
      vigenciaPadrao: form.vigenciaPadrao,
      prazosFaturamento: form.prazosFaturamento,
      faturamentoPadrao: form.faturamentoPadrao,
      logoPdfUrl: form.logoPdfUrl,
      logoEmailUrl: form.logoEmailUrl,
    }, {
      onSuccess: (data) => {
        const next = fromApi(data);
        setForm(next);
        setBaseline(next);
      },
      onError: (err) => alert(getComercialErrorMessage(err)),
    });
  };

  const handleRestaurar = () => {
    if (!window.confirm(
      'Restaurar validades, vigências e prazos de faturamento ao padrão? As logos não serão alteradas.',
    )) {
      return;
    }
    restaurarParametros.mutate(undefined, {
      onSuccess: (data) => {
        const next = fromApi(data);
        setForm(next);
        setBaseline(next);
      },
      onError: (err) => alert(getComercialErrorMessage(err)),
    });
  };

  return (
    <div className="fat-list-compact comercial-param-page">
      <header className="view-header comercial-param-page-header">
        <div className="comercial-param-page-title">
          <div className="comercial-param-page-accent" />
          <h1 className="view-page-title">Parâmetros</h1>
        </div>
        {canManage ? (
          <div className="comercial-param-page-actions">
            <button
              type="button"
              className="reports-action-btn secondary"
              disabled={restaurarParametros.isPending || saveParametros.isPending}
              onClick={handleRestaurar}
            >
              {restaurarParametros.isPending ? 'Restaurando...' : 'Restaurar listas'}
            </button>
            <button
              type="button"
              className="reports-action-btn primary"
              style={{ backgroundColor: '#118CC4', borderColor: '#118CC4' }}
              disabled={!isDirty || saveParametros.isPending}
              onClick={() => handleSave()}
            >
              {saveParametros.isPending ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        ) : null}
      </header>

      <QueryDataPanel
        query={parametrosQuery}
        refreshVariant="overlay"
        loadingMessage="Carregando parâmetros..."
        refreshingMessage="Atualizando parâmetros..."
        errorMessage="Não foi possível carregar os parâmetros do Comercial."
      >
        <form className="comercial-param-layout" onSubmit={handleSave}>
          <div className="comercial-param-row comercial-param-row--listas">
            <ListaEditor
              titulo="Validades"
              descricao="Opções e padrão das novas propostas."
              items={form.validades}
              padrao={form.validadePadrao}
              canManage={canManage}
              novoLabel="Ex.: 20 dias"
              onAdd={(valor) => addItem('validades', valor)}
              onRemove={(valor) => removeItem('validades', valor)}
              onPadrao={(valor) => setForm((current) => ({ ...current, validadePadrao: valor }))}
            />
            <ListaEditor
              titulo="Vigência do contrato"
              descricao="Opções de vigência contratual."
              items={form.vigencias}
              padrao={form.vigenciaPadrao}
              canManage={canManage}
              novoLabel="Ex.: 18 meses"
              onAdd={(valor) => addItem('vigencias', valor)}
              onRemove={(valor) => removeItem('vigencias', valor)}
              onPadrao={(valor) => setForm((current) => ({ ...current, vigenciaPadrao: valor }))}
            />
            <ListaEditor
              titulo="Prazos de faturamento"
              descricao="Opções de prazo / DDL."
              items={form.prazosFaturamento}
              padrao={form.faturamentoPadrao}
              canManage={canManage}
              novoLabel="Ex.: Mensal / 45 DDL"
              onAdd={(valor) => addItem('prazosFaturamento', valor)}
              onRemove={(valor) => removeItem('prazosFaturamento', valor)}
              onPadrao={(valor) => setForm((current) => ({ ...current, faturamentoPadrao: valor }))}
            />
          </div>

          <div className="comercial-param-row comercial-param-row--logos">
            <LogoField
              label="Logo do PDF"
              hint="Usada no rodapé/assinatura do PDF da proposta."
              value={form.logoPdfUrl}
              canManage={canManage}
              onChange={(url) => setForm((current) => ({ ...current, logoPdfUrl: url }))}
            />
            <LogoField
              label="Logo do e-mail"
              hint="Embutida no e-mail. Se vazia, usa a do PDF ou a padrão."
              value={form.logoEmailUrl}
              canManage={canManage}
              onChange={(url) => setForm((current) => ({ ...current, logoEmailUrl: url }))}
            />
          </div>
        </form>
      </QueryDataPanel>
    </div>
  );
};

export default ComercialCadastroParametros;
