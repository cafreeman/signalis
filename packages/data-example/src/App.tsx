import React, { useEffect, useState } from 'react';
import { buildCachedFetch } from './fetch';

interface Person {
  name: string;
}

const useCachedFetch = buildCachedFetch();

const DisplayPerson = () => {
  const { fetch, data: person, loading } = useCachedFetch<Person>();

  useEffect(() => {
    fetch('/api/users/1');
  }, []);

  return (
    <div>
      <h1>Display Person 1</h1>
      {loading && <span>Loading...</span>}
      {person && <span>Name: {person.name}</span>}
    </div>
  );
};

const UpdatePerson = () => {
  const [inputValue, setInputValue] = useState('');

  function handleInputChange(e: React.FormEvent<HTMLInputElement>) {
    setInputValue(e.currentTarget.value);
  }

  const { fetch } = useCachedFetch();

  function handleSubmit() {
    fetch('/api/users/1', {
      method: 'PUT',
      body: JSON.stringify({ name: inputValue }),
    }).then(() => {
      setInputValue('');
    });
  }

  return (
    <div>
      <h1>Update Person 1</h1>
      <input type="text" value={inputValue} onChange={handleInputChange} />
      <button type="button" onClick={handleSubmit}>
        Submit
      </button>
    </div>
  );
};

function App() {
  return (
    <div>
      <DisplayPerson />
      <UpdatePerson />
    </div>
  );
}

export default App;
