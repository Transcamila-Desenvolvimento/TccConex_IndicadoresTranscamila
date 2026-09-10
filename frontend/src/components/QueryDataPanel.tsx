import React from 'react';
import {
  useAsyncQueryState,
  type QueryResultLike,
} from '../hooks/useAsyncQueryState';

function describeQueryError(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const err = error as {
    message?: string;
    response?: { status?: number; data?: { detail?: unknown } };
  };
  const detail = err.response?.data?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail;
  const status = err.response?.status;
  if (status === 401) return 'Sessão expirada. Saia e entre novamente.';
  if (status === 403) return 'Sem permissão para carregar estes registros.';
  if (status === 500) return 'Erro interno no servidor.';
  if (err.message && /network error/i.test(err.message)) {
    return 'Sem conexão com a API. Verifique se o backend está em execução.';
  }
  if (err.message && /status code 50/i.test(err.message)) {
    return 'O servidor da API não respondeu corretamente.';
  }
  return err.message?.trim() || null;
}

interface QueryDataPanelProps {
  query: QueryResultLike<unknown>;
  loadingMessage?: string;
  refreshingMessage?: string;
  errorMessage?: string;
  className?: string;
  /** `page` = bloco principal; `compact` = modais e áreas menores */
  variant?: 'page' | 'compact';
  /**
   * Usa o visual "página inteira" do loader inicial (mesmo spinner/tipografia
   * do loader de rota exibido no `Suspense` do lazy loading) mesmo quando o
   * conteúdo carregado usa `variant="compact"` — necessário quando o container
   * da tela não segue a cadeia flex de `--page` (ex.: rolagem própria da
   * página). Isso evita que o usuário veja dois loaders com estilos
   * diferentes em sequência. Por padrão, segue `variant !== 'compact'`.
   */
  fullPageLoader?: boolean;
  /**
   * `inline` — faixa acima do conteúdo (padrão legado).
   * `overlay` — sobrepõe o conteúdo sem deslocar o layout.
   */
  refreshVariant?: 'inline' | 'overlay';
  children: React.ReactNode;
}

const AsyncQuerySpinner: React.FC = () => (
  <span className="async-query-spinner" aria-hidden="true" />
);

const QueryDataPanel: React.FC<QueryDataPanelProps> = ({
  query,
  loadingMessage = 'Carregando dados...',
  refreshingMessage = 'Atualizando...',
  errorMessage = 'Não foi possível carregar os dados. Tente novamente.',
  className,
  variant = 'page',
  fullPageLoader,
  refreshVariant = 'inline',
  children,
}) => {
  const { showInitialLoader, showRefreshing, showError } = useAsyncQueryState(query);

  const isFullLoader = fullPageLoader ?? variant !== 'compact';
  const loadingClass = [
    'async-query-loading',
    isFullLoader ? 'async-query-loading--page' : 'async-query-loading--compact',
  ].join(' ');
  const errorClass =
    variant === 'compact' ? 'async-query-error async-query-error--compact' : 'async-query-error';

  if (showInitialLoader) {
    return (
      <div className={loadingClass} role="status" aria-live="polite">
        <AsyncQuerySpinner />
        <span className="async-query-label">{loadingMessage}</span>
      </div>
    );
  }

  if (showError) {
    const errorDetail = describeQueryError(query.error);
    return (
      <div className={errorClass} role="alert">
        <span>{errorMessage}</span>
        {errorDetail && errorDetail !== errorMessage ? (
          <span className="async-query-error-detail">{errorDetail}</span>
        ) : null}
        {query.refetch ? (
          <button
            type="button"
            className="async-query-error-retry"
            onClick={() => { void query.refetch?.({ cancelRefetch: true }); }}
          >
            Tentar novamente
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={[
        className,
        variant === 'page' ? 'async-query-content--page' : '',
        refreshVariant === 'overlay' ? 'async-query-content--overlay-host' : '',
        showRefreshing && refreshVariant === 'overlay'
          ? 'async-query-content async-query-content--refreshing-overlay'
          : showRefreshing
            ? 'async-query-content async-query-content--refreshing'
            : 'async-query-content',
      ].filter(Boolean).join(' ')}
    >
      {showRefreshing && refreshVariant === 'overlay' && (
        <div className="async-query-refresh-overlay" role="status" aria-live="polite" aria-busy="true">
          <div className="async-query-refresh-card">
            <AsyncQuerySpinner />
            <span>{refreshingMessage}</span>
          </div>
        </div>
      )}
      {showRefreshing && refreshVariant === 'inline' && (
        <div className="async-query-loading async-query-loading--inline" role="status" aria-live="polite">
          <AsyncQuerySpinner />
          <span>{refreshingMessage}</span>
        </div>
      )}
      <div
        className={[
          variant === 'page' ? 'async-query-content-body--page' : undefined,
          showRefreshing && refreshVariant === 'overlay' ? 'async-query-content-body--dimmed' : undefined,
        ].filter(Boolean).join(' ') || undefined}
      >
        {children}
      </div>
    </div>
  );
};

export default QueryDataPanel;
