// Правила показа позиции. Верхний `price` позиции не используем: цену берём со складов.

// Склады, где реально можно купить: есть остаток и цена
const buyableWarehouses = (good) =>
  (good.warehouses ?? []).filter((warehouse) => warehouse.stock > 0 && warehouse.price > 0);

// Минимальная цена среди таких складов; null, если купить негде («—» в таблице)
export function getPrice(good) {
  const prices = buyableWarehouses(good).map((warehouse) => warehouse.price);
  return prices.length > 0 ? Math.min(...prices) : null;
}

// Остаток на всех складах (поле count); нет значения — 0 («нет в наличии»)
export const getStock = (good) => good.count ?? 0;

// Цены по возрастанию, «неизвестно» (null) в конец
const comparePrice = (a, b) => {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a - b;
};

// Дата отгрузки из строки ISO («2026-11-06T00:30:00+03:00» → «06.11.2026»). Date не используем:
// разбор через него сдвигает день при другом часовом поясе.
const formatShipmentDate = (iso) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  return match ? `${match[3]}.${match[2]}.${match[1]}` : null;
};

// Склады, где есть остаток: по возрастанию цены (без цены в конец), при равной цене по коду и id
export function getWarehouses(good) {
  return (good.warehouses ?? [])
    .filter((warehouse) => warehouse.stock > 0)
    .map((warehouse) => ({
      id: warehouse.id,
      code: warehouse.code,
      price: warehouse.price > 0 ? warehouse.price : null,
      stock: warehouse.stock,
      shipmentDate: formatShipmentDate(warehouse.shipmentDate),
    }))
    .sort(
      (a, b) =>
        comparePrice(a.price, b.price) ||
        String(a.code).localeCompare(String(b.code), 'ru') ||
        String(a.id).localeCompare(String(b.id), 'ru'),
    );
}

// Главная позиция и её аналоги одним плоским списком (на этапе 2 аналоги лежат внутри позиции)
export const flattenGoods = (goods) => goods.flatMap((good) => [good, ...(good.analogues ?? [])]);

// Строка таблицы: только то, что показываем
export const toRow = (good) => ({
  id: good.goodsID,
  brand: good.brand,
  number: good.number,
  name: good.name,
  price: getPrice(good),
  stock: getStock(good),
  warehouses: getWarehouses(good),
});

// Порядок: сначала в наличии, по возрастанию цены (без цены в конец группы), потом «нет в наличии».
// Последний ключ нужен, чтобы порядок не зависел от порядка в ответе (он у сервиса нестабилен).
export function compareRows(a, b) {
  const aInStock = a.stock > 0;
  const bInStock = b.stock > 0;
  if (aInStock !== bInStock) {
    return aInStock ? -1 : 1;
  }
  const byPrice = comparePrice(a.price, b.price);
  if (byPrice !== 0) {
    return byPrice;
  }
  return `${a.brand} ${a.number}`.localeCompare(`${b.brand} ${b.number}`, 'ru');
}
