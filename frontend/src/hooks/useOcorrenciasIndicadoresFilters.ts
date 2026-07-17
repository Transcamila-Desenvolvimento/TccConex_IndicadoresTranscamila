import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { OpsIndicadoresGranularity } from '../types/domain';
import {
  ALL_MONTHS,
  effectiveGranularity,
  monthsForApi,
  resolveDefaultYear,
} from '../workspaces/Indicadores/ocorrenciasFilters';

export function useOcorrenciasIndicadoresFilters() {
  const [filial, setFilial] = useState('');
  const [year, setYear] = useState<number | ''>('');
  const [months, setMonths] = useState<number[]>(() => [...ALL_MONTHS]);
  const [granularity, setGranularity] = useState<OpsIndicadoresGranularity>('month');
  const yearInitialized = useRef(false);

  const dayViewAllowed = months.length === 1;
  const effective = effectiveGranularity(months, granularity);
  const monthsParam = monthsForApi(months);

  // Sem exatamente 1 mês selecionado, a visão diária volta para mensal.
  useEffect(() => {
    if (!dayViewAllowed && granularity === 'day') {
      setGranularity('month');
    }
  }, [dayViewAllowed, granularity]);

  const applyDefaultYear = useCallback((availableYears: number[]) => {
    if (yearInitialized.current || availableYears.length === 0) return;
    yearInitialized.current = true;
    setYear(resolveDefaultYear(availableYears));
  }, []);

  const clearFilters = useCallback((availableYears: number[] = []) => {
    setFilial('');
    setMonths([...ALL_MONTHS]);
    setGranularity('month');
    setYear(resolveDefaultYear(availableYears));
  }, []);

  const queryParams = useMemo(
    () => ({
      filial: filial || undefined,
      year: year === '' ? undefined : year,
      months: monthsParam,
      granularity: effective,
    }),
    [filial, year, monthsParam, effective],
  );

  return {
    filial,
    setFilial,
    year,
    setYear,
    months,
    setMonths,
    granularity,
    setGranularity,
    dayViewAllowed,
    effectiveGranularity: effective,
    queryParams,
    applyDefaultYear,
    clearFilters,
  };
}
