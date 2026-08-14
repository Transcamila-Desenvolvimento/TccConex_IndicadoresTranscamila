import React, { useEffect, useId, useState } from 'react';

type LogisticaSettingsAccordionItemProps = {
  label: string;
  hint?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
};

const LogisticaSettingsAccordionItem: React.FC<LogisticaSettingsAccordionItemProps> = ({
  label,
  hint,
  defaultOpen = false,
  children,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const [mounted, setMounted] = useState(defaultOpen);
  const panelId = useId();

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  return (
    <section className={`logistica-settings-accordion-item ${open ? 'is-open' : ''}`}>
      <button
        type="button"
        className="logistica-settings-accordion-trigger"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="logistica-settings-accordion-title">
          <span className="logistica-settings-accordion-prefix">Configurações:</span>
          <span className="logistica-settings-accordion-label">{label}</span>
        </span>
        {hint && !open && (
          <span className="logistica-settings-accordion-hint">{hint}</span>
        )}
        <svg
          className="logistica-settings-accordion-chevron"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      <div className="logistica-settings-accordion-body-wrap">
        <div id={panelId} className="logistica-settings-accordion-body">
          {mounted ? children : null}
        </div>
      </div>
    </section>
  );
};

export default LogisticaSettingsAccordionItem;
