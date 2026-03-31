import { isStarkenConfigured } from './starkenService.js';

/**
 * SHIPPING_PROVIDER=estimated (default) — cotización por distancia desde La Reina (sin API Starken).
 * SHIPPING_PROVIDER=starken — usa API Starken (requiere credenciales).
 */
export function shippingProvider() {
  const v = (process.env.SHIPPING_PROVIDER ?? 'estimated').trim().toLowerCase();
  if (v === 'starken') return 'starken';
  return 'estimated';
}

export function isStarkenShippingMode() {
  return shippingProvider() === 'starken';
}

export function isShippingConfigured() {
  if (isStarkenShippingMode()) {
    return isStarkenConfigured();
  }
  return true;
}
