import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Provider } from 'react-redux';
import { server } from '../../test/server.js';
import { makeStore } from '../../store.js';
import BrandList from './BrandList.jsx';
import SearchForm from './SearchForm.jsx';

const API_URL = 'http://api.example.com/hs/hsprice/';
const good = (brand, number = '01089') => ({ goodsID: `${brand}-${number}`, brand, number, name: 'Деталь', count: 1 });

beforeEach(() => {
  vi.stubEnv('VITE_API_URL', API_URL);
  vi.stubEnv('VITE_API_KEY', 'test-key');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const respondWith = (goods) => server.use(http.get(API_URL, () => HttpResponse.json({ goods })));

const setup = () => {
  const store = makeStore();
  const user = userEvent.setup();
  render(
    <Provider store={store}>
      <SearchForm />
      <BrandList />
    </Provider>,
  );
  const search = async (number) => {
    await user.clear(screen.getByRole('textbox', { name: 'Артикул' }));
    await user.type(screen.getByRole('textbox', { name: 'Артикул' }), number);
    await user.click(screen.getByRole('button', { name: 'Найти' }));
  };
  return { store, user, search };
};

const brandButtons = () =>
  screen.getAllByRole('button').filter((button) => button.classList.contains('list-group-item'));

test('до поиска списка нет', () => {
  setup();
  expect(screen.queryByRole('heading', { name: 'Выберите производителя' })).not.toBeInTheDocument();
});

test('производители без повторов, в порядке ответа', async () => {
  respondWith([good('GLASER', 'H01089-00'), good('FEBI'), good('Meat & Doria'), good('FEBI')]);
  const { search } = setup();

  await search('01089');

  await screen.findByRole('heading', { name: 'Выберите производителя' });
  expect(brandButtons().map((button) => button.textContent)).toEqual(['GLASER', 'FEBI', 'Meat & Doria']);
});

test('у кнопок уникальные key: React не пишет предупреждение в консоль', async () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  respondWith([good('FEBI'), good('GLASER'), good('FEBI')]);
  const { search } = setup();

  await search('01089');
  await screen.findByRole('button', { name: 'GLASER' });

  expect(consoleError).not.toHaveBeenCalled();
  consoleError.mockRestore();
});

test('клик по производителю выбирает его: подсвечен и записан в state', async () => {
  respondWith([good('FEBI'), good('GLASER')]);
  const { store, user, search } = setup();
  await search('01089');

  await user.click(await screen.findByRole('button', { name: 'GLASER' }));

  expect(screen.getByRole('button', { name: 'GLASER' })).toHaveAttribute('aria-current', 'true');
  expect(screen.getByRole('button', { name: 'GLASER' })).toHaveClass('active');
  expect(screen.getByRole('button', { name: 'FEBI' })).toHaveAttribute('aria-current', 'false');
  expect(store.getState().search.selectedBrand).toBe('GLASER');
});

test('новый поиск убирает прежнюю выдачу и выбор', async () => {
  respondWith([good('FEBI'), good('GLASER')]);
  const { store, user, search } = setup();
  await search('01089');
  await user.click(await screen.findByRole('button', { name: 'FEBI' }));

  respondWith([good('MANN', '999')]);
  await search('999');

  await screen.findByRole('button', { name: 'MANN' });
  expect(screen.queryByRole('button', { name: 'FEBI' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'MANN' })).toHaveAttribute('aria-current', 'false');
  expect(store.getState().search.selectedBrand).toBeNull();
});

test('ничего не найдено: список не показывается', async () => {
  respondWith([]);
  const { search } = setup();

  await search('ZZZ');

  await waitFor(() => expect(screen.getByRole('button', { name: 'Найти' })).toBeEnabled());
  expect(screen.queryByRole('heading', { name: 'Выберите производителя' })).not.toBeInTheDocument();
});
