import { compareRows, flattenGoods, getPrice, getStock, getWarehouses, toRow } from './offerRules.js';

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

describe('getWarehouses', () => {
  const store = (id, code, price, stock, shipmentDate) => ({ id, code, price, stock, shipmentDate });

  test('только склады с остатком, по возрастанию цены', () => {
    const febi = good({
      warehouses: [store('a', 'МСК', 1257.6, 10), store('b', 'СПБ', 1190.23, 19), store('c', 'КЗН', 100, 0)],
    });
    expect(getWarehouses(febi).map((item) => item.id)).toEqual(['b', 'a']);
  });

  test('оставляет id, код, остаток и цену', () => {
    const febi = good({ warehouses: [store('a', 'МСК', 1190.23, 19, '2026-11-06T00:00:00+03:00')] });
    expect(getWarehouses(febi)).toEqual([
      { id: 'a', code: 'МСК', price: 1190.23, stock: 19, shipmentDate: '06.11.2026' },
    ]);
  });

  test('склад с остатком, но без цены: цена null и в конец списка', () => {
    const febi = good({ warehouses: [store('free', 'А', 0, 3), store('paid', 'Я', 500, 3)] });
    expect(getWarehouses(febi).map((item) => [item.id, item.price])).toEqual([
      ['paid', 500],
      ['free', null],
    ]);
  });

  test('дата отгрузки не сдвигается часовым поясом', () => {
    const febi = good({ warehouses: [store('a', 'МСК', 1, 1, '2026-11-06T00:30:00+03:00')] });
    expect(getWarehouses(febi)[0].shipmentDate).toBe('06.11.2026');
  });

  test('нет даты или она нечитаема: null', () => {
    const febi = good({ warehouses: [store('a', 'МСК', 1, 1, undefined), store('b', 'МСК', 2, 1, 'скоро')] });
    expect(getWarehouses(febi).map((item) => item.shipmentDate)).toEqual([null, null]);
  });

  test('нет складов: пустой список', () => {
    expect(getWarehouses(good({ warehouses: [] }))).toEqual([]);
    expect(getWarehouses(good({ warehouses: undefined }))).toEqual([]);
  });

  test('при равной цене порядок не зависит от порядка в ответе (по коду и id)', () => {
    const a = store('1', 'МСК', 100, 1);
    const b = store('2', 'МСК', 100, 1);
    const c = store('1', 'СПБ', 100, 1);
    const ids = (list) => getWarehouses(good({ warehouses: list })).map((item) => `${item.code}${item.id}`);
    expect(ids([c, b, a])).toEqual(['МСК1', 'МСК2', 'СПБ1']);
    expect(ids([a, c, b])).toEqual(['МСК1', 'МСК2', 'СПБ1']);
  });
});

describe('toRow', () => {
  test('оставляет только показываемые поля, цену и остаток считает по правилам', () => {
    const febi = good({ goodsID: 'g1', count: 8, price: 1, warehouses: [warehouse('a', 900, 8)], analogues: [] });
    expect(toRow(febi)).toEqual({
      id: 'g1',
      brand: 'FEBI',
      number: '01089',
      name: 'Деталь',
      price: 900,
      stock: 8,
      warehouses: [{ id: 'a', code: 'МСК', price: 900, stock: 8, shipmentDate: null }],
    });
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
