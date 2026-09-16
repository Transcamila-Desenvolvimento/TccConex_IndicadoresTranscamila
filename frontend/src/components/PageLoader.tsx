import React from 'react';

type PageLoaderProps = {
  message?: string;
  className?: string;
};

const PageLoader: React.FC<PageLoaderProps> = ({ message = 'Carregando ambiente...', className }) => (
  <div className={['page-loader', className].filter(Boolean).join(' ')} role="status" aria-live="polite">
    <div className="page-loader-spinner" aria-hidden="true" />
    <span className="page-loader-label">{message}</span>
  </div>
);

export default PageLoader;
