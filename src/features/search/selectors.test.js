import { selectBrands, selectError, selectStatus } from './searchSlice.js';

const stateWith = (search) => ({ search: { status: 'idle', goods: [], error: null, ...search } });

const febi1 = { brand: 'FEBI', number: '01089', name: 'Деталь 1' };
const febi2 = { brand: 'FEBI', number: '01089', name: 'Деталь 2' };
const glaser = { brand: 'GLASER', number: 'H01089-00', name: 'Деталь' };
const meat = { brand: 'Meat & Doria', number: '01089', name: 'Деталь' };

describe('selectStatus и selectError', () => {
  test('читают status и error из state.search', () => {
    const state = stateWith({ status: 'failed', error: 'Ошибка' });
    expect(selectStatus(state)).toBe('failed');
    expect(selectError(state)).toBe('Ошибка');
  });
});

describe('selectBrands', () => {
  test('пустой список позиций — пустой список брендов', () => {
    expect(selectBrands(stateWith({ goods: [] }))).toEqual([]);
  });

  test('бренды без повторов, в порядке ответа (не отсортированные)', () => {
    const brands = selectBrands(stateWith({ goods: [glaser, febi1, meat, febi2] }));
    expect(brands).toEqual(['GLASER', 'FEBI', 'Meat & Doria']);
  });

  test('при тех же данных возвращает тот же массив (кэш createSelector)', () => {
    const state = stateWith({ goods: [febi1, glaser] });
    expect(selectBrands(state)).toBe(selectBrands(state));
  });

  test('при смене goods пересчитывает', () => {
    const first = selectBrands(stateWith({ goods: [febi1] }));
    const second = selectBrands(stateWith({ goods: [febi1, glaser] }));
    expect(second).not.toBe(first);
    expect(second).toEqual(['FEBI', 'GLASER']);
  });
});
