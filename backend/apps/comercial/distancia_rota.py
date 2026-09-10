"""Cálculo de distância rodoviária entre localidades (geocodificação + roteamento)."""

from __future__ import annotations

import json
import math
import os
import ssl
import urllib.error
import urllib.parse
import urllib.request

NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
OSRM_URL = 'https://router.project-osrm.org/route/v1/driving'
GOOGLE_GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json'
GOOGLE_DISTANCE_URL = 'https://maps.googleapis.com/maps/api/distancematrix/json'
GOOGLE_PLACES_TEXT_URL = 'https://maps.googleapis.com/maps/api/place/textsearch/json'
USER_AGENT = 'TccConex-ERP/1.0'


class RotaDistanciaError(Exception):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.status = status


def _get_json(url: str, timeout: int = 12) -> object:
    ctx = ssl.create_default_context()
    request = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
    try:
        with urllib.request.urlopen(request, timeout=timeout, context=ctx) as response:
            return json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as exc:
        raise RotaDistanciaError('Serviço de roteamento indisponível no momento.', status=502) from exc
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as exc:
        raise RotaDistanciaError('Não foi possível calcular a distância entre os locais informados.', status=502) from exc


def google_maps_key() -> str:
    return (os.environ.get('GOOGLE_MAPS_API_KEY') or '').strip()


def usa_google_maps() -> bool:
    return bool(google_maps_key())


def _parse_coord(value, label: str) -> float:
    try:
        return float(value)
    except (TypeError, ValueError) as exc:
        raise RotaDistanciaError(f'Coordenada inválida: {label}.') from exc


def _montar_query_cidade(cidade: str, uf: str = '') -> str:
    cidade = (cidade or '').strip()
    uf = (uf or '').strip().upper()
    if not cidade:
        return ''
    if uf:
        return f'{cidade}, {uf}, Brasil'
    return f'{cidade}, Brasil'


def _montar_query_endereco(endereco: str) -> str:
    endereco = (endereco or '').strip()
    if not endereco:
        return ''
    if 'brasil' not in endereco.lower():
        return f'{endereco}, Brasil'
    return endereco


def _item_para_local(item: dict) -> dict:
    try:
        lat = float(item['lat'])
        lon = float(item['lon'])
    except (KeyError, TypeError, ValueError) as exc:
        raise RotaDistanciaError('Resposta inválida ao geocodificar local.') from exc

    return {
        'nome': item.get('display_name') or '',
        'lat': lat,
        'lon': lon,
    }


def _rotulo_google(item: dict, fallback: str) -> str:
    nome = (item.get('name') or '').strip()
    endereco = (item.get('formatted_address') or item.get('vicinity') or '').strip() or fallback
    if nome and nome.lower() not in endereco.lower():
        return f'{nome} — {endereco}'
    return endereco or nome or fallback


def _ponto_google(item: dict, fallback: str) -> dict | None:
    location = ((item.get('geometry') or {}).get('location') or {})
    try:
        lat = float(location['lat'])
        lon = float(location['lng'])
    except (KeyError, TypeError, ValueError):
        return None
    return {
        'nome': _rotulo_google(item, fallback),
        'lat': lat,
        'lon': lon,
    }


def _locais_google_places(query: str, limit: int) -> list[dict] | None:
    params = urllib.parse.urlencode({
        'query': query,
        'language': 'pt-BR',
        'region': 'br',
        'key': google_maps_key(),
    })
    data = _get_json(f'{GOOGLE_PLACES_TEXT_URL}?{params}')
    if not isinstance(data, dict):
        return None
    status = data.get('status')
    if status == 'REQUEST_DENIED':
        return None
    if status not in {'OK', 'ZERO_RESULTS'}:
        return []
    resultados: list[dict] = []
    for item in (data.get('results') or [])[:limit]:
        if not isinstance(item, dict):
            continue
        ponto = _ponto_google(item, query)
        if ponto:
            resultados.append(ponto)
    return resultados


def _locais_google_geocode(query: str, limit: int) -> list[dict]:
    params = urllib.parse.urlencode({
        'address': query,
        'components': 'country:BR',
        'language': 'pt-BR',
        'region': 'br',
        'key': google_maps_key(),
    })
    data = _get_json(f'{GOOGLE_GEOCODE_URL}?{params}')
    if not isinstance(data, dict):
        raise RotaDistanciaError('Resposta inválida ao geocodificar local.')
    status = data.get('status')
    if status == 'REQUEST_DENIED':
        raise RotaDistanciaError(
            'A chave do Google Maps foi recusada. Verifique GOOGLE_MAPS_API_KEY e as APIs habilitadas.',
            status=502,
        )
    if status not in {'OK', 'ZERO_RESULTS'}:
        raise RotaDistanciaError('Não foi possível geocodificar o local informado.', status=502)
    resultados: list[dict] = []
    for item in (data.get('results') or [])[:limit]:
        if not isinstance(item, dict):
            continue
        ponto = _ponto_google(item, query)
        if ponto:
            resultados.append(ponto)
    return resultados


def _locais_google(query: str, limit: int = 1) -> list[dict]:
    places = _locais_google_places(query, limit)
    if places:
        return places
    return _locais_google_geocode(query, limit)


def geocodificar_texto(query: str, rotulo_erro: str = 'Local') -> dict:
    query = (query or '').strip()
    if not query:
        raise RotaDistanciaError(f'Informe o {rotulo_erro.lower()}.')

    if usa_google_maps():
        locais = _locais_google(query, limit=1)
        if not locais:
            raise RotaDistanciaError(f'{rotulo_erro} não encontrado: {query}.')
        return locais[0]

    params = urllib.parse.urlencode({
        'q': query,
        'format': 'json',
        'limit': 1,
        'countrycodes': 'br',
    })
    data = _get_json(f'{NOMINATIM_URL}?{params}')
    if not isinstance(data, list) or not data:
        raise RotaDistanciaError(f'{rotulo_erro} não encontrado: {query}.')

    return _item_para_local(data[0])


NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse'


def _uf_de_componentes_google(components) -> str:
    if not isinstance(components, list):
        return ''
    for item in components:
        if not isinstance(item, dict):
            continue
        tipos = item.get('types') or []
        if 'administrative_area_level_1' in tipos:
            return str(item.get('short_name') or '').strip().upper()[:2]
    return ''


def reverso_geocodificar(lat, lon) -> dict:
    lat_n = _parse_coord(lat, 'latitude')
    lon_n = _parse_coord(lon, 'longitude')
    if usa_google_maps():
        params = urllib.parse.urlencode({
            'latlng': f'{lat_n},{lon_n}',
            'language': 'pt-BR',
            'region': 'br',
            'key': google_maps_key(),
        })
        data = _get_json(f'{GOOGLE_GEOCODE_URL}?{params}')
        if not isinstance(data, dict):
            raise RotaDistanciaError('Resposta inválida ao localizar o endereço.')
        if data.get('status') == 'REQUEST_DENIED':
            raise RotaDistanciaError(
                'A chave do Google Maps foi recusada. Verifique GOOGLE_MAPS_API_KEY e as APIs habilitadas.',
                status=502,
            )
        if data.get('status') != 'OK' or not data.get('results'):
            raise RotaDistanciaError('Não foi possível identificar o endereço neste ponto do mapa.')
        item = data['results'][0]
        location = ((item.get('geometry') or {}).get('location') or {})
        return {
            'label': item.get('formatted_address') or f'{lat_n:.5f}, {lon_n:.5f}',
            'lat': float(location.get('lat', lat_n)),
            'lon': float(location.get('lng', lon_n)),
            'uf': _uf_de_componentes_google(item.get('address_components')),
        }

    params = urllib.parse.urlencode({
        'lat': lat_n,
        'lon': lon_n,
        'format': 'json',
        'addressdetails': 1,
        'zoom': 18,
    })
    data = _get_json(f'{NOMINATIM_REVERSE_URL}?{params}')
    if not isinstance(data, dict) or not data.get('display_name'):
        raise RotaDistanciaError('Não foi possível identificar o endereço neste ponto do mapa.')
    address = data.get('address') if isinstance(data.get('address'), dict) else {}
    uf = str(address.get('ISO3166-2-lvl4') or address.get('state_code') or '').replace('BR-', '').strip().upper()[:2]
    return {
        'label': data.get('display_name') or f'{lat_n:.5f}, {lon_n:.5f}',
        'lat': lat_n,
        'lon': lon_n,
        'uf': uf,
    }


def geocodificar_cidade(cidade: str, uf: str = '') -> dict:
    query = _montar_query_cidade(cidade, uf)
    if not query:
        raise RotaDistanciaError('Informe o nome da cidade.')
    return geocodificar_texto(query, rotulo_erro='Cidade')


def geocodificar_endereco(endereco: str) -> dict:
    query = _montar_query_endereco(endereco)
    if not query:
        raise RotaDistanciaError('Informe o endereço.')
    return geocodificar_texto(query, rotulo_erro='Endereço')


def buscar_enderecos(texto: str, limit: int = 6) -> list[dict]:
    texto = (texto or '').strip()
    if len(texto) < 3:
        return []

    limit = max(1, min(int(limit or 6), 10))
    if usa_google_maps():
        locais = _locais_google(texto, limit=limit)
        return [{'label': item['nome'], 'lat': item['lat'], 'lon': item['lon']} for item in locais]

    params = urllib.parse.urlencode({
        'q': _montar_query_endereco(texto),
        'format': 'json',
        'limit': limit,
        'countrycodes': 'br',
        'addressdetails': 0,
    })
    data = _get_json(f'{NOMINATIM_URL}?{params}')
    if not isinstance(data, list):
        return []

    resultados: list[dict] = []
    for item in data:
        if not isinstance(item, dict):
            continue
        try:
            local = _item_para_local(item)
        except RotaDistanciaError:
            continue
        resultados.append({
            'label': local['nome'],
            'lat': local['lat'],
            'lon': local['lon'],
        })
    return resultados


def _resolver_local(
    *,
    texto: str = '',
    lat: float | None = None,
    lon: float | None = None,
    geocodificar,
    rotulo_erro: str,
) -> dict:
    if lat is not None and lon is not None:
        return {
            'nome': (texto or '').strip() or f'{lat:.5f}, {lon:.5f}',
            'lat': _parse_coord(lat, f'{rotulo_erro} (lat)'),
            'lon': _parse_coord(lon, f'{rotulo_erro} (lon)'),
        }
    return geocodificar(texto)


def _calcular_rota_google(origem: dict, destino: dict) -> dict:
    params = urllib.parse.urlencode({
        'origins': f"{origem['lat']},{origem['lon']}",
        'destinations': f"{destino['lat']},{destino['lon']}",
        'mode': 'driving',
        'language': 'pt-BR',
        'units': 'metric',
        'key': google_maps_key(),
    })
    data = _get_json(f'{GOOGLE_DISTANCE_URL}?{params}')
    if not isinstance(data, dict):
        raise RotaDistanciaError('Resposta inválida ao calcular rota.')
    if data.get('status') == 'REQUEST_DENIED':
        raise RotaDistanciaError(
            'A chave do Google Maps foi recusada. Verifique GOOGLE_MAPS_API_KEY e as APIs habilitadas.',
            status=502,
        )
    if data.get('status') != 'OK':
        raise RotaDistanciaError('Rota rodoviária não encontrada entre os locais informados.')
    try:
        elemento = data['rows'][0]['elements'][0]
        if elemento.get('status') != 'OK':
            raise RotaDistanciaError('Rota rodoviária não encontrada entre os locais informados.')
        metros = float(elemento['distance']['value'])
    except (KeyError, IndexError, TypeError, ValueError) as exc:
        raise RotaDistanciaError('Resposta inválida ao calcular rota.') from exc
    km = max(1, int(math.ceil(metros / 1000)))
    return {
        'origem': origem['nome'],
        'destino': destino['nome'],
        'km': km,
        'distanciaMetros': int(round(metros)),
        'provedor': 'google',
    }


def _calcular_rota_entre_pontos(origem: dict, destino: dict) -> dict:
    if usa_google_maps():
        return _calcular_rota_google(origem, destino)

    coords = f"{origem['lon']},{origem['lat']};{destino['lon']},{destino['lat']}"
    data = _get_json(f'{OSRM_URL}/{coords}?overview=false')

    if not isinstance(data, dict) or data.get('code') != 'Ok':
        raise RotaDistanciaError('Rota rodoviária não encontrada entre os locais informados.')

    routes = data.get('routes') or []
    if not routes:
        raise RotaDistanciaError('Rota rodoviária não encontrada entre os locais informados.')

    try:
        metros = float(routes[0]['distance'])
    except (KeyError, TypeError, ValueError) as exc:
        raise RotaDistanciaError('Resposta inválida ao calcular rota.') from exc

    km = max(1, int(math.ceil(metros / 1000)))
    return {
        'origem': origem['nome'],
        'destino': destino['nome'],
        'km': km,
        'distanciaMetros': int(round(metros)),
        'provedor': 'osm',
    }


def calcular_distancia_km(
    cidade_origem: str,
    cidade_destino: str,
    uf_origem: str = '',
    uf_destino: str = '',
) -> dict:
    origem = geocodificar_cidade(cidade_origem, uf_origem)
    destino = geocodificar_cidade(cidade_destino, uf_destino)
    resultado = _calcular_rota_entre_pontos(origem, destino)
    return {
        'modo': 'cidade',
        'cidadeOrigem': resultado['origem'],
        'cidadeDestino': resultado['destino'],
        'km': resultado['km'],
        'distanciaMetros': resultado['distanciaMetros'],
        'provedor': resultado.get('provedor') or ('google' if usa_google_maps() else 'osm'),
    }


def calcular_distancia_enderecos(
    endereco_origem: str,
    endereco_destino: str,
    origem_lat: float | None = None,
    origem_lon: float | None = None,
    destino_lat: float | None = None,
    destino_lon: float | None = None,
) -> dict:
    origem = _resolver_local(
        texto=endereco_origem,
        lat=origem_lat,
        lon=origem_lon,
        geocodificar=geocodificar_endereco,
        rotulo_erro='Origem',
    )
    destino = _resolver_local(
        texto=endereco_destino,
        lat=destino_lat,
        lon=destino_lon,
        geocodificar=geocodificar_endereco,
        rotulo_erro='Destino',
    )
    resultado = _calcular_rota_entre_pontos(origem, destino)
    return {
        'modo': 'endereco',
        'enderecoOrigem': resultado['origem'],
        'enderecoDestino': resultado['destino'],
        'km': resultado['km'],
        'distanciaMetros': resultado['distanciaMetros'],
        'provedor': resultado.get('provedor') or ('google' if usa_google_maps() else 'osm'),
    }
