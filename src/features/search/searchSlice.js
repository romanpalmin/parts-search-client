import { createAsyncThunk, createSelector, createSlice } from '@reduxjs/toolkit';
import { fetchGoods } from '../../api/partsApi.js';

// Этап 1: по артикулу получаем позиции (из них потом выберем производителей)
export const fetchBrands = createAsyncThunk('search/fetchBrands', (number) => fetchGoods({ number }));

const searchSlice = createSlice({
  name: 'search',
  initialState: { status: 'idle', number: '', goods: [], error: null, selectedBrand: null },
  reducers: {
    // Свои действия slice (в отличие от extraReducers, которые реагируют на thunk)
    brandSelected: (state, action) => {
      state.selectedBrand = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBrands.pending, (state, action) => {
        // meta.arg: то, с чем вызвали thunk (введённый номер). Нужен на этапе 2.
        state.number = action.meta.arg;
        state.status = 'loading';
        state.goods = [];
        state.error = null;
        state.selectedBrand = null; // новый поиск сбрасывает выбор из прошлой выдачи
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
export const { brandSelected } = searchSlice.actions;

export const selectStatus = (state) => state.search.status;
export const selectError = (state) => state.search.error;
export const selectNumber = (state) => state.search.number;
export const selectSelectedBrand = (state) => state.search.selectedBrand;
const selectGoods = (state) => state.search.goods;

// Производители без повторов, в порядке ответа.
// createSelector кэширует результат: пока goods не изменились, вернётся тот же массив (не вызывает лишних рендеров).
export const selectBrands = createSelector([selectGoods], (goods) => [...new Set(goods.map((good) => good.brand))]);
