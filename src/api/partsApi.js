/**
 * Собирает адрес запроса к API.
 * @param {{ number: string, brand?: string, analogues?: boolean }} query
 * @returns {string}
 */
export function buildUrl({ number, brand, analogues = false }) {
  const params = new URLSearchParams({ key: import.meta.env.VITE_API_KEY, number });
  if (brand) params.set('brand', brand);
  if (analogues) params.set('analogues', 'on');
  return `${import.meta.env.VITE_API_URL}?${params}`;
}

/**
 * Запрашивает позиции по артикулу (и бренду с аналогами).
 * @param {{ number: string, brand?: string, analogues?: boolean }} query
 */
export async function fetchGoods(query) {
  const response = await fetch(buildUrl(query));
  return response.json();
}
