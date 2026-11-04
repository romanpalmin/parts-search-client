import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { fetchGoods } from '../../api/partsApi.js';
import { fetchBrands } from '../search/searchSlice.js';

// Этап 2: по введённому номеру и выбранному производителю получаем позиции и аналоги
export const fetchOffers = createAsyncThunk('offers/fetchOffers', ({ number, brand }) =>
  fetchGoods({ number, brand, analogues: true }),
);

const initialState = { status: 'idle', brand: null, goods: [], error: null };

const offersSlice = createSlice({
  name: 'offers',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchOffers.pending, (state, action) => {
        state.status = 'loading';
        state.brand = action.meta.arg.brand;
        state.goods = [];
        state.error = null;
      })
      .addCase(fetchOffers.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.goods = action.payload;
      })
      .addCase(fetchOffers.rejected, (state, action) => {
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
