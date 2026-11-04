import { useDispatch, useSelector } from 'react-redux';
import { fetchOffers } from '../offers/offersSlice.js';
import { brandSelected, selectBrands, selectNumber, selectSelectedBrand } from './searchSlice.js';

// Список производителей для выбора. Пока нет позиций (до поиска, загрузка, ошибка) список пуст и ничего не рисуем.
export default function BrandList() {
  const brands = useSelector(selectBrands);
  const selectedBrand = useSelector(selectSelectedBrand);
  const number = useSelector(selectNumber);
  const dispatch = useDispatch();

  // Выбор производителя запускает этап 2: запрос по введённому номеру и выбранному бренду
  const handleSelect = (brand) => {
    dispatch(brandSelected(brand));
    dispatch(fetchOffers({ number, brand }));
  };

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
            onClick={() => handleSelect(brand)}
          >
            {brand}
          </button>
        ))}
      </div>
    </section>
  );
}
