import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { fetchBrands } from './searchSlice.js';

export default function SearchForm() {
  const [number, setNumber] = useState('');
  const dispatch = useDispatch();

  const handleSubmit = (event) => {
    event.preventDefault();
    dispatch(fetchBrands(number.trim()));
  };

  return (
    <form className="row g-2 mb-4" onSubmit={handleSubmit}>
      <div className="col">
        <input
          className="form-control"
          aria-label="Артикул"
          placeholder="Артикул, например 01089"
          value={number}
          onChange={(event) => setNumber(event.target.value)}
        />
      </div>
      <div className="col-auto">
        <button className="btn btn-primary" type="submit" disabled={!number.trim()}>
          Найти
        </button>
      </div>
    </form>
  );
}
