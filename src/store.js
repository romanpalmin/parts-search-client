import { configureStore } from '@reduxjs/toolkit';
import offersReducer from './features/offers/offersSlice.js';
import searchReducer from './features/search/searchSlice.js';

// Фабрика нужна тестам: на каждый тест свой store, состояние не протекает между ними
export const makeStore = () =>
  configureStore({
    reducer: {
      search: searchReducer,
      offers: offersReducer,
    },
  });

export const store = makeStore();
