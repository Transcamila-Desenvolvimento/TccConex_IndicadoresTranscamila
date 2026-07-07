import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Limite de erro global: evita que uma exceção não tratada durante a
 * renderização derrube o app inteiro e deixe a tela em branco sem
 * nenhuma mensagem visível para o usuário.
 */
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Erro não tratado capturado pelo ErrorBoundary:', error, info.componentStack);
  }

  private handleReload = () => {
    this.setState({ error: null });
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <div
          role="alert"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            minHeight: '100vh',
            padding: '32px',
            textAlign: 'center',
            fontFamily: 'inherit',
          }}
        >
          <h2 style={{ margin: 0, color: '#1e293b' }}>Ocorreu um erro inesperado</h2>
          <p style={{ margin: 0, color: '#64748b', maxWidth: '520px' }}>
            Algo deu errado ao carregar esta tela. Tente recarregar a página; se o problema
            persistir, contate o suporte técnico informando a mensagem abaixo.
          </p>
          <pre
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '12px 16px',
              maxWidth: '90vw',
              overflowX: 'auto',
              color: '#ef4444',
              fontSize: '13px',
              textAlign: 'left',
            }}
          >
            {this.state.error.message}
          </pre>
          <button
            type="button"
            onClick={this.handleReload}
            className="btn-login"
            style={{ maxWidth: '220px' }}
          >
            Recarregar página
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
