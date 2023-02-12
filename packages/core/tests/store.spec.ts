import { describe, test, expect, vi } from 'vitest';
import { createStore } from '../src/store.js';
import { createEffect } from '../src/effect.js';

describe('store', () => {
  describe('object behaviors', () => {
    const base = {
      foo: {
        bar: 'baz',
        baq: [1, 2, 3],
      },
    };

    const store = createStore(base);

    test('keys', () => {
      const keys = Object.keys(store);
      expect(keys).toEqual(['foo']);
    });

    test('entries', () => {
      const entries = Object.entries(store);

      expect(entries).toEqual([
        [
          'foo',
          {
            bar: 'baz',
            baq: [1, 2, 3],
          },
        ],
      ]);
    });

    test('in', () => {
      expect('foo' in store).toEqual(true);
    });

    test('stringify', () => {
      const stringified = JSON.stringify(store);

      expect(stringified).toEqual(JSON.stringify(base));
    });
  });

  describe('reactivity', () => {
    test('primitive object properties', () => {
      const store = createStore({
        foo: 'bar',
      });

      const spy = vi.fn(() => {
        store.foo;
      });

      createEffect(spy);

      store.foo = 'baz';

      expect(spy).toHaveBeenCalledTimes(2);
    });

    test.only('getter', () => {
      const store = createStore({
        firstName: 'foo',
        lastName: 'bar',
        get fullName() {
          return `${this.firstName} ${this.lastName}`;
        },
      });

      expect(store.fullName).toEqual('foo bar');

      store.firstName = 'FOO';

      expect(store.fullName).toEqual('FOO bar');
    });

    test('nested objects', () => {
      const store = createStore({
        name: 'Chris',
        car: {
          make: 'Ford',
          model: 'Mustang',
        },
        pets: [
          {
            name: 'Hitch',
          },
          {
            name: 'Dre',
          },
        ],
      });

      expect(store.name).toEqual('Chris');
      expect(store.car).toEqual({
        make: 'Ford',
        model: 'Mustang',
      });
      expect(store.pets[0]).toEqual({
        name: 'Hitch',
      });

      let carEffectCount = 0;
      let nameEffectCount = 0;

      createEffect(() => {
        store.car.make;
        carEffectCount++;
      });

      createEffect(() => {
        store.name;
        nameEffectCount++;
      });

      store.car.make = 'Honda';

      expect(carEffectCount).toEqual(2);

      store.name = 'blah';

      expect(nameEffectCount).toEqual(2);
    });
  });
});
