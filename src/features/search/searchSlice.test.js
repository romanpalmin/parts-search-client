import { http, HttpResponse } from 'msw';
import { server } from '../../test/server.js';
import { makeStore } from '../../store.js';
import { fetchBrands } from './searchSlice.js';

const API_URL = 'http://api.example.com/hs/hsprice/';
const febi = { goodsID: 'g1', brand: 'FEBI', number: '01089', name: 'Деталь', count: 12, warehouses: [] };

beforeEach(() => {
  vi.stubEnv('VITE_API_URL', API_URL);
  vi.stubEnv('VITE_API_KEY', 'test-key');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const respondWith = (response) => server.use(http.get(API_URL, () => response));

test('начальное состояние: idle, без данных и ошибки', () => {
  expect(makeStore().getState().search).toEqual({ status: 'idle', goods: [], error: null });
});

test('успех: сначала loading, потом succeeded с позициями', async () => {
  respondWith(HttpResponse.json({ goods: [febi] }));
  const store = makeStore();

  const promise = store.dispatch(fetchBrands('01089'));
  expect(store.getState().search.status).toBe('loading');

  await promise;
  expect(store.getState().search).toEqual({ status: 'succeeded', goods: [febi], error: null });
});

test('ничего не найдено: это succeeded с пустым списком, не ошибка', async () => {
  respondWith(HttpResponse.json({ goods: [] }));
  const store = makeStore();

  await store.dispatch(fetchBrands('ZZZ'));

  expect(store.getState().search).toEqual({ status: 'succeeded', goods: [], error: null });
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
