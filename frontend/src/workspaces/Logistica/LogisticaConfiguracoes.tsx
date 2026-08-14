import React from 'react';
import LogisticaMetaFaturamentoConfigSection from './LogisticaMetaFaturamentoConfigSection';
import LogisticaSettingsAccordionItem from './LogisticaSettingsAccordionItem';

const LogisticaConfiguracoes: React.FC = () => {
  return (
    <div className="logistica-settings-page">
      <header className="logistica-settings-header">
        <h1>Configurações gerais</h1>
        <p>Expanda cada item para configurar parâmetros do ambiente de Logística.</p>
      </header>

      <div className="logistica-settings-accordion">
        <LogisticaSettingsAccordionItem label="Meta de faturamento">
          <LogisticaMetaFaturamentoConfigSection />
        </LogisticaSettingsAccordionItem>
      </div>
    </div>
  );
};

export default LogisticaConfiguracoes;
