import { createAsyncThunk, createSelector, createSlice } from '@reduxjs/toolkit';
import { fetchGoods } from '../../api/partsApi.js';
import { fetchBrands } from '../search/searchSlice.js';
import { compareRows, flattenGoods, toRow } from './offerRules.js';

// Этап 2: по введённому номеру и выбранному производителю получаем позиции и аналоги
export const fetchOffers = createAsyncThunk(
  'offers/fetchOffers',
  ({ number, brand }) => fetchGoods({ number, brand, analogues: true }),
  {
    // Тот же производитель уже грузится или загружен: повторный запрос не нужен (thunk не запустится, действий не будет).
    // После ошибки повторить можно.
    condition: ({ brand }, { getState }) => {
      const offers = getState().offers;
      return !(brand === offers.brand && offers.status !== 'failed');
    },
  },
);

// requestId: id последнего запущенного запроса. Ответ с другим id устарел и игнорируется (гонка запросов).
const initialState = { status: 'idle', brand: null, requestId: null, goods: [], error: null };

const offersSlice = createSlice({
  name: 'offers',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchOffers.pending, (state, action) => {
        state.status = 'loading';
        state.brand = action.meta.arg.brand;
        state.requestId = action.meta.requestId;
        state.goods = [];
        state.error = null;
      })
      .addCase(fetchOffers.fulfilled, (state, action) => {
        if (action.meta.requestId !== state.requestId) return; // устаревший ответ
        state.status = 'succeeded';
        state.goods = action.payload;
      })
      .addCase(fetchOffers.rejected, (state, action) => {
        if (action.meta.requestId !== state.requestId) return; // устаревший ответ
        state.status = 'failed';
        state.error = action.error.message;
      })
      // Реакция на чужое действие: новый поиск брендов делает таблицу устаревшей.
      // В reducer Immer можно либо менять черновик, либо вернуть новое значение (не оба сразу).
      .addCase(fetchBrands.pending, () => initialState);
  },
});

export default offersSlice.reducer;

export const selectOffersStatus = (state) => state.offers.status;
export const selectOffersError = (state) => state.offers.error;
export const selectOffersBrand = (state) => state.offers.brand;
export const selectOffersGoods = (state) => state.offers.goods;

// Строки таблицы: позиция и аналоги, цена и остаток по правилам, отсортированные.
// createSelector: пока goods те же, вернётся тот же массив (без лишних рендеров).
export const selectOfferRows = createSelector([selectOffersGoods], (goods) =>
  flattenGoods(goods).map(toRow).sort(compareRows),
);
