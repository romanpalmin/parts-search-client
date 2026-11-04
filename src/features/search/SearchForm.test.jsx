import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Provider } from 'react-redux';
import { server } from '../../test/server.js';
import { makeStore } from '../../store.js';
import SearchForm from './SearchForm.jsx';

const API_URL = 'http://api.example.com/hs/hsprice/';

beforeEach(() => {
  vi.stubEnv('VITE_API_URL', API_URL);
  vi.stubEnv('VITE_API_KEY', 'test-key');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const setup = () => {
  const store = makeStore();
  render(
    <Provider store={store}>
      <SearchForm />
    </Provider>,
  );
  return { store, user: userEvent.setup() };
};

const field = () => screen.getByRole('textbox', { name: 'Артикул' });
const button = () => screen.getByRole('button', { name: 'Найти' });

test('кнопка неактивна, пока поле пустое или в нём одни пробелы', async () => {
  const { user } = setup();
  expect(button()).toBeDisabled();

  await user.type(field(), '   ');
  expect(button()).toBeDisabled();

  await user.type(field(), '01089');
  expect(button()).toBeEnabled();
});

test('введённый текст виден в поле (controlled input)', async () => {
  const { user } = setup();

  await user.type(field(), '01089');

  expect(field()).toHaveValue('01089');
});

test('отправка запускает поиск с номером без пробелов по краям', async () => {
  let requestedNumber = null;
  server.use(
    http.get(API_URL, ({ request }) => {
      requestedNumber = new URL(request.url).searchParams.get('number');
      return HttpResponse.json({ goods: [] });
    }),
  );
  const { store, user } = setup();

  await user.type(field(), '  01089 ');
  await user.click(button());

  await waitFor(() => expect(store.getState().search.status).toBe('succeeded'));
  expect(requestedNumber).toBe('01089');
  expect(store.getState().search.number).toBe('01089');
});

test('Enter в поле тоже отправляет форму', async () => {
  server.use(http.get(API_URL, () => HttpResponse.json({ goods: [] })));
  const { store, user } = setup();

  await user.type(field(), '01089{Enter}');

  await waitFor(() => expect(store.getState().search.status).toBe('succeeded'));
});

test('отправка не перезагружает страницу (preventDefault)', () => {
  server.use(http.get(API_URL, () => HttpResponse.json({ goods: [] })));
  setup();

  // fireEvent возвращает false, если обработчик вызвал preventDefault
  const notPrevented = fireEvent.submit(field().closest('form'));

  expect(notPrevented).toBe(false);
});
