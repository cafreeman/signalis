// import { createEffect } from '../../src/effect';
// import { describe, test, assert } from 'vitest';
// import { TrackedSet } from '../../src/collections/tracked-set';

// describe.skip('Tracked Set', () => {
//   test('constructor', () => {
//     const set = new TrackedSet(['foo', 123]);

//     assert.equal(set.has('foo'), true);
//     assert.equal(set.size, 2);
//     assert.ok(set instanceof Set);

//     const setFromSet = new TrackedSet(set);
//     assert.equal(setFromSet.has('foo'), true);
//     assert.equal(setFromSet.size, 2);
//     assert.ok(setFromSet instanceof Set);

//     const setFromEmpty = new TrackedSet();
//     assert.equal(setFromEmpty.has('anything'), false);
//     assert.equal(setFromEmpty.size, 0);
//     assert.ok(setFromEmpty instanceof Set);
//   });

//   test('works with all kinds of values', () => {
//     const set = new TrackedSet<
//       string | Record<PropertyKey, unknown> | (() => unknown) | number | boolean | null
//     >([
//       'foo',
//       {},
//       () => {
//         /* no op */
//       },
//       123,
//       true,
//       null,
//     ]);

//     assert.equal(set.size, 6);
//   });

//   test('add/has', () => {
//     const set = new TrackedSet();

//     set.add('foo');
//     assert.equal(set.has('foo'), true);
//   });

//   test('entries', () => {
//     const set = new TrackedSet();
//     set.add(0);
//     set.add(2);
//     set.add(1);

//     const iter = set.entries();

//     assert.deepEqual(iter.next().value, [0, 0]);
//     assert.deepEqual(iter.next().value, [2, 2]);
//     assert.deepEqual(iter.next().value, [1, 1]);
//     assert.equal(iter.next().done, true);
//   });

//   test('keys', () => {
//     const set = new TrackedSet();
//     set.add(0);
//     set.add(2);
//     set.add(1);

//     const iter = set.keys();

//     assert.equal(iter.next().value, 0);
//     assert.equal(iter.next().value, 2);
//     assert.equal(iter.next().value, 1);
//     assert.equal(iter.next().done, true);
//   });

//   test('values', () => {
//     const set = new TrackedSet();
//     set.add(0);
//     set.add(2);
//     set.add(1);

//     const iter = set.values();

//     assert.equal(iter.next().value, 0);
//     assert.equal(iter.next().value, 2);
//     assert.equal(iter.next().value, 1);
//     assert.equal(iter.next().done, true);
//   });

//   test('forEach', () => {
//     const set = new TrackedSet();
//     set.add(0);
//     set.add(1);
//     set.add(2);

//     let count = 0;
//     let values = '';

//     set.forEach((v, k) => {
//       count++;
//       values += k;
//       values += v;
//     });

//     assert.equal(count, 3);
//     assert.equal(values, '001122');
//   });

//   test('size', () => {
//     const set = new TrackedSet();
//     assert.equal(set.size, 0);

//     set.add(0);
//     assert.equal(set.size, 1);

//     set.add(1);
//     assert.equal(set.size, 2);

//     set.delete(1);
//     assert.equal(set.size, 1);

//     set.add(0);
//     assert.equal(set.size, 1);
//   });

//   test('delete', () => {
//     const set = new TrackedSet();

//     assert.equal(set.has(0), false);

//     set.add(0);
//     assert.equal(set.has(0), true);

//     set.delete(0);
//     assert.equal(set.has(0), false);
//   });

//   test('clear', () => {
//     const set = new TrackedSet();

//     set.add(0);
//     set.add(1);
//     assert.equal(set.size, 2);

//     set.clear();
//     assert.equal(set.size, 0);
//     assert.equal(set.has(0), false);
//     assert.equal(set.has(1), false);
//   });

//   describe('reactivity', () => {
//     test('add', () => {
//       const set = new TrackedSet();

//       let count = 0;

//       createEffect(() => {
//         set.size;
//         count++;
//       });

//       set.add(0);
//       set.add(1);
//       assert.equal(count, 3);
//     });

//     test('add with existing value', () => {
//       const set = new TrackedSet();

//       let count = 0;

//       createEffect(() => {
//         set.size;
//         count++;
//       });

//       set.add(0);
//       set.add(0);
//       assert.equal(count, 3);
//     });

//     test('add unrelated value', () => {
//       const set = new TrackedSet();

//       let count = 0;

//       createEffect(() => {
//         set.size;
//         count++;
//       });

//       set.add('bar');
//       set.has('foo');
//       assert.equal(count, 2);
//     });

//     test('entries', () => {
//       const set = new TrackedSet();

//       let count = 0;

//       createEffect(() => {
//         set.entries();
//         count++;
//       });

//       set.add('bar');
//       assert.equal(count, 2);
//     });

//     test('keys', () => {
//       const set = new TrackedSet();

//       let count = 0;

//       createEffect(() => {
//         set.keys();
//         count++;
//       });

//       set.add('bar');
//       assert.equal(count, 2);
//     });

//     test('values', () => {
//       const set = new TrackedSet();

//       let count = 0;

//       createEffect(() => {
//         set.values();
//         count++;
//       });

//       set.add('bar');
//       assert.equal(count, 2);
//     });

//     test('forEach', () => {
//       const set = new TrackedSet();

//       let count = 0;

//       createEffect(() => {
//         // eslint-disable-next-line @typescript-eslint/no-empty-function
//         set.forEach(() => {});
//         count++;
//       });

//       set.add('bar');
//       assert.equal(count, 2);
//     });

//     test('delete', () => {
//       const set = new TrackedSet(['foo', 123]);

//       let count = 0;

//       createEffect(() => {
//         set.has('foo');
//         count++;
//       });

//       set.delete('foo');
//       assert.equal(count, 2);
//     });

//     test('delete unrelated value', () => {
//       const set = new TrackedSet(['foo', 123]);

//       let count = 0;

//       createEffect(() => {
//         set.has('foo');
//         count++;
//       });

//       set.delete(123);
//       assert.equal(count, 1);
//     });

//     test('clear', () => {
//       const set = new TrackedSet(['foo', 123]);

//       let count = 0;

//       createEffect(() => {
//         set.has('foo');
//         count++;
//       });

//       set.clear();
//       assert.equal(count, 2);
//     });
//   });
// });
