import React, { useEffect, useState } from 'react';
import { buildCachedFetch } from './fetch';
import { reactor } from '@signalis/react';
import { makeServer } from './server';

interface Person {
  name: string;
}

makeServer();

const cachedFetch = buildCachedFetch();

const DisplayPersonBase = () => {
  const [loading, setLoading] = useState(false);
  const [person, setPerson] = useState<Person>();

  useEffect(() => {
    setLoading(true);
    cachedFetch('/api/users/1')
      .then((res) => {
        setPerson(res);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1>Display Person 1</h1>
      {loading && <span>Loading...</span>}
      {person && <span>Name: {person.name}</span>}
    </div>
  );
};

DisplayPersonBase.displayName = 'DisplayPerson';

const DisplayPerson = reactor(DisplayPersonBase);

const UpdatePersonBase = () => {
  const [inputValue, setInputValue] = useState('');

  function handleInputChange(e: React.FormEvent<HTMLInputElement>) {
    setInputValue(e.currentTarget.value);
  }

  function handleSubmit() {
    cachedFetch('/api/users/1', {
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

UpdatePersonBase.displayName = 'UpdatePerson';

const UpdatePerson = reactor(UpdatePersonBase);
// const UpdatePerson = UpdatePersonBase;

function DataExample() {
  return (
    <div>
      <DisplayPerson />
      <UpdatePerson />
    </div>
  );
}

export default DataExample;
