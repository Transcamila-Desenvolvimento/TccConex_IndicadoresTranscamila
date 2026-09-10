import React, { useEffect, useRef, useState } from 'react';
import {
  getComercialErrorMessage,
  useGoogleMapsConfigComercial,
  useReversoEnderecoComercial,
} from '../../hooks/useComercialClientes';
import type { EnderecoSelecionado } from './ComercialEnderecoAutocomplete';
import { loadGoogleMapsScript } from './loadGoogleMapsScript';

type PinoAtivo = 'origem' | 'destino';

type Props = {
  open: boolean;
  origem: EnderecoSelecionado;
  destino: EnderecoSelecionado;
  onClose: () => void;
  onConfirm: (origem: EnderecoSelecionado, destino: EnderecoSelecionado) => void;
};

const BRASIL_CENTER = { lat: -14.235, lng: -51.9253 };

function pinUrl(variante: PinoAtivo) {
  return variante === 'origem'
    ? 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png'
    : 'https://maps.google.com/mapfiles/ms/icons/red-dot.png';
}

export default function ComercialMapaEnderecosModal({
  open,
  origem,
  destino,
  onClose,
  onConfirm,
}: Props) {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const origemMarker = useRef<google.maps.Marker | null>(null);
  const destinoMarker = useRef<google.maps.Marker | null>(null);
  const pinoRef = useRef<PinoAtivo>('origem');
  const origemInit = useRef(origem);
  const destinoInit = useRef(destino);
  origemInit.current = origem;
  destinoInit.current = destino;
  const mapsConfig = useGoogleMapsConfigComercial(open);
  const reverso = useReversoEnderecoComercial();
  const reversoRef = useRef(reverso.mutateAsync);
  reversoRef.current = reverso.mutateAsync;
  const [pinoAtivo, setPinoAtivo] = useState<PinoAtivo>('origem');
  const [origemLocal, setOrigemLocal] = useState<EnderecoSelecionado>(origem);
  const [destinoLocal, setDestinoLocal] = useState<EnderecoSelecionado>(destino);
  const [erroMapa, setErroMapa] = useState('');

  pinoRef.current = pinoAtivo;

  useEffect(() => {
    if (!open) return;
    setOrigemLocal(origem);
    setDestinoLocal(destino);
    setPinoAtivo(origem.lat != null && origem.lon != null && (destino.lat == null || destino.lon == null) ? 'destino' : 'origem');
    setErroMapa('');
  }, [open, origem, destino]);

  useEffect(() => {
    if (!open || !mapEl.current || mapRef.current) return;
    const apiKey = mapsConfig.data?.apiKey;
    if (!mapsConfig.data) return;
    if (!apiKey) {
      setErroMapa('Defina GOOGLE_MAPS_API_KEY no backend e habilite a Maps JavaScript API na chave.');
      return;
    }

    let cancelled = false;
    let clickListener: google.maps.MapsEventListener | null = null;

    const montar = async () => {
      try {
        await loadGoogleMapsScript(apiKey);
        if (cancelled || !mapEl.current) return;
        const map = new google.maps.Map(mapEl.current, {
          center: BRASIL_CENTER,
          zoom: 4,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
        mapRef.current = map;

        const colocarPino = (kind: PinoAtivo, ponto: EnderecoSelecionado) => {
          if (ponto.lat == null || ponto.lon == null) return;
          const markerRef = kind === 'origem' ? origemMarker : destinoMarker;
          markerRef.current?.setMap(null);
          markerRef.current = new google.maps.Marker({
            map,
            position: { lat: ponto.lat, lng: ponto.lon },
            label: kind === 'origem' ? 'A' : 'B',
            icon: pinUrl(kind),
            title: kind === 'origem' ? 'Origem' : 'Destino',
          });
        };

        const origemAtual = origemInit.current;
        const destinoAtual = destinoInit.current;
        colocarPino('origem', origemAtual);
        colocarPino('destino', destinoAtual);
        if (origemAtual.lat != null && origemAtual.lon != null && destinoAtual.lat != null && destinoAtual.lon != null) {
          const bounds = new google.maps.LatLngBounds();
          bounds.extend({ lat: origemAtual.lat, lng: origemAtual.lon });
          bounds.extend({ lat: destinoAtual.lat, lng: destinoAtual.lon });
          map.fitBounds(bounds, 40);
        } else if (origemAtual.lat != null && origemAtual.lon != null) {
          map.setCenter({ lat: origemAtual.lat, lng: origemAtual.lon });
          map.setZoom(12);
        } else if (destinoAtual.lat != null && destinoAtual.lon != null) {
          map.setCenter({ lat: destinoAtual.lat, lng: destinoAtual.lon });
          map.setZoom(12);
        }

        clickListener = map.addListener('click', async (event: google.maps.MapMouseEvent) => {
          const latLng = event.latLng;
          if (!latLng) return;
          const alvo = pinoRef.current;
          try {
            const ponto = await reversoRef.current({ lat: latLng.lat(), lon: latLng.lng() });
            const selecionado: EnderecoSelecionado = {
              label: ponto.label,
              lat: ponto.lat,
              lon: ponto.lon,
              uf: ponto.uf,
            };
            const markerRef = alvo === 'origem' ? origemMarker : destinoMarker;
            markerRef.current?.setMap(null);
            markerRef.current = new google.maps.Marker({
              map,
              position: { lat: ponto.lat, lng: ponto.lon },
              label: alvo === 'origem' ? 'A' : 'B',
              icon: pinUrl(alvo),
              title: alvo === 'origem' ? 'Origem' : 'Destino',
            });
            if (alvo === 'origem') {
              setOrigemLocal(selecionado);
              setPinoAtivo('destino');
            } else {
              setDestinoLocal(selecionado);
            }
          } catch (err) {
            alert(getComercialErrorMessage(err));
          }
        });
      } catch (err) {
        if (!cancelled) {
          setErroMapa(err instanceof Error ? err.message : 'Não foi possível abrir o Google Maps.');
        }
      }
    };

    void montar();
    return () => {
      cancelled = true;
      clickListener?.remove();
      origemMarker.current?.setMap(null);
      destinoMarker.current?.setMap(null);
      origemMarker.current = null;
      destinoMarker.current = null;
      mapRef.current = null;
    };
  }, [open, mapsConfig.data]);

  if (!open) return null;

  const podeUsar = Boolean(origemLocal.label.trim() && destinoLocal.label.trim());

  return (
    <div className="search-backdrop tabela-frete-modal-backdrop" style={{ display: 'flex' }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card cotar-mapa-modal">
        <div className="modal-header">
          <h3>Selecionar no mapa</h3>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Fechar"><i className="bi bi-x-lg" /></button>
        </div>
        <div className="modal-body cotar-mapa-body">
          <p className="tabela-frete-hint">
            Clique no Google Maps para marcar a origem (A) e o destino (B). O endereço é preenchido a partir do ponto.
          </p>
          <div className="cotar-mapa-alvos">
            <button
              type="button"
              className={`tabela-frete-simulador-rota-modo-btn${pinoAtivo === 'origem' ? ' is-active' : ''}`}
              onClick={() => setPinoAtivo('origem')}
            >
              Origem (A)
            </button>
            <button
              type="button"
              className={`tabela-frete-simulador-rota-modo-btn${pinoAtivo === 'destino' ? ' is-active' : ''}`}
              onClick={() => setPinoAtivo('destino')}
            >
              Destino (B)
            </button>
            {reverso.isPending ? <span className="cotar-mapa-status">Buscando endereço...</span> : null}
            {mapsConfig.isFetching ? <span className="cotar-mapa-status">Carregando mapa...</span> : null}
          </div>
          {erroMapa ? <p className="tabela-frete-hint">{erroMapa}</p> : null}
          <div ref={mapEl} className="cotar-mapa-canvas" />
          <div className="cotar-mapa-resumo">
            <p><strong>Origem:</strong> {origemLocal.label || 'Clique no mapa'}</p>
            <p><strong>Destino:</strong> {destinoLocal.label || 'Clique no mapa'}</p>
          </div>
        </div>
        <div className="modal-footer tabela-frete-bandas-footer">
          <span />
          <div className="tabela-frete-bandas-footer-actions">
            <button type="button" className="reports-action-btn secondary" onClick={onClose}>Cancelar</button>
            <button
              type="button"
              className="reports-action-btn primary"
              style={{ backgroundColor: '#118CC4', borderColor: '#118CC4' }}
              disabled={!podeUsar}
              onClick={() => onConfirm(origemLocal, destinoLocal)}
            >
              Usar endereços
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
