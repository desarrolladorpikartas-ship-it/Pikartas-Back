import { ESTIMATED_DESTINATIONS } from './estimatedShippingDestinations.js';

const EARTH_RADIUS_KM = 6371;

function toRad(d) {
  return (d * Math.PI) / 180;
}

/** Distancia en km entre dos puntos WGS84 */
export function haversineKm(lat1, lng1, lat2, lng2) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

function parseEnvFloat(key, fallback) {
  const v = parseFloat(process.env[key] ?? '');
  return Number.isFinite(v) ? v : fallback;
}

function parseEnvInt(key, fallback) {
  const v = parseInt(process.env[key] ?? '', 10);
  return Number.isFinite(v) ? v : fallback;
}

export function getOriginPoint() {
  return {
    lat: parseEnvFloat('ESTIMATED_SHIPPING_ORIGIN_LAT', -33.4467),
    lng: parseEnvFloat('ESTIMATED_SHIPPING_ORIGIN_LNG', -70.5386)
  };
}

/**
 * @returns {{ base: number, perKm: number, min: number, max: number }}
 */
export function getEstimateTariff() {
  return {
    base: parseEnvInt('ESTIMATED_SHIPPING_BASE_PESOS', 2500),
    perKm: parseEnvInt('ESTIMATED_SHIPPING_PER_KM', 120),
    min: parseEnvInt('ESTIMATED_SHIPPING_MIN_PESOS', 2500),
    max: parseEnvInt('ESTIMATED_SHIPPING_MAX_PESOS', 45000)
  };
}

/**
 * Costo estimado en CLP según distancia desde el origen (La Reina por defecto) al destino.
 * @param {number} codigoCiudadDestino - id interno (tabla ESTIMATED_DESTINATIONS)
 */
export function estimateShippingCost(codigoCiudadDestino) {
  const id = parseInt(codigoCiudadDestino, 10);
  if (!Number.isFinite(id) || id <= 0) {
    const err = new Error('Código de destino de envío inválido.');
    err.code = 'ESTIMATE_INVALID_DEST';
    throw err;
  }

  const row = ESTIMATED_DESTINATIONS.find((d) => d.codigoCiudad === id);
  if (!row) {
    const err = new Error('Destino de envío no disponible. Elige otra comuna o ciudad.');
    err.code = 'ESTIMATE_UNKNOWN_DEST';
    throw err;
  }

  const origin = getOriginPoint();
  const km = haversineKm(origin.lat, origin.lng, row.lat, row.lng);
  const { base, perKm, min, max } = getEstimateTariff();
  const raw = base + perKm * km;
  const rounded = Math.round(raw);
  return Math.min(max, Math.max(min, rounded));
}

/**
 * Respuesta compatible con el checkout (lista plana + agrupación vacía para compat).
 */
export function getEstimatedDestinations() {
  const flat = ESTIMATED_DESTINATIONS.map(({ codigoCiudad, nombreCiudad }) => ({
    codigoCiudad,
    nombreCiudad
  })).sort((a, b) => a.nombreCiudad.localeCompare(b.nombreCiudad, 'es'));

  return {
    ciudades: [],
    flat,
    mode: 'estimated'
  };
}
