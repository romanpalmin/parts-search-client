import { http, HttpResponse } from 'msw';
import { server } from '../test/server.js';
import { ApiError, buildUrl, fetchGoods } from './partsApi.js';

const API_URL = 'http://api.example.com/hs/hsprice/';

beforeEach(() => {
  vi.stubEnv('VITE_API_URL', API_URL);
  vi.stubEnv('VITE_API_KEY', 'test-key');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('buildUrl', () => {
  test('только номер: ключ и номер, без brand и analogues', () => {
    const url = new URL(buildUrl({ number: '01089' }));
    expect(url.origin + url.pathname).toBe(API_URL);
    expect(Object.fromEntries(url.searchParams)).toEqual({ key: 'test-key', number: '01089' });
  });

  test('номер + бренд + аналоги', () => {
    const url = new URL(buildUrl({ number: '0189', brand: 'CAFFARO', analogues: true }));
    expect(Object.fromEntries(url.searchParams)).toEqual({
      key: 'test-key',
      number: '0189',
      brand: 'CAFFARO',
      analogues: 'on',
    });
  });

  test('бренд с & кодируется и читается обратно без потерь', () => {
    const href = buildUrl({ number: '01089', brand: 'Meat & Doria', analogues: true });
    expect(href).toContain('brand=Meat+%26+Doria');
    expect(new URL(href).searchParams.get('brand')).toBe('Meat & Doria');
  });
});

describe('fetchGoods', () => {
  test('отправляет запрос с нужными параметрами и возвращает позиции', async () => {
    const goods = [{ brand: 'FEBI', number: '01089', name: 'Деталь', count: 822 }];
    server.use(
      http.get(API_URL, ({ request }) => {
        const params = new URL(request.url).searchParams;
        if (params.get('number') !== '01089' || params.get('key') !== 'test-key' || params.has('analogues')) {
          return HttpResponse.json({ error: 'неожиданные параметры' }, { status: 400 });
        }
        return HttpResponse.json({ goods });
      }),
    );

    await expect(fetchGoods({ number: '01089' })).resolves.toEqual(goods);
  });

  describe('разбор ответа', () => {
    const respondWith = (response) => server.use(http.get(API_URL, () => response));

    test('реальный ответ «ничего не найдено» (нулевой goodsID, пустые поля) — пустой массив', async () => {
      respondWith(
        HttpResponse.json({
          goods: [
            {
              brand: '',
              count: 0,
              goodsID: '00000000-0000-0000-0000-000000000000',
              name: '',
              number: '',
              price: 0,
              rate: 0,
              warehouses: [],
            },
          ],
        }),
      );
      await expect(fetchGoods({ number: 'ZZZ000000XX' })).resolves.toEqual([]);
    });

    test('goods пустой или отсутствует — пустой массив', async () => {
      respondWith(HttpResponse.json({}));
      await expect(fetchGoods({ number: '000' })).resolves.toEqual([]);
    });

    test('поле error — ApiError с текстом сервиса', async () => {
      respondWith(HttpResponse.json({ error: 'Empty key!' }));
      const promise = fetchGoods({ number: '01089' });
      await expect(promise).rejects.toBeInstanceOf(ApiError);
      await expect(promise).rejects.toThrow('Empty key!');
    });

    test('реальный случай: HTTP 403 с error в теле — текст сервиса не теряется', async () => {
      respondWith(HttpResponse.json({ error: 'Empty key!' }, { status: 403 }));
      await expect(fetchGoods({ number: '11111' })).rejects.toMatchObject({
        name: 'ApiError',
        status: 403,
        message: expect.stringContaining('Empty key!'),
      });
    });

    test('несколько ошибок в поле error — все в сообщении', async () => {
      respondWith(HttpResponse.json({ error: ['Empty key!', 'Empty number goods!'] }));
      await expect(fetchGoods({ number: '' })).rejects.toThrow('Empty key!, Empty number goods!');
    });

    test('HTTP 500 — ApiError со статусом', async () => {
      respondWith(HttpResponse.json({}, { status: 500 }));
      await expect(fetchGoods({ number: '01089' })).rejects.toMatchObject({ name: 'ApiError', status: 500 });
    });

    test('сбой сети — ApiError', async () => {
      respondWith(HttpResponse.error());
      await expect(fetchGoods({ number: '01089' })).rejects.toThrow('Не удалось связаться с сервисом');
    });

    test('не JSON в ответе — ApiError', async () => {
      respondWith(new HttpResponse('<html>oops</html>', { status: 200 }));
      await expect(fetchGoods({ number: '01089' })).rejects.toThrow('некорректный ответ');
    });
  });
});
