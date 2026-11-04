import { compareRows, flattenGoods, getPrice, getStock, toRow } from './offerRules.js';

const warehouse = (id, price, stock) => ({ id, code: 'МСК', price, stock });
const good = (fields) => ({
  goodsID: 'g',
  brand: 'FEBI',
  number: '01089',
  name: 'Деталь',
  count: 0,
  warehouses: [],
  ...fields,
});

describe('getPrice', () => {
  test('минимальная цена среди складов с остатком', () => {
    const febi = good({ warehouses: [warehouse('a', 1257.6, 5), warehouse('b', 1190.23, 3), warehouse('c', 1200, 1)] });
    expect(getPrice(febi)).toBe(1190.23);
  });

  test('склад без остатка не учитывается, даже если он дешевле', () => {
    const febi = good({ warehouses: [warehouse('a', 100, 0), warehouse('b', 500, 2)] });
    expect(getPrice(febi)).toBe(500);
  });

  test('склад с ценой 0 не учитывается', () => {
    const febi = good({ warehouses: [warehouse('a', 0, 4), warehouse('b', 700, 4)] });
    expect(getPrice(febi)).toBe(700);
  });

  test('без складов цены нет (null), а не 0', () => {
    expect(getPrice(good({ warehouses: [] }))).toBeNull();
    expect(getPrice(good({ warehouses: undefined }))).toBeNull();
  });

  test('если остатка нет ни на одном складе, цены нет', () => {
    expect(getPrice(good({ warehouses: [warehouse('a', 100, 0)] }))).toBeNull();
  });

  test('верхний price позиции игнорируется (PAYEN 1995: price > 0 при count 0 и без складов)', () => {
    expect(getPrice(good({ price: 500, count: 0, warehouses: [] }))).toBeNull();
  });
});

describe('getStock', () => {
  test('берёт count', () => {
    expect(getStock(good({ count: 29 }))).toBe(29);
  });

  test('нет count — остаток 0', () => {
    expect(getStock({ goodsID: 'g' })).toBe(0);
  });
});

describe('flattenGoods', () => {
  test('главная позиция, затем её аналоги', () => {
    const analog1 = good({ goodsID: 'a1' });
    const analog2 = good({ goodsID: 'a2' });
    const main = good({ goodsID: 'm', analogues: [analog1, analog2] });
    expect(flattenGoods([main]).map((item) => item.goodsID)).toEqual(['m', 'a1', 'a2']);
  });

  test('позиция без аналогов остаётся одна; пустой список — пустой', () => {
    expect(flattenGoods([good({ goodsID: 'm' })])).toHaveLength(1);
    expect(flattenGoods([])).toEqual([]);
  });
});

describe('toRow', () => {
  test('оставляет только показываемые поля, цену и остаток считает по правилам', () => {
    const febi = good({ goodsID: 'g1', count: 8, price: 1, warehouses: [warehouse('a', 900, 8)], analogues: [] });
    expect(toRow(febi)).toEqual({ id: 'g1', brand: 'FEBI', number: '01089', name: 'Деталь', price: 900, stock: 8 });
  });
});

describe('compareRows (порядок строк)', () => {
  const row = (id, price, stock, brand = 'FEBI', number = '01089') => ({ id, brand, number, name: 'Д', price, stock });
  const sortedIds = (rows) => [...rows].sort(compareRows).map((item) => item.id);

  test('в наличии по возрастанию цены, затем «нет в наличии»', () => {
    const rows = [row('out', null, 0), row('dear', 900, 1), row('cheap', 100, 5)];
    expect(sortedIds(rows)).toEqual(['cheap', 'dear', 'out']);
  });

  test('в наличии, но без цены — в конец группы «в наличии»', () => {
    const rows = [row('out', null, 0), row('noPrice', null, 3), row('cheap', 100, 5)];
    expect(sortedIds(rows)).toEqual(['cheap', 'noPrice', 'out']);
  });

  test('без цены в конец группы при любом порядке на входе (компаратор симметричен)', () => {
    const noPrice = row('noPrice', null, 3);
    const cheap = row('cheap', 100, 5);
    expect(sortedIds([noPrice, cheap])).toEqual(['cheap', 'noPrice']);
    expect(sortedIds([cheap, noPrice])).toEqual(['cheap', 'noPrice']);
  });

  test('при равной цене порядок не зависит от порядка в ответе (по бренду и номеру)', () => {
    const a = row('a', 100, 1, 'AP', '1');
    const b = row('b', 100, 1, 'FEBI', '1');
    const c = row('c', 100, 1, 'FEBI', '2');
    expect(sortedIds([c, a, b])).toEqual(['a', 'b', 'c']);
    expect(sortedIds([b, c, a])).toEqual(['a', 'b', 'c']);
  });
});
