import { useSelector } from 'react-redux';
import Loader from '../../components/Loader.jsx';
import { selectBrands, selectError, selectNumber, selectStatus } from './searchSlice.js';

// Что показать под формой: загрузка, ошибка или «ничего не найдено». Иначе ничего.
export default function SearchStatus() {
  const status = useSelector(selectStatus);
  const error = useSelector(selectError);
  const number = useSelector(selectNumber);
  const brands = useSelector(selectBrands);

  if (status === 'loading') {
    return <Loader />;
  }
  if (status === 'failed') {
    return (
      <div className="alert alert-danger" role="alert">
        {error}
      </div>
    );
  }
  if (status === 'succeeded' && brands.length === 0) {
    return <div className="alert alert-info">По номеру «{number}» ничего не найдено</div>;
  }
  return null;
}
