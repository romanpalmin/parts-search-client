import { createAsyncThunk, createSelector, createSlice } from '@reduxjs/toolkit';
import { fetchGoods } from '../../api/partsApi.js';

// Этап 1: по артикулу получаем позиции (из них потом выберем производителей)
export const fetchBrands = createAsyncThunk('search/fetchBrands', (number) => fetchGoods({ number }));

const searchSlice = createSlice({
  name: 'search',
  initialState: { status: 'idle', goods: [], error: null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchBrands.pending, (state) => {
        state.status = 'loading';
        state.goods = [];
        state.error = null;
      })
      .addCase(fetchBrands.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.goods = action.payload;
      })
      .addCase(fetchBrands.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message;
      });
  },
});

export default searchSlice.reducer;

export const selectStatus = (state) => state.search.status;
export const selectError = (state) => state.search.error;
const selectGoods = (state) => state.search.goods;

// Производители без повторов, в порядке ответа.
// createSelector кэширует результат: пока goods не изменились, вернётся тот же массив (не вызывает лишних рендеров).
export const selectBrands = createSelector([selectGoods], (goods) => [...new Set(goods.map((good) => good.brand))]);
