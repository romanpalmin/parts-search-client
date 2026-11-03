import { configureStore } from '@reduxjs/toolkit';
import searchReducer from './features/search/searchSlice.js';

export const store = configureStore({
  reducer: {
    search: searchReducer,
  },
});
