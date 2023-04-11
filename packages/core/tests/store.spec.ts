import { describe, expect, test, vi } from 'vitest';
import { createEffect } from '../src/effect.js';
import { update } from '../src/update.js';
import { createStore, unwrap, setProperty } from '../src/store.js';

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

      setProperty(unwrap(store), 'foo', 'baz');

      expect(spy).toHaveBeenCalledTimes(2);
    });

    test('getter', () => {
      const store = createStore({
        firstName: 'foo',
        lastName: 'bar',
        get fullName() {
          return `${this.firstName} ${this.lastName}`;
        },
      });

      expect(store.fullName).toEqual('foo bar');

      setProperty(unwrap(store), 'firstName', 'FOO');

      expect(store.fullName).toEqual('FOO bar');
    });

    test('method', () => {
      let count = 0;
      const store = createStore({
        numbers: [],

        boolean: {
          isTrue: true,
        },

        addThing() {
          update(this, (draft) => {
            draft.numbers = [...draft.numbers, count];
          });
          count++;
        },

        toggleBoolean() {
          update(this, (draft) => {
            draft.boolean.isTrue = !draft.boolean.isTrue;
          });
        },
      });

      expect(store.numbers).toEqual([]);

      store.addThing();

      expect(store.numbers).toEqual([0]);

      expect(store.boolean.isTrue).toBe(true);

      store.toggleBoolean();

      expect(store.boolean.isTrue).toBe(false);
    });

    test('array properties', () => {
      const store = createStore({
        foo: [1, 2, 3],
      });

      const effectSpy = vi.fn(() => {
        store.foo.length;
      });

      createEffect(effectSpy);

      expect(effectSpy).toHaveBeenCalledOnce();

      setProperty(unwrap(store), 'foo', [...store.foo, 4]);

      expect(effectSpy).toHaveBeenCalledTimes(2);
    });

    test('array root', () => {
      const store = createStore([1, 2, 3]);

      const effectSpy = vi.fn(() => {
        store.length;
      });

      createEffect(effectSpy);

      expect(effectSpy).toHaveBeenCalledOnce();

      setProperty(unwrap(store), store.length, 4);

      expect(effectSpy).toHaveBeenCalledTimes(2);
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

      update(store, (draft) => {
        draft.car.make = 'Honda';
      });

      expect(carEffectCount).toEqual(2);

      update(store, (draft) => {
        draft.name = 'blah';
      });

      expect(nameEffectCount).toEqual(2);
    });

    test('keys', () => {
      const store = createStore({
        foo: 1,
        bar: {},
      });

      const effectSpy = vi.fn(() => {
        Object.keys(store.bar);
      });

      createEffect(effectSpy);

      update(store, (draft) => {
        draft.bar.baz = 2;
      });

      expect(effectSpy).toHaveBeenCalledTimes(2);
    });

    test('entries', () => {
      const store = createStore({
        foo: 1,
        bar: {},
      });

      const effectSpy = vi.fn(() => {
        Object.entries(store.bar);
      });

      createEffect(effectSpy);

      update(store, (draft) => {
        draft.bar.baz = 2;
      });

      expect(effectSpy).toHaveBeenCalledTimes(2);
    });

    test('values', () => {
      const store = createStore({
        foo: 1,
        bar: {},
      });

      const effectSpy = vi.fn(() => {
        Object.values(store.bar);
      });

      createEffect(effectSpy);

      update(store, (draft) => {
        draft.bar.baz = 2;
      });

      expect(effectSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('unwrap', () => {
    test('maintains referential equality with regular object', () => {
      const base = {
        foo: 'foo',
      };
      const store = createStore(base);
      const unwrapped = unwrap(store);
      expect(unwrapped === base).toBe(true);
      expect(unwrapped.foo).toEqual('foo');
    });

    test('does not maintain referential equality with frozen object, but still unwraps', () => {
      const base = {
        foo: 'foo',
      };
      Object.freeze(base);
      const store = createStore(base);
      const unwrapped = unwrap(store);
      expect(unwrapped === base).toBe(false);
      expect(unwrapped.foo).toEqual('foo');
    });
  });

  describe('update', () => {
    test('flat object', () => {
      const store = createStore({
        foo: 'string',
        bar: 'bar',
      });

      update(store, (draft) => {
        draft.foo = 'foo';
      });

      expect(store.foo).toEqual('foo');
    });

    test('object property', () => {
      const store = createStore({
        foo: {
          bar: 'baz',
        },
      });

      const effectSpy = vi.fn(() => {
        store.foo.baz;
        store.foo.bar;
      });

      createEffect(effectSpy);

      update(store, (draft) => {
        draft.foo.bar = 'blah';
        draft.foo.baz = 'baz';
      });

      expect(effectSpy).toHaveBeenCalledTimes(2);

      expect(store.foo.bar).toEqual('blah');
      expect(store.foo.baz).toEqual('baz');

      update(store, (draft) => {
        Object.assign(draft.foo, { bar: 'bar' });
      });

      expect(effectSpy).toHaveBeenCalledTimes(3);
    });

    test('array property', () => {
      const store = createStore({
        foo: ['foo'],
      });

      const effectSpy = vi.fn(() => {
        store.foo.length;
      });

      createEffect(effectSpy);

      update(store, (draft) => {
        draft.foo.push('bar');
      });

      expect(store.foo).toEqual(['foo', 'bar']);
      expect(effectSpy).toHaveBeenCalledTimes(2);

      update(store, (draft) => {
        draft.foo[0] = 'FOO';
      });

      expect(store.foo).toEqual(['FOO', 'bar']);
    });

    test('delete property', () => {
      const store = createStore({
        foo: 'foo',
        bar: {
          name: 'bar',
        },
      });

      const result = update(store, (draft) => {
        delete draft.foo;
      });

      expect(store).not.toHaveProperty('foo');

      expect(store).toEqual(result);
      expect(store).toEqual({
        bar: {
          name: 'bar',
        },
      });

      update(store, (draft) => {
        delete draft.bar.name;
      });

      expect(store).toEqual({
        bar: {},
      });

      expect(store.bar).not.toHaveProperty('name');
    });

    test('with frozen object', () => {
      const obj1 = {
        value: 0,
      };

      const obj2 = {
        value: 1,
      };

      Object.freeze(obj1);
      Object.freeze(obj2);

      const store = createStore({
        state: obj1,
      });

      expect(store.state).toEqual(obj1);

      update(store, (draft) => {
        draft.state = obj2;
      });

      expect(store.state).toEqual(obj2);
    });

    test('with frozen array', () => {
      const arr1 = [1, 2, 3];
      const arr2 = [1, 2, 3];

      Object.freeze(arr1);
      Object.freeze(arr2);

      const store = createStore({
        state: arr1,
      });

      expect(store.state).toEqual(arr1);

      update(store, (draft) => {
        draft.state = arr2;
      });

      expect(store.state).toEqual(arr2);
    });
  });
});
