import { useSelector } from 'react-redux';
import Loader from '../../components/Loader.jsx';
import { selectOfferRows, selectOffersBrand, selectOffersError, selectOffersStatus } from './offersSlice.js';

// Валюта в документации API не указана, поэтому только число с двумя знаками
const formatPrice = (price) => price.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Этап 2: аналоги и предложения выбранного производителя (загрузка, ошибка, «ничего не найдено» или таблица)
export default function OffersTable() {
  const status = useSelector(selectOffersStatus);
  const error = useSelector(selectOffersError);
  const brand = useSelector(selectOffersBrand);
  const rows = useSelector(selectOfferRows);

  if (status === 'loading') {
    return <Loader />;
  }
  if (status === 'failed') {
    return (
      <div className="alert alert-danger mt-4" role="alert">
        {error}
      </div>
    );
  }
  if (status !== 'succeeded') {
    return null;
  }
  if (rows.length === 0) {
    return <div className="alert alert-info mt-4">По производителю «{brand}» ничего не найдено</div>;
  }

  return (
    <section className="mt-4">
      <h2 className="h5">Аналоги и предложения: {brand}</h2>
      <table className="table table-hover align-middle">
        <thead>
          <tr>
            <th>Название / производитель</th>
            <th className="text-end">Цена</th>
            <th className="text-end">Остаток</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className={row.stock > 0 ? undefined : 'text-muted'}>
              <td>
                <div>{row.name}</div>
                <div className="small text-muted">
                  {row.brand}, {row.number}
                </div>
              </td>
              <td className="text-end">{row.price === null ? '—' : formatPrice(row.price)}</td>
              <td className="text-end">{row.stock > 0 ? row.stock : 'нет в наличии'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
