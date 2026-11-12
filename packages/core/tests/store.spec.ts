import { describe, expect, test, vi } from 'vitest';
import { createDerived } from '../src/derived.js';
import { createEffect } from '../src/effect.js';
import { update } from '../src/update.js';
import { $NODES, $STOREPROXY, createStore, unwrap, setProperty } from '../src/store.js';

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

  describe('property equality', () => {
    test('writing the value a property already has does not re-run its observers', () => {
      const store = createStore({ a: 1 });
      const seen: number[] = [];
      const dispose = createEffect(() => {
        seen.push(store.a);
      });

      update(store, (draft) => {
        draft.a = 1;
      });
      expect(seen).toEqual([1]);

      update(store, (draft) => {
        draft.a = 2;
      });
      expect(seen).toEqual([1, 2]);

      update(store, (draft) => {
        draft.a = 2;
      });
      expect(seen).toEqual([1, 2]);
      dispose();
    });

    test.each([
      { kind: 'object', original: { name: 'Jane' }, replacement: { name: 'Jane' } },
      { kind: 'array', original: [1, 2], replacement: [1, 2] },
    ])('$kind properties compare by reference, not contents', ({ original, replacement }) => {
      const store = createStore({ value: original });
      const seen: unknown[] = [];
      const dispose = createEffect(() => {
        seen.push(store.value);
      });
      const proxy = store.value;

      update(store, (draft) => {
        draft.value = original;
      });
      update(store, (draft) => {
        const current = draft.value;
        draft.value = current;
      });
      update(store, (draft) => {
        draft.value = proxy;
      });
      expect(seen).toEqual([original]);
      expect(seen[0]).toBe(proxy);

      update(store, (draft) => {
        draft.value = replacement;
      });
      expect(seen).toEqual([original, replacement]);
      expect(seen[1]).not.toBe(proxy);
      expect(unwrap(seen[1])).toBe(replacement);

      update(store, (draft) => {
        draft.value = replacement;
      });
      expect(seen).toEqual([original, replacement]);
      dispose();
    });
  });

  describe('key-set notifications', () => {
    test('a second computation reading Object.keys re-runs when a key is added', () => {
      const store = createStore<Record<string, number>>({ a: 1 });
      const first: string[][] = [];
      const second: string[][] = [];
      const disposeFirst = createEffect(() => {
        first.push(Object.keys(store));
      });
      const disposeSecond = createEffect(() => {
        second.push(Object.keys(store));
      });

      update(store, (draft) => {
        draft['b'] = 2;
      });

      expect(first).toEqual([['a'], ['a', 'b']]);
      expect(second).toEqual([['a'], ['a', 'b']]);
      disposeFirst();
      disposeSecond();
    });

    test('a computation reading Object.keys stays subscribed after it re-runs', () => {
      const store = createStore<Record<string, number>>({ a: 1 });
      const seen: string[][] = [];
      const dispose = createEffect(() => {
        seen.push(Object.keys(store));
      });

      update(store, (draft) => {
        draft['b'] = 2;
      });
      update(store, (draft) => {
        draft['c'] = 3;
      });

      expect(seen).toEqual([['a'], ['a', 'b'], ['a', 'b', 'c']]);
      dispose();
    });

    describe.each(['delete', 'assign undefined'])('%s', (operation) => {
      test.each([
        {
          scenario: 'an existing undefined-valued key',
          initial: { a: undefined },
          keys: [['a'], []],
          values: [undefined],
        },
        {
          scenario: 'an absent key',
          initial: {},
          keys: [[]],
          values: [undefined],
        },
        {
          scenario: 'an existing defined key',
          initial: { a: 1 },
          keys: [['a'], []],
          values: [1, undefined],
        },
      ])('only notifies changed observations for $scenario', ({ initial, keys, values }) => {
        const store = createStore<Record<string, number | undefined>>(initial);
        const keyHistory: string[][] = [];
        const valueHistory: Array<number | undefined> = [];
        const disposeKeys = createEffect(() => {
          keyHistory.push(Object.keys(store));
        });
        const disposeValue = createEffect(() => {
          valueHistory.push(store['a']);
        });

        update(store, (draft) => {
          if (operation === 'delete') delete draft['a'];
          else draft['a'] = undefined;
        });

        expect(keyHistory).toEqual(keys);
        expect(valueHistory).toEqual(values);
        expect(Object.hasOwn(unwrap(store), 'a')).toBe(false);
        disposeKeys();
        disposeValue();
      });
    });

    test('a computation reading only Object.keys does not re-run when a value changes', () => {
      const store = createStore({ a: 1 });
      const keys: string[][] = [];
      const values: number[] = [];
      const entries: Array<Array<[string, number]>> = [];
      const disposeKeys = createEffect(() => {
        keys.push(Object.keys(store));
      });
      const disposeValue = createEffect(() => {
        values.push(store.a);
      });
      const disposeEntries = createEffect(() => {
        entries.push(Object.entries(store));
      });

      update(store, (draft) => {
        draft.a = 2;
      });
      update(store, (draft) => {
        draft.a = 3;
      });

      expect(keys).toEqual([['a']]);
      expect(values).toEqual([1, 2, 3]);
      expect(entries).toEqual([[['a', 1]], [['a', 2]], [['a', 3]]]);
      disposeKeys();
      disposeValue();
      disposeEntries();
    });

    test.each([
      {
        operation: 'existing index replacement',
        mutate: (items: number[]) => {
          items[1] = 4;
        },
      },
      {
        operation: 'equal-length dense splice replacement',
        mutate: (items: number[]) => {
          items.splice(1, 1, 4);
        },
      },
    ])('array $operation does not notify key-only readers', ({ mutate }) => {
      const store = createStore({ items: [1, 2, 3] });
      const keys: string[][] = [];
      const values: Array<number | undefined> = [];
      const entries: Array<Array<[string, number]>> = [];
      const disposeKeys = createEffect(() => {
        keys.push(Object.keys(store.items));
      });
      const disposeValue = createEffect(() => {
        values.push(store.items[1]);
      });
      const disposeEntries = createEffect(() => {
        entries.push(Object.entries(store.items));
      });

      update(store, (draft) => {
        mutate(draft.items);
      });

      expect(keys).toEqual([['0', '1', '2']]);
      expect(values).toEqual([2, 4]);
      expect(entries).toEqual([
        [
          ['0', 1],
          ['1', 2],
          ['2', 3],
        ],
        [
          ['0', 1],
          ['1', 4],
          ['2', 3],
        ],
      ]);
      disposeKeys();
      disposeValue();
      disposeEntries();
    });

    test('one multi-write update notifies readers once with only the final state', () => {
      const store = createStore<Record<string, number>>({ a: 1, b: 2 });
      const keys: string[][] = [];
      const values: Array<number | undefined> = [];
      const entries: Array<Array<[string, number]>> = [];
      const disposeKeys = createEffect(() => {
        keys.push(Object.keys(store));
      });
      const disposeValue = createEffect(() => {
        values.push(store['a']);
      });
      const disposeEntries = createEffect(() => {
        entries.push(Object.entries(store));
      });

      update(store, (draft) => {
        draft['a'] = 3;
        draft['c'] = 4;
        delete draft['b'];
        draft['a'] = 5;
      });

      expect(keys).toEqual([
        ['a', 'b'],
        ['a', 'c'],
      ]);
      expect(values).toEqual([1, 5]);
      expect(entries).toEqual([
        [
          ['a', 1],
          ['b', 2],
        ],
        [
          ['a', 5],
          ['c', 4],
        ],
      ]);
      disposeKeys();
      disposeValue();
      disposeEntries();
    });

    test('growing array length without adding indices still notifies key readers', () => {
      const store = createStore({ items: [1, 2] });
      const keys: string[][] = [];
      const dispose = createEffect(() => {
        keys.push(Object.keys(store.items));
      });

      update(store, (draft) => {
        draft.items.length = 4;
      });

      expect(keys).toEqual([
        ['0', '1'],
        ['0', '1'],
      ]);
      expect(store.items.length).toBe(4);
      dispose();
    });

    describe.each(['Object.keys', 'Object.entries', 'for...in', 'Reflect.ownKeys'])(
      '%s subscriptions',
      (method) => {
        function enumerate(value: object): unknown[] {
          if (method === 'Object.entries') return Object.entries(value);
          if (method === 'Reflect.ownKeys') return Reflect.ownKeys(value);
          if (method === 'for...in') {
            const keys: string[] = [];
            for (const key in value) keys.push(key);
            return keys;
          }
          return Object.keys(value);
        }

        function snapshot(entries: Array<[string, number]>, array = false): unknown[] {
          if (method === 'Object.entries') return entries;
          const keys = entries.map(([key]) => key);
          return method === 'Reflect.ownKeys'
            ? [...keys, ...(array ? ['length'] : []), $STOREPROXY, $NODES]
            : keys;
        }

        test('multiple object readers stay subscribed through additions and deletions', () => {
          const store = createStore<Record<string, number>>({ a: 1 });
          const first: unknown[][] = [];
          const second: unknown[][] = [];
          const disposeFirst = createEffect(() => {
            first.push(enumerate(store));
          });
          const disposeSecond = createEffect(() => {
            second.push(enumerate(store));
          });
          const expected = [snapshot([['a', 1]])];
          expect(first).toEqual(expected);
          expect(second).toEqual(expected);

          update(store, (draft) => {
            draft['b'] = 2;
          });
          expected.push(
            snapshot([
              ['a', 1],
              ['b', 2],
            ]),
          );
          expect(first).toEqual(expected);
          expect(second).toEqual(expected);

          update(store, (draft) => {
            delete draft['a'];
          });
          expected.push(snapshot([['b', 2]]));
          expect(first).toEqual(expected);
          expect(second).toEqual(expected);

          update(store, (draft) => {
            draft['c'] = 3;
          });
          expected.push(
            snapshot([
              ['b', 2],
              ['c', 3],
            ]),
          );
          expect(first).toEqual(expected);
          expect(second).toEqual(expected);
          disposeFirst();
          disposeSecond();
        });

        test('multiple array readers stay subscribed through additions and deletions', () => {
          const store = createStore({ items: [1, 2] });
          const first: unknown[][] = [];
          const second: unknown[][] = [];
          const disposeFirst = createEffect(() => {
            first.push(enumerate(store.items));
          });
          const disposeSecond = createEffect(() => {
            second.push(enumerate(store.items));
          });
          const expected = [
            snapshot(
              [
                ['0', 1],
                ['1', 2],
              ],
              true,
            ),
          ];
          expect(first).toEqual(expected);
          expect(second).toEqual(expected);

          update(store, (draft) => {
            draft.items.push(3);
          });
          expected.push(
            snapshot(
              [
                ['0', 1],
                ['1', 2],
                ['2', 3],
              ],
              true,
            ),
          );
          expect(first).toEqual(expected);
          expect(second).toEqual(expected);

          update(store, (draft) => {
            delete draft.items[0];
          });
          expected.push(
            snapshot(
              [
                ['1', 2],
                ['2', 3],
              ],
              true,
            ),
          );
          expect(first).toEqual(expected);
          expect(second).toEqual(expected);

          update(store, (draft) => {
            draft.items.pop();
          });
          expected.push(snapshot([['1', 2]], true));
          expect(first).toEqual(expected);
          expect(second).toEqual(expected);
          disposeFirst();
          disposeSecond();
        });
      },
    );

    test.each([
      {
        operation: 'push',
        mutate: (items: number[]) => items.push(4),
        keys: ['0', '1', '2', '3'],
      },
      {
        operation: 'pop',
        mutate: (items: number[]) => items.pop(),
        keys: ['0', '1'],
      },
      {
        operation: 'structural splice removal',
        mutate: (items: number[]) => items.splice(1, 1),
        keys: ['0', '1'],
      },
      {
        operation: 'structural splice insertion',
        mutate: (items: number[]) => items.splice(1, 0, 4),
        keys: ['0', '1', '2', '3'],
      },
      {
        operation: 'length truncation',
        mutate: (items: number[]) => {
          items.length = 1;
        },
        keys: ['0'],
      },
      {
        operation: 'index deletion',
        mutate: (items: number[]) => {
          delete items[1];
        },
        keys: ['0', '2'],
      },
    ])('array $operation notifies key readers once', ({ mutate, keys }) => {
      const store = createStore({ items: [1, 2, 3] });
      const seen: string[][] = [];
      const dispose = createEffect(() => {
        seen.push(Object.keys(store.items));
      });

      expect(seen).toEqual([['0', '1', '2']]);

      update(store, (draft) => {
        mutate(draft.items);
      });

      expect(seen).toEqual([['0', '1', '2'], keys]);
      dispose();
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

describe('update and derived values', () => {
  test('a derived two levels below a store property reflects an earlier write in the recipe', () => {
    const store = createStore({ count: 1 });
    const double = createDerived(() => store.count * 2);
    const plusOne = createDerived(() => double.value + 1);
    const seen: Array<number> = [];
    createEffect(() => {
      seen.push(plusOne.value);
    });

    update(store, (draft) => {
      draft.count = 5;

      expect(plusOne.value).toEqual(11);
    });

    expect(seen).toEqual([3, 11]);
  });
});
