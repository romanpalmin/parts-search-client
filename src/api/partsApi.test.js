import { http, HttpResponse } from 'msw';
import { server } from '../test/server.js';
import { buildUrl, fetchGoods } from './partsApi.js';

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
  test('отправляет запрос с нужными параметрами и возвращает JSON ответа', async () => {
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

    await expect(fetchGoods({ number: '01089' })).resolves.toEqual({ goods });
  });
});
