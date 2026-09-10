let carregando: Promise<void> | null = null;

export function loadGoogleMapsScript(apiKey: string): Promise<void> {
  if (window.google?.maps) return Promise.resolve();
  if (carregando) return carregando;
  carregando = new Promise((resolve, reject) => {
    const existente = document.getElementById('google-maps-js');
    if (existente) {
      existente.addEventListener('load', () => resolve());
      existente.addEventListener('error', () => reject(new Error('Não foi possível carregar o Google Maps.')));
      return;
    }
    const script = document.createElement('script');
    script.id = 'google-maps-js';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      carregando = null;
      reject(new Error('Não foi possível carregar o Google Maps. Habilite a Maps JavaScript API nesta chave.'));
    };
    document.head.appendChild(script);
  });
  return carregando;
}
