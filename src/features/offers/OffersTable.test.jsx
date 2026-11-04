import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Provider } from 'react-redux';
import { server } from '../../test/server.js';
import { makeStore } from '../../store.js';
import BrandList from '../search/BrandList.jsx';
import SearchForm from '../search/SearchForm.jsx';
import OffersTable from './OffersTable.jsx';

const API_URL = 'http://api.example.com/hs/hsprice/';

const good = (fields) => ({
  goodsID: 'g',
  brand: 'GLASER',
  number: 'H01089-00',
  name: 'Деталь',
  count: 0,
  warehouses: [],
  ...fields,
});

// Этап 1: позиции разных брендов (у GLASER номер отличается от введённого)
const stage1 = [good({ goodsID: 's1', brand: 'GLASER' }), good({ goodsID: 's2', brand: 'FEBI', number: '01089' })];

// Этап 2: главная позиция и её аналоги (в ответе порядок произвольный)
const stage2 = [
  good({
    goodsID: 'main',
    name: 'Главная деталь',
    count: 29,
    warehouses: [
      { id: 'w1', price: 1257.6, stock: 10 },
      { id: 'w2', price: 1190.23, stock: 19 },
    ],
    analogues: [
      good({ goodsID: 'none', brand: 'PAYEN', number: 'BC920', name: 'Аналог без остатка', price: 500 }),
      good({
        goodsID: 'cheap',
        brand: 'PAYEN',
        number: 'BC921',
        name: 'Аналог дешёвый',
        count: 2,
        warehouses: [{ id: 'w3', price: 800, stock: 2 }],
      }),
    ],
  }),
];

beforeEach(() => {
  vi.stubEnv('VITE_API_URL', API_URL);
  vi.stubEnv('VITE_API_KEY', 'test-key');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// Отвечает по этапам: без brand в запросе — этап 1, с brand — этап 2 (параметры этапа 2 складывает в stage2Requests)
const serve = ({ second = () => HttpResponse.json({ goods: stage2 }) } = {}) => {
  const stage2Requests = [];
  server.use(
    http.get(API_URL, ({ request }) => {
      const params = new URL(request.url).searchParams;
      if (!params.get('brand')) {
        return HttpResponse.json({ goods: stage1 });
      }
      stage2Requests.push(Object.fromEntries(params));
      return second();
    }),
  );
  return stage2Requests;
};

const setup = async () => {
  const user = userEvent.setup();
  render(
    <Provider store={makeStore()}>
      <SearchForm />
      <BrandList />
      <OffersTable />
    </Provider>,
  );
  const search = async (number) => {
    await user.clear(screen.getByRole('textbox', { name: 'Артикул' }));
    await user.type(screen.getByRole('textbox', { name: 'Артикул' }), number);
    await user.click(screen.getByRole('button', { name: 'Найти' }));
  };
  const choose = async (brand) => user.click(await screen.findByRole('button', { name: brand }));
  return { search, choose };
};

test('до выбора производителя таблицы нет', async () => {
  serve();
  const { search } = await setup();

  expect(screen.queryByRole('table')).not.toBeInTheDocument();
  await search('01089');
  await screen.findByRole('button', { name: 'GLASER' });

  expect(screen.queryByRole('table')).not.toBeInTheDocument();
  expect(screen.queryByText(/ничего не найдено/)).not.toBeInTheDocument();
});

test('клик по бренду: запрос с введённым номером (не номером позиции), брендом и analogues=on', async () => {
  const requests = serve();
  const { search, choose } = await setup();
  await search('01089');

  await choose('GLASER');

  await screen.findByRole('table');
  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({ number: '01089', brand: 'GLASER', analogues: 'on' });
});

test('таблица: аналоги и позиция, в наличии по цене, «нет в наличии» в конце, цена «—»', async () => {
  serve();
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  const { search, choose } = await setup();
  await search('01089');
  await choose('GLASER');

  const table = await screen.findByRole('table');
  const [, ...rows] = within(table).getAllByRole('row');

  expect(rows).toHaveLength(3);
  expect(rows[0]).toHaveTextContent('Аналог дешёвый');
  expect(rows[0]).toHaveTextContent('PAYEN, BC921');
  expect(rows[0]).toHaveTextContent('800,00');
  expect(rows[0]).toHaveTextContent('2');
  expect(rows[1]).toHaveTextContent('Главная деталь');
  expect(rows[1]).toHaveTextContent(/1\s190,23/);
  expect(rows[1]).toHaveTextContent('29');
  expect(rows[2]).toHaveTextContent('Аналог без остатка');
  expect(rows[2]).toHaveTextContent('—');
  expect(rows[2]).toHaveTextContent('нет в наличии');
  expect(rows[2]).not.toHaveTextContent('500');
  expect(rows[2]).toHaveClass('text-muted'); // «нет в наличии» приглушено
  expect(rows[0]).not.toHaveClass('text-muted');
  expect(consoleError).not.toHaveBeenCalled(); // уникальные key у строк
  consoleError.mockRestore();
});

test('пока идёт запрос этапа 2: лоадер, потом таблица', async () => {
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  serve({
    second: async () => {
      await gate;
      return HttpResponse.json({ goods: stage2 });
    },
  });
  const { search, choose } = await setup();
  await search('01089');

  await choose('GLASER');

  expect(await screen.findByRole('status')).toHaveTextContent('Загрузка');
  expect(screen.queryByRole('table')).not.toBeInTheDocument();

  release();
  await screen.findByRole('table');
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

test('ошибка этапа 2: показан текст ошибки, таблицы нет', async () => {
  serve({ second: () => HttpResponse.json({ error: 'Request quota exceeded!' }, { status: 403 }) });
  const { search, choose } = await setup();
  await search('01089');

  await choose('GLASER');

  expect(await screen.findByRole('alert')).toHaveTextContent('Request quota exceeded!');
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});

test('у производителя ничего не нашлось: сообщение с названием бренда', async () => {
  serve({ second: () => HttpResponse.json({ goods: [] }) });
  const { search, choose } = await setup();
  await search('01089');

  await choose('FEBI');

  expect(await screen.findByText('По производителю «FEBI» ничего не найдено')).toBeInTheDocument();
});

test('новый поиск убирает таблицу прежнего производителя', async () => {
  serve();
  const { search, choose } = await setup();
  await search('01089');
  await choose('GLASER');
  await screen.findByRole('table');

  await search('999');

  await waitFor(() => expect(screen.queryByRole('table')).not.toBeInTheDocument());
});
