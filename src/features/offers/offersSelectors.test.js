import { selectOfferRows } from './offersSlice.js';

const stateWith = (goods) => ({ offers: { status: 'succeeded', brand: 'GLASER', goods, error: null } });
const good = (fields) => ({
  goodsID: 'g',
  brand: 'GLASER',
  number: 'H01089-00',
  name: 'Деталь',
  count: 0,
  warehouses: [],
  ...fields,
});

const main = good({
  goodsID: 'main',
  count: 29,
  warehouses: [
    { id: 'w1', price: 1257.6, stock: 10 },
    { id: 'w2', price: 1190.23, stock: 19 },
  ],
  analogues: [
    good({ goodsID: 'cheap', brand: 'PAYEN', count: 2, warehouses: [{ id: 'w3', price: 800, stock: 2 }] }),
    good({ goodsID: 'none', brand: 'PAYEN', count: 0, price: 500, warehouses: [] }),
  ],
});

describe('selectOfferRows', () => {
  test('позиция и аналоги в одной таблице: в наличии по цене, «нет в наличии» в конце', () => {
    const rows = selectOfferRows(stateWith([main]));

    expect(rows.map((row) => row.id)).toEqual(['cheap', 'main', 'none']);
    expect(rows.map((row) => row.price)).toEqual([800, 1190.23, null]);
    expect(rows.map((row) => row.stock)).toEqual([2, 29, 0]);
  });

  test('нет позиций — нет строк', () => {
    expect(selectOfferRows(stateWith([]))).toEqual([]);
  });

  test('при тех же данных возвращает тот же массив (кэш createSelector)', () => {
    const state = stateWith([main]);
    expect(selectOfferRows(state)).toBe(selectOfferRows(state));
  });

  test('при смене goods пересчитывает', () => {
    const first = selectOfferRows(stateWith([main]));
    const second = selectOfferRows(
      stateWith([good({ goodsID: 'solo', count: 1, warehouses: [{ id: 'w', price: 10, stock: 1 }] })]),
    );
    expect(second).not.toBe(first);
    expect(second.map((row) => row.id)).toEqual(['solo']);
  });
});
