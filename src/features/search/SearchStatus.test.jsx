import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Provider } from 'react-redux';
import { server } from '../../test/server.js';
import { makeStore } from '../../store.js';
import SearchForm from './SearchForm.jsx';
import SearchStatus from './SearchStatus.jsx';

const API_URL = 'http://api.example.com/hs/hsprice/';
const febi = { goodsID: 'g1', brand: 'FEBI', number: '01089', name: 'Деталь', count: 12, warehouses: [] };

beforeEach(() => {
  vi.stubEnv('VITE_API_URL', API_URL);
  vi.stubEnv('VITE_API_KEY', 'test-key');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// Форма + статус вместе: ищем так, как это делает пользователь
const search = async (number) => {
  const user = userEvent.setup();
  render(
    <Provider store={makeStore()}>
      <SearchForm />
      <SearchStatus />
    </Provider>,
  );
  await user.type(screen.getByRole('textbox', { name: 'Артикул' }), number);
  await user.click(screen.getByRole('button', { name: 'Найти' }));
};

test('до поиска под формой ничего нет', () => {
  render(
    <Provider store={makeStore()}>
      <SearchStatus />
    </Provider>,
  );
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  // в idle список брендов тоже пустой, но «ничего не найдено» писать рано
  expect(screen.queryByText(/ничего не найдено/)).not.toBeInTheDocument();
});

test('пока идёт запрос: лоадер и неактивная кнопка, потом лоадер исчезает', async () => {
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  server.use(
    http.get(API_URL, async () => {
      await gate;
      return HttpResponse.json({ goods: [febi] });
    }),
  );

  await search('01089');

  expect(await screen.findByRole('status')).toHaveTextContent('Загрузка');
  expect(screen.getByRole('button', { name: 'Найти' })).toBeDisabled();

  release();
  await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
  expect(screen.getByRole('button', { name: 'Найти' })).toBeEnabled();
});

test('ошибка сервиса: показан текст ошибки', async () => {
  server.use(http.get(API_URL, () => HttpResponse.json({ error: 'Empty key!' }, { status: 403 })));

  await search('01089');

  expect(await screen.findByRole('alert')).toHaveTextContent('Empty key!');
});

test('сбой сети: показано сообщение, а не пустой экран', async () => {
  server.use(http.get(API_URL, () => HttpResponse.error()));

  await search('01089');

  expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось связаться с сервисом');
});

test('ничего не найдено: сообщение с введённым номером', async () => {
  server.use(http.get(API_URL, () => HttpResponse.json({ goods: [] })));

  await search('ZZZ');

  expect(await screen.findByText('По номеру «ZZZ» ничего не найдено')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('нашлось: ни лоадера, ни ошибки, ни «ничего не найдено»', async () => {
  server.use(http.get(API_URL, () => HttpResponse.json({ goods: [febi] })));

  await search('01089');

  await waitFor(() => expect(screen.getByRole('button', { name: 'Найти' })).toBeEnabled());
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.queryByText(/ничего не найдено/)).not.toBeInTheDocument();
});
