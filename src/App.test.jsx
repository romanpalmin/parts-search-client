import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import App from './App.jsx';
import { store } from './store.js';

test('показывает заголовок', () => {
  render(
    <Provider store={store}>
      <App />
    </Provider>,
  );
  expect(screen.getByRole('heading', { name: 'Поиск автозапчастей' })).toBeInTheDocument();
});
