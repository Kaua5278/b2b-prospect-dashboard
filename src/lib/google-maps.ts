/**
 * Gera URL do Google Maps que abre o perfil da empresa + localização.
 * Usa as coordenadas quando existem (pin exato) e o nome/endereço para
 * a busca encontrar a ficha do Google Business Profile.
 *
 * Formato oficial: https://developers.google.com/maps/documentation/urls/get-started
 */

interface MapsLeadLike {
  trade_name?: string | null;
  company_name: string;
  address?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  gps_coordinates?: { latitude?: number | null; longitude?: number | null } | null;
  latitude?: number | null;
  longitude?: number | null;
}

export function googleMapsUrl(lead: MapsLeadLike): string {
  // Nome fantasia tem prioridade (é como aparece na ficha do Google)
  const name = lead.trade_name || lead.company_name;

  const parts = [name];
  if (lead.address) parts.push(lead.address);
  if (lead.neighborhood) parts.push(lead.neighborhood);
  if (lead.city) parts.push(lead.city);
  if (lead.state) parts.push(lead.state);

  // Coordenadas (do OSM ou do banco)
  const lat = lead.gps_coordinates?.latitude ?? lead.latitude;
  const lon = lead.gps_coordinates?.longitude ?? lead.longitude;

  // Busca textual com nome + endereço/cidade → Google acha a ficha (Business Profile)
  // e mostra o pin no mapa. Funciona com ou sem coordenadas.
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts.join(', '))}`;
}

/** Versão com pin direto nas coordenadas (usada como fallback / precisão) */
export function googleMapsCoordsUrl(lat?: number | null, lon?: number | null): string | null {
  if (typeof lat !== 'number' || typeof lon !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
}