import { http, HttpResponse } from 'msw';
import { server } from '../../test/server.js';
import { makeStore } from '../../store.js';
import { fetchBrands } from '../search/searchSlice.js';
import {
  fetchOffers,
  selectOffersBrand,
  selectOffersError,
  selectOffersGoods,
  selectOffersStatus,
} from './offersSlice.js';

const API_URL = 'http://api.example.com/hs/hsprice/';
const febi = { goodsID: 'g1', brand: 'FEBI', number: '01089', name: 'Деталь', count: 12, warehouses: [] };
const analog = { goodsID: 'g2', brand: 'MANN', number: 'X1', name: 'Аналог', count: 0, warehouses: [] };

beforeEach(() => {
  vi.stubEnv('VITE_API_URL', API_URL);
  vi.stubEnv('VITE_API_KEY', 'test-key');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// clone(): тело Response читается один раз, а запросов в тесте может быть несколько
const respondWith = (response) => server.use(http.get(API_URL, () => response.clone()));

test('начальное состояние: idle, без бренда, данных и ошибки', () => {
  expect(makeStore().getState().offers).toEqual({
    status: 'idle',
    brand: null,
    requestId: null,
    goods: [],
    error: null,
  });
});

test('успех: сначала loading с брендом, потом succeeded с позициями', async () => {
  respondWith(HttpResponse.json({ goods: [febi, analog] }));
  const store = makeStore();

  const promise = store.dispatch(fetchOffers({ number: '01089', brand: 'FEBI' }));
  expect(selectOffersStatus(store.getState())).toBe('loading');
  expect(selectOffersBrand(store.getState())).toBe('FEBI');

  await promise;
  expect(selectOffersStatus(store.getState())).toBe('succeeded');
  expect(selectOffersGoods(store.getState())).toEqual([febi, analog]);
  expect(selectOffersError(store.getState())).toBeNull();
});

test('запрос уходит с номером, брендом и analogues=on', async () => {
  let params;
  server.use(
    http.get(API_URL, ({ request }) => {
      params = new URL(request.url).searchParams;
      return HttpResponse.json({ goods: [] });
    }),
  );
  const store = makeStore();

  await store.dispatch(fetchOffers({ number: '01089', brand: 'Meat & Doria' }));

  expect(params.get('number')).toBe('01089');
  expect(params.get('brand')).toBe('Meat & Doria');
  expect(params.get('analogues')).toBe('on');
});

test('ничего не найдено: succeeded с пустым списком, не ошибка', async () => {
  respondWith(HttpResponse.json({ goods: [] }));
  const store = makeStore();

  await store.dispatch(fetchOffers({ number: '01089', brand: 'FEBI' }));

  expect(selectOffersStatus(store.getState())).toBe('succeeded');
  expect(selectOffersGoods(store.getState())).toEqual([]);
});

test('ошибка сервиса: failed с текстом ошибки и без данных', async () => {
  respondWith(HttpResponse.json({ error: 'Empty key!' }, { status: 403 }));
  const store = makeStore();

  await store.dispatch(fetchOffers({ number: '01089', brand: 'FEBI' }));

  expect(selectOffersStatus(store.getState())).toBe('failed');
  expect(selectOffersGoods(store.getState())).toEqual([]);
  expect(selectOffersError(store.getState())).toContain('Empty key!');
});

test('повторный запрос сбрасывает прежние данные и ошибку', async () => {
  const store = makeStore();
  respondWith(HttpResponse.json({ goods: [febi] }));
  await store.dispatch(fetchOffers({ number: '01089', brand: 'FEBI' }));

  respondWith(HttpResponse.json({ error: 'Сбой' }, { status: 500 }));
  const promise = store.dispatch(fetchOffers({ number: '01089', brand: 'MANN' }));

  expect(selectOffersGoods(store.getState())).toEqual([]);
  expect(selectOffersBrand(store.getState())).toBe('MANN');
  await promise;
  expect(selectOffersStatus(store.getState())).toBe('failed');

  respondWith(HttpResponse.json({ goods: [analog] }));
  const next = store.dispatch(fetchOffers({ number: '01089', brand: 'MANN' }));
  expect(selectOffersError(store.getState())).toBeNull();
  await next;
});

// Гонка запросов: ответ прежнего запроса приходит позже и не должен затирать актуальное состояние
describe('устаревшие ответы', () => {
  const glaser = { goodsID: 'g9', brand: 'GLASER', number: 'H01089-00', name: 'Глазер', count: 1, warehouses: [] };

  // Ответ для GLASER ждёт, пока тест его не отпустит; остальные бренды отвечают сразу
  const slowGlaser = (glaserResponse) => {
    let release;
    const gate = new Promise((resolve) => (release = resolve));
    server.use(
      http.get(API_URL, async ({ request }) => {
        const brand = new URL(request.url).searchParams.get('brand');
        if (brand === 'GLASER') {
          await gate;
          return glaserResponse();
        }
        return HttpResponse.json({ goods: [febi] });
      }),
    );
    return release;
  };

  test('поздний успех прежнего бренда не затирает таблицу нового', async () => {
    const release = slowGlaser(() => HttpResponse.json({ goods: [glaser] }));
    const store = makeStore();

    const first = store.dispatch(fetchOffers({ number: '01089', brand: 'GLASER' }));
    await store.dispatch(fetchOffers({ number: '01089', brand: 'FEBI' }));
    release();
    await first;

    expect(selectOffersBrand(store.getState())).toBe('FEBI');
    expect(selectOffersGoods(store.getState())).toEqual([febi]);
  });

  test('поздняя ошибка прежнего бренда не ломает таблицу нового', async () => {
    const release = slowGlaser(() => HttpResponse.json({ error: 'Сбой' }, { status: 500 }));
    const store = makeStore();

    const first = store.dispatch(fetchOffers({ number: '01089', brand: 'GLASER' }));
    await store.dispatch(fetchOffers({ number: '01089', brand: 'FEBI' }));
    release();
    await first;

    expect(selectOffersStatus(store.getState())).toBe('succeeded');
    expect(selectOffersError(store.getState())).toBeNull();
  });

  test('ответ, пришедший после нового поиска брендов, не возвращает старую таблицу', async () => {
    const release = slowGlaser(() => HttpResponse.json({ goods: [glaser] }));
    const store = makeStore();

    const offers = store.dispatch(fetchOffers({ number: '01089', brand: 'GLASER' }));
    await store.dispatch(fetchBrands('999'));
    release();
    await offers;

    expect(store.getState().offers).toMatchObject({ status: 'idle', brand: null, goods: [], error: null });
  });
});

test('новый поиск брендов сбрасывает таблицу этапа 2', async () => {
  const store = makeStore();
  respondWith(HttpResponse.json({ goods: [febi] }));
  await store.dispatch(fetchOffers({ number: '01089', brand: 'FEBI' }));
  expect(selectOffersGoods(store.getState())).toHaveLength(1);

  const promise = store.dispatch(fetchBrands('999'));

  expect(store.getState().offers).toEqual({
    status: 'idle',
    brand: null,
    requestId: null,
    goods: [],
    error: null,
  });
  await promise;
});
