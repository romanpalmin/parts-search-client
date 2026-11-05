/** Ошибка работы с API: сеть, HTTP-статус, поле `error` в ответе, некорректный ответ. */
export class ApiError extends Error {
  constructor(message, { status } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

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

// Сколько ждём ответ сервиса, прежде чем сообщить об ошибке (иначе при молчащем сервисе лоадер крутится бесконечно)
const REQUEST_TIMEOUT_MS = 15000;
const isTimeout = (error) => error?.name === 'TimeoutError';
const timeoutError = () => new ApiError('Сервис не отвечает, попробуйте позже');

// Известные ошибки сервиса (из документации) по-русски; сам код остаётся в скобках, чтобы его было видно при отладке.
// Неизвестный код показываем как есть.
const SERVICE_ERRORS = {
  'Empty key!': 'Не указан ключ доступа',
  'Invalid key client!': 'Неверный ключ доступа',
  'Empty number goods!': 'Не указан артикул',
  'Request quota exceeded!': 'Превышен лимит запросов по ключу',
};
const describeServiceError = (code) => (SERVICE_ERRORS[code] ? `${SERVICE_ERRORS[code]} (${code})` : code);

// «Ничего не найдено» сервис возвращает как массив с одной «пустой» позицией: пустые brand/number/name,
// count 0 и нулевой goodsID (он непустая строка, поэтому по нему пустоту не определить)
function isEmptyGood(good) {
  return !good.brand && !good.number && !good.name;
}

/**
 * Запрашивает позиции по артикулу (и бренду с аналогами).
 * Пустой результат — пустой массив; сбои — ApiError.
 * @param {{ number: string, brand?: string, analogues?: boolean }} query
 * @returns {Promise<object[]>}
 */
export async function fetchGoods(query) {
  // Один сигнал на весь запрос: он обрывает и ожидание ответа, и дочитывание тела
  const signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(buildUrl(query), { signal });
  } catch (error) {
    throw isTimeout(error) ? timeoutError() : new ApiError('Не удалось связаться с сервисом, проверьте соединение');
  }
  // Сервис отдаёт ошибки и с HTTP-статусом (403 «Empty key!»), и с 200: сначала читаем тело, потом смотрим статус
  let data = null;
  try {
    data = await response.json();
  } catch (error) {
    if (isTimeout(error)) throw timeoutError();
    // тело не JSON: решим ниже по статусу
  }
  if (data?.error) {
    const text = [].concat(data.error).map(describeServiceError).join(', ');
    throw new ApiError(`Сервис вернул ошибку: ${text}`, { status: response.status });
  }
  if (!response.ok) {
    throw new ApiError(`Сервис ответил ошибкой ${response.status}`, { status: response.status });
  }
  if (!data) {
    throw new ApiError('Сервис вернул некорректный ответ');
  }
  return (data.goods ?? []).filter((good) => !isEmptyGood(good));
}
