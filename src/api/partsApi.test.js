import { delay, http, HttpResponse } from 'msw';
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

  describe('таймаут', () => {
    // Настоящий таймер Node не подменяется fake timers, поэтому в тестах подставляем короткий сигнал.
    // Сам вызов с 15000 проверяем отдельно через шпиона.
    const realTimeout = AbortSignal.timeout.bind(AbortSignal);
    const useShortTimeout = () => vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => realTimeout(50));

    afterEach(() => {
      vi.restoreAllMocks();
    });

    test('запрос ограничен 15 секундами', async () => {
      const timeout = vi.spyOn(AbortSignal, 'timeout');
      server.use(http.get(API_URL, () => HttpResponse.json({ goods: [] })));

      await fetchGoods({ number: '01089' });

      expect(timeout).toHaveBeenCalledWith(15000);
    });

    test('сервис молчит: ApiError «не отвечает», а не вечный лоадер', async () => {
      useShortTimeout();
      server.use(http.get(API_URL, () => delay('infinite')));

      const promise = fetchGoods({ number: '01089' });

      await expect(promise).rejects.toBeInstanceOf(ApiError);
      await expect(promise).rejects.toThrow('Сервис не отвечает');
    });

    test('заголовки пришли, а тело не дочиталось до таймаута: «не отвечает», не «некорректный ответ»', async () => {
      // Настоящий оборванный поток тела роняет внутренности Node (undici) после теста, поэтому
      // имитируем то, что делает fetch при срабатывании сигнала: чтение тела отклоняется с TimeoutError
      server.use(http.get(API_URL, () => HttpResponse.json({ goods: [] })));
      vi.spyOn(Response.prototype, 'json').mockRejectedValue(new DOMException('сигнал сработал', 'TimeoutError'));

      await expect(fetchGoods({ number: '01089' })).rejects.toThrow('Сервис не отвечает');
    });

    test('сбой сети по-прежнему «не удалось связаться» (таймаут не подменяет его)', async () => {
      server.use(http.get(API_URL, () => HttpResponse.error()));
      await expect(fetchGoods({ number: '01089' })).rejects.toThrow('Не удалось связаться с сервисом');
    });
  });

  describe('пограничные случаи из реальных ответов', () => {
    const warehouse = {
      code: 'MSK',
      id: '1',
      own: true,
      price: 540.5,
      stock: 12,
      shipmentDate: '2026-11-05T00:00:00+03:00',
    };
    const febi = {
      goodsID: 'g1',
      brand: 'FEBI',
      number: '01089',
      name: 'Деталь',
      count: 12,
      price: 0,
      rate: 1,
      warehouses: [warehouse],
    };
    const glaser = {
      goodsID: 'g2',
      brand: 'GLASER',
      number: 'H01089-00',
      name: 'Деталь',
      count: 3,
      price: 0,
      rate: 1,
      warehouses: [warehouse],
    };
    const outOfStock = {
      goodsID: 'g3',
      brand: 'AP',
      number: '01089',
      name: 'Деталь',
      count: 0,
      price: 0,
      rate: 1,
      warehouses: [],
    };

    test('позиции без остатка и с другим number не отбрасываются и не меняются', async () => {
      server.use(http.get(API_URL, () => HttpResponse.json({ goods: [febi, glaser, outOfStock] })));

      const goods = await fetchGoods({ number: '01089' });

      expect(goods).toEqual([febi, glaser, outOfStock]);
      expect(goods[1].number).toBe('H01089-00');
      expect(goods[2]).toMatchObject({ count: 0, warehouses: [] });
    });

    test('бренд с & доходит до сервера целым', async () => {
      let receivedBrand;
      server.use(
        http.get(API_URL, ({ request }) => {
          receivedBrand = new URL(request.url).searchParams.get('brand');
          return HttpResponse.json({ goods: [febi] });
        }),
      );

      await fetchGoods({ number: '01089', brand: 'Meat & Doria', analogues: true });

      expect(receivedBrand).toBe('Meat & Doria');
    });
  });
});
