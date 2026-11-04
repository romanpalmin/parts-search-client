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
});

// Порядок: сначала в наличии, по возрастанию цены (без цены в конец группы), потом «нет в наличии».
// Последний ключ нужен, чтобы порядок не зависел от порядка в ответе (он у сервиса нестабилен).
export function compareRows(a, b) {
  const aInStock = a.stock > 0;
  const bInStock = b.stock > 0;
  if (aInStock !== bInStock) {
    return aInStock ? -1 : 1;
  }
  if (a.price !== b.price) {
    if (a.price === null) return 1;
    if (b.price === null) return -1;
    return a.price - b.price;
  }
  return `${a.brand} ${a.number}`.localeCompare(`${b.brand} ${b.number}`, 'ru');
}
