import { http, HttpResponse } from 'msw';
import { server } from '../../test/server.js';
import { makeStore } from '../../store.js';
import { brandSelected, fetchBrands } from './searchSlice.js';

const API_URL = 'http://api.example.com/hs/hsprice/';
const febi = { goodsID: 'g1', brand: 'FEBI', number: '01089', name: 'Деталь', count: 12, warehouses: [] };

beforeEach(() => {
  vi.stubEnv('VITE_API_URL', API_URL);
  vi.stubEnv('VITE_API_KEY', 'test-key');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// clone(): тело Response читается один раз, а запросов в тесте может быть несколько
const respondWith = (response) => server.use(http.get(API_URL, () => response.clone()));

test('начальное состояние: idle, без данных и ошибки', () => {
  expect(makeStore().getState().search).toEqual({
    status: 'idle',
    number: '',
    goods: [],
    error: null,
    selectedBrand: null,
  });
});

test('успех: сначала loading, потом succeeded с позициями', async () => {
  respondWith(HttpResponse.json({ goods: [febi] }));
  const store = makeStore();

  const promise = store.dispatch(fetchBrands('01089'));
  expect(store.getState().search.status).toBe('loading');

  await promise;
  expect(store.getState().search).toEqual({
    status: 'succeeded',
    number: '01089',
    goods: [febi],
    error: null,
    selectedBrand: null,
  });
});

test('ничего не найдено: это succeeded с пустым списком, не ошибка', async () => {
  respondWith(HttpResponse.json({ goods: [] }));
  const store = makeStore();

  await store.dispatch(fetchBrands('ZZZ'));

  expect(store.getState().search).toEqual({
    status: 'succeeded',
    number: 'ZZZ',
    goods: [],
    error: null,
    selectedBrand: null,
  });
});

test('ошибка сервиса: failed с текстом ошибки', async () => {
  respondWith(HttpResponse.json({ error: 'Empty key!' }, { status: 403 }));
  const store = makeStore();

  await store.dispatch(fetchBrands('01089'));

  const { status, goods, error } = store.getState().search;
  expect(status).toBe('failed');
  expect(goods).toEqual([]);
  expect(error).toContain('Empty key!');
});

test('введённый номер сохраняется сразу и остаётся после ошибки', async () => {
  respondWith(HttpResponse.json({ error: 'Empty key!' }, { status: 403 }));
  const store = makeStore();

  const promise = store.dispatch(fetchBrands('01089'));
  expect(store.getState().search.number).toBe('01089');

  await promise;
  expect(store.getState().search.status).toBe('failed');
  expect(store.getState().search.number).toBe('01089');
});

test('brandSelected запоминает выбранного производителя', () => {
  const store = makeStore();

  store.dispatch(brandSelected('FEBI'));

  expect(store.getState().search.selectedBrand).toBe('FEBI');
});

test('новый поиск сбрасывает выбранного производителя', async () => {
  respondWith(HttpResponse.json({ goods: [febi] }));
  const store = makeStore();
  await store.dispatch(fetchBrands('01089'));
  store.dispatch(brandSelected('FEBI'));

  const promise = store.dispatch(fetchBrands('01089'));
  expect(store.getState().search.selectedBrand).toBeNull();
  await promise;
});

test('новый поиск перезаписывает номер', async () => {
  respondWith(HttpResponse.json({ goods: [] }));
  const store = makeStore();

  await store.dispatch(fetchBrands('01089'));
  await store.dispatch(fetchBrands('H01089-00'));

  expect(store.getState().search.number).toBe('H01089-00');
});

test('новый поиск после ошибки сбрасывает ошибку', async () => {
  const store = makeStore();
  respondWith(HttpResponse.json({ error: 'Empty key!' }, { status: 403 }));
  await store.dispatch(fetchBrands('01089'));
  expect(store.getState().search.error).not.toBeNull();

  respondWith(HttpResponse.json({ goods: [febi] }));
  const promise = store.dispatch(fetchBrands('01089'));
  expect(store.getState().search.error).toBeNull();
  await promise;
  expect(store.getState().search.status).toBe('succeeded');
});
