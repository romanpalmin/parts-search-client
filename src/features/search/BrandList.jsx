import { useDispatch, useSelector } from 'react-redux';
import { brandSelected, selectBrands, selectSelectedBrand } from './searchSlice.js';

// Список производителей для выбора. Пока нет позиций (до поиска, загрузка, ошибка) список пуст и ничего не рисуем.
export default function BrandList() {
  const brands = useSelector(selectBrands);
  const selectedBrand = useSelector(selectSelectedBrand);
  const dispatch = useDispatch();

  if (brands.length === 0) {
    return null;
  }

  return (
    <section>
      <h2 className="h5">Выберите производителя</h2>
      <div className="list-group">
        {brands.map((brand) => (
          <button
            key={brand}
            type="button"
            className={`list-group-item list-group-item-action${brand === selectedBrand ? ' active' : ''}`}
            aria-current={brand === selectedBrand}
            onClick={() => dispatch(brandSelected(brand))}
          >
            {brand}
          </button>
        ))}
      </div>
    </section>
  );
}
