// Coordenadas aproximadas (centroide econômico) dos estados brasileiros
// Usado pelo globo 3D para posicionar markers de leads por estado.

export interface StateCoord {
  uf: string;
  name: string;
  lat: number;
  lng: number;
}

export const STATE_COORDS: StateCoord[] = [
  { uf: "SP", name: "São Paulo", lat: -23.55, lng: -46.63 },
  { uf: "RJ", name: "Rio de Janeiro", lat: -22.9, lng: -43.17 },
  { uf: "MG", name: "Minas Gerais", lat: -19.91, lng: -43.94 },
  { uf: "DF", name: "Distrito Federal", lat: -15.79, lng: -47.88 },
  { uf: "BA", name: "Bahia", lat: -12.97, lng: -38.5 },
  { uf: "CE", name: "Ceará", lat: -3.73, lng: -38.52 },
  { uf: "PE", name: "Pernambuco", lat: -8.05, lng: -34.88 },
  { uf: "RS", name: "Rio Grande do Sul", lat: -30.03, lng: -51.23 },
  { uf: "PR", name: "Paraná", lat: -25.42, lng: -49.27 },
  { uf: "SC", name: "Santa Catarina", lat: -27.59, lng: -48.55 },
  { uf: "GO", name: "Goiás", lat: -16.68, lng: -49.25 },
  { uf: "AM", name: "Amazonas", lat: -3.12, lng: -60.02 },
  { uf: "PA", name: "Pará", lat: -1.46, lng: -48.49 },
  { uf: "ES", name: "Espírito Santo", lat: -20.32, lng: -40.34 },
  { uf: "MA", name: "Maranhão", lat: -2.53, lng: -44.3 },
  { uf: "PB", name: "Paraíba", lat: -7.12, lng: -34.86 },
  { uf: "RN", name: "Rio Grande do Norte", lat: -5.79, lng: -35.21 },
  { uf: "AL", name: "Alagoas", lat: -9.67, lng: -35.74 },
  { uf: "SE", name: "Sergipe", lat: -10.91, lng: -37.07 },
  { uf: "PI", name: "Piauí", lat: -5.09, lng: -42.8 },
  { uf: "TO", name: "Tocantins", lat: -10.25, lng: -48.32 },
  { uf: "MT", name: "Mato Grosso", lat: -15.6, lng: -56.1 },
  { uf: "MS", name: "Mato Grosso do Sul", lat: -20.44, lng: -54.65 },
  { uf: "RO", name: "Rondônia", lat: -8.76, lng: -63.9 },
  { uf: "AC", name: "Acre", lat: -9.97, lng: -67.81 },
  { uf: "RR", name: "Roraima", lat: 2.82, lng: -60.67 },
  { uf: "AP", name: "Amapá", lat: 0.03, lng: -51.07 },
];

export function stateCoord(uf: string): StateCoord | undefined {
  const key = uf.toUpperCase().trim();
  return STATE_COORDS.find((s) => s.uf === key);
}