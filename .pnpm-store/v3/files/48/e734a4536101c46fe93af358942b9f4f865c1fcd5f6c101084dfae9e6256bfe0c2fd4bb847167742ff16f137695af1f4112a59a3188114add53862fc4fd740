import { describe, it, expect } from 'vitest';
// TODO: add a tests tsconfig so we can import properly
import { buildCache } from '@data-eden/cache';

// TODO: add tests for types
// TODO test live trasaction where original cache has enitiy that is GCd (memory management tests)

describe('@data-eden/cache', function () {
  describe('cache with no user registry', function () {
    it('can be built', async function () {
      // TODO: this valid call fails if we switch module resolution to node16
      // see #36
      let cache = buildCache();

      expect(await cache.get('missing-key')).toBeUndefined();
    });

    it('can load serialized values', async function () {
      let cache = buildCache();
      // without a serializer, cache.load assumes serialized entries have values that are structured-cloneable
      // TODO: update to put these in the LRU
      await cache.load([
        ['book:1', { title: 'A History of the English speaking peoples' }],
        ['book:2', { title: 'Marlborough: his life and times' }],
      ]);

      let book1 = await cache.get('book:1');
      expect(book1).toMatchInlineSnapshot(`
        {
          "title": "A History of the English speaking peoples",
        }
      `);
    });

    it('test iterable cache.entries', async function () {
      let cache = buildCache();

      await cache.load([
        ['book:1', { title: 'A History of the English speaking peoples' }],
        ['book:2', { title: 'Marlborough: his life and times' }],
      ]);

      const entries = cache.entries();
      const entry1 = await entries.next();
      const defaultEntryState = { retained: { lru: false, ttl: 60000 } };

      // TODO setup & validate weekly held and strongly held entries
      expect(entry1.value).toEqual([
        'book:1',
        { title: 'A History of the English speaking peoples' },
        defaultEntryState,
      ]);

      const entry2 = await entries.next();
      expect(entry2.value).toEqual([
        'book:2',
        { title: 'Marlborough: his life and times' },
        defaultEntryState,
      ]);

      for await (const [key, value] of cache.entries()) {
        expect(key).toBeTypeOf('string');
        expect(value).toBeTypeOf('object');
      }
    });

    it('test keys iterator', async function () {
      let cache = buildCache();

      await cache.load([
        ['book:1', { title: 'A History of the English speaking peoples' }],
        ['book:2', { title: 'Marlborough: his life and times' }],
      ]);

      const entryKeys = cache.keys();

      const entryKey1 = await entryKeys.next();
      expect(entryKey1.value).toEqual('book:1');

      const entryKey2 = await entryKeys.next();
      expect(entryKey2.value).toEqual('book:2');

      for await (const key of cache.keys()) {
        expect(key).toBeTypeOf('string');
      }
    });

    it('test values iterator', async function () {
      let cache = buildCache();

      await cache.load([
        ['book:1', { title: 'A History of the English speaking peoples' }],
        ['book:2', { title: 'Marlborough: his life and times' }],
      ]);

      const entryValues = cache.values();

      const entryValue1 = await entryValues.next();
      expect(entryValue1.value).toEqual({
        title: 'A History of the English speaking peoples',
      });

      const entryValue2 = await entryValues.next();
      expect(entryValue2.value).toEqual({
        title: 'Marlborough: his life and times',
      });

      for await (const value of cache.values()) {
        expect(value).toBeTypeOf('object');
      }
    });

    it('test cache.save returns array of cache entry tuple', async function () {
      let cache = buildCache();

      await cache.load([
        ['book:1', { title: 'A History of the English speaking peoples' }],
        ['book:2', { title: 'Marlborough: his life and times' }],
      ]);

      const arrayOfCacheEntryTuples = await cache.save();

      const cacheEntryTuple1 = arrayOfCacheEntryTuples[0];
      const cacheEntryTuple2 = arrayOfCacheEntryTuples[1];

      expect(arrayOfCacheEntryTuples.length).toEqual(2);

      expect(cacheEntryTuple1?.length).toEqual(3);
      expect(cacheEntryTuple1[0]).toEqual('book:1');
      expect(cacheEntryTuple1[0]).toBeTypeOf('string');
      expect(cacheEntryTuple1[1]).toEqual({
        title: 'A History of the English speaking peoples',
      });
      expect(cacheEntryTuple1[1]).toBeTypeOf('object');

      expect(cacheEntryTuple2?.length).toEqual(3);
      expect(cacheEntryTuple2[0]).toEqual('book:2');
      expect(cacheEntryTuple2[0]).toBeTypeOf('string');
      expect(cacheEntryTuple2[1]).toEqual({
        title: 'Marlborough: his life and times',
      });
      expect(cacheEntryTuple2[1]).toBeTypeOf('object');

      // TODO verify cache entry state
    });

    it('test cache.load w/o serializer throws error when values are not structured clonable', async () => {
      let cache = buildCache();

      void expect(async () => {
        await cache.load([['book:1', function () {}]]);
      }).rejects.toThrow(
        'The cache value is not structured clonable use `save` with serializer'
      );
    });

    it('test cache.clear (load, get, clear, get)', async function () {
      let cache = buildCache();

      await cache.load([
        ['book:1', { title: 'A History of the English speaking peoples' }],
        ['book:2', { title: 'Marlborough: his life and times' }],
      ]);

      expect(await cache.get('book:1')).toEqual({
        title: 'A History of the English speaking peoples',
      });
      expect(await cache.get('book:2')).toEqual({
        title: 'Marlborough: his life and times',
      });

      await cache.clear();

      expect(await cache.get('book:1')).toEqual(undefined);
      expect(await cache.get('book:2')).toEqual(undefined);
    });

    // TODO: test clear (load, get, clear, get)
    // TODO: test save (with values, save then clear, then load, values should be restored)

    // transaction testing ----------------
    // TODO: test transactions

    // memory testing -------------------
    // TODO: test lru (unit test lru)
    // TODO: test ttl?

    // TODO: --expose-gc + setTimeout global.gc() + another setTimeout() + assert weakly held things are cleaned up

    // TODO: requires fixing up types &c. but otherwise illustrates how a user
    // could have a very simple cache that differentiated between types
    //
    // it('enables custom user retention -- retention-by-type', function() {
    //   async function awaitAll(itr: AsyncIterableIterator<unknown>) {
    //     let result = []
    //     for await (let item of itr) {
    //       result.push(item);
    //     }

    //     return result;
    //   }

    //   type CachedTypes = 'book' | 'author';
    //   let typeCacheMap = new Map<CachedTypes, unknown>([
    //     'book', null,
    //     'author', null,
    //   ]);

    //   function typeBasedLRU(tx) {
    //     for (let [key, value] of tx.entries()) {
    //       let match = /(book|author):/i.exec(key);
    //       if (match) {
    //         // TODO: assert match[1] is a CachedTypes
    //         typeCacheMap.set(match[1], value);
    //       }
    //     }
    //   }

    //   let cache = buildCache({
    //     hooks: {
    //       commit: typeBasedLRU
    //     }
    //   });

    //   let tx = cache.beginTransaction();
    //   tx.set('book:1', { title: 'Marlborough: His Life and Times Volume I' });
    //   tx.set('book:2', { title: 'Marlborough: His Life and Times Volume II' });
    //   tx.set('author:1', { name: 'Winston Churchill' });
    //   tx.set('character:1', { name: 'John Churchill' });
    //   await tx.commit();

    //   expect([...typeCacheMap.values()]).toMatchInlineSnapshot([{
    //     title: 'Marlborough: His Life and Times Volume II'
    //   }, {
    //     name: 'Winston Churchill'
    //   }]);

    //   expect(awaitAll(cache.values())).toMatchInlineSnapshot([{
    //     title: 'Marlborough: His Life and Times Volume I'
    //   }, {
    //     title: 'Marlborough: His Life and Times Volume II'
    //   }, {
    //     name: 'Winston Churchill'
    //   }, {
    //     name: 'John Churchill'
    //   }]);
    //   // TODO: gc?
    //   expect(awaitAll(cache.values())).toMatchInlineSnapshot([{
    //     title: 'Marlborough: His Life and Times Volume II'
    //   }, {
    //     name: 'Winston Churchill'
    //   }]);
    // });
  });

  describe('with a user registry', function () {
    // let cache = buildCache<UserRegistry>()
    // see https:/tsplay.dev/NrnDlN
    // TODO: try to test the types with expect-type
    it('can be built', function () {});
  });

  describe('with a user registry and user extension data', function () {
    it('can be built', function () {});
  });

  describe('test live transactions', function () {
    it('test single transaction with commit', async function () {
      let cache = buildCache();

      await cache.load([
        [
          'book:1',
          { 'book:1': { title: 'A History of the English speaking peoples' } },
        ],
        ['book:2', { 'book:2': { title: 'Marlborough: his life and times' } }],
      ]);

      // transaction 1 starts
      let tx = await cache.beginTransaction();

      await tx.merge('book:3', {
        entity: { 'book:3': { title: 'New Merged book' } },
        revision: 1,
      });
      await tx.merge('book:1', {
        entity: { 'book:1': { title: 'Conflict', sub: 'j3' } },
        revision: 1,
      });

      // Validate Transactional entries
      expect(tx.get('book:1')).toEqual({
        'book:1': { title: 'Conflict', sub: 'j3' },
      });
      expect(tx.get('book:2')).toEqual({
        'book:2': { title: 'Marlborough: his life and times' },
      });
      expect(tx.get('book:3')).toEqual({
        'book:3': { title: 'New Merged book' },
      });

      // Validate Cache before commit
      expect(await cache.get('book:1')).toEqual({
        'book:1': { title: 'A History of the English speaking peoples' },
      });
      expect(await cache.get('book:2')).toEqual({
        'book:2': { title: 'Marlborough: his life and times' },
      });
      expect(await cache.get('book:3')).toEqual(undefined);

      const cacheEntriesBeforeCommit = await cache.save();
      expect(cacheEntriesBeforeCommit.length).toEqual(2);

      await tx.commit();

      // Validate Cache after commit
      expect(await cache.get('book:1')).toEqual({
        'book:1': { title: 'Conflict', sub: 'j3' },
      });
      expect(await cache.get('book:2')).toEqual({
        'book:2': { title: 'Marlborough: his life and times' },
      });
      expect(await cache.get('book:3')).toEqual({
        'book:3': { title: 'New Merged book' },
      });
    });

    it('test single transaction with commit & rollback', async function () {
      let cache = buildCache();

      await cache.load([
        [
          'book:1',
          { 'book:1': { title: 'A History of the English speaking peoples' } },
        ],
        ['book:2', { 'book:2': { title: 'Marlborough: his life and times' } }],
      ]);

      // transaction 1 starts
      let tx = await cache.beginTransaction();

      await tx.merge('book:3', {
        entity: { 'book:3': { title: 'New Merged book' } },
        revision: 1,
      });
      await tx.merge('book:1', {
        entity: { 'book:1': { title: 'Conflict', sub: 'j3' } },
        revision: 1,
      });

      // Validate Transactional entries
      expect(tx.get('book:1')).toEqual({
        'book:1': { title: 'Conflict', sub: 'j3' },
      });
      expect(tx.get('book:2')).toEqual({
        'book:2': { title: 'Marlborough: his life and times' },
      });
      expect(tx.get('book:3')).toEqual({
        'book:3': { title: 'New Merged book' },
      });

      // Validate Cache before commit
      expect(await cache.get('book:1')).toEqual({
        'book:1': { title: 'A History of the English speaking peoples' },
      });
      expect(await cache.get('book:2')).toEqual({
        'book:2': { title: 'Marlborough: his life and times' },
      });
      expect(await cache.get('book:3')).toEqual(undefined);

      const cacheEntriesBeforeCommit = await cache.save();
      expect(cacheEntriesBeforeCommit.length).toEqual(2);

      await tx.commit();

      // Validate Cache after commit
      expect(await cache.get('book:1')).toEqual({
        'book:1': { title: 'Conflict', sub: 'j3' },
      });
      expect(await cache.get('book:2')).toEqual({
        'book:2': { title: 'Marlborough: his life and times' },
      });
      expect(await cache.get('book:3')).toEqual({
        'book:3': { title: 'New Merged book' },
      });

      await tx.rollback();

      expect(await cache.get('book:1')).toEqual({
        'book:1': { title: 'A History of the English speaking peoples' },
      });
      expect(await cache.get('book:2')).toEqual({
        'book:2': { title: 'Marlborough: his life and times' },
      });
      expect(await cache.get('book:3')).toEqual(undefined);
    });

    it('test cache with multiple transaction commits is masked from trasaction changes', async function () {
      let cache = buildCache();

      await cache.load([
        [
          'book:1',
          { 'book:1': { title: 'A History of the English speaking peoples' } },
        ],
        ['book:2', { 'book:2': { title: 'Marlborough: his life and times' } }],
      ]);

      // transaction 1 starts
      let tx1 = await cache.beginTransaction();

      // transaction 2 starts
      let tx2 = await cache.beginTransaction();

      // Merge entities from transaction 1
      await tx1.merge('book:3', {
        entity: { 'book:3': { title: 'New Merged book TX1' } },
        revision: 1,
      });
      await tx1.merge('book:1', {
        entity: { 'book:1': { title: 'original book Conflict', sub: 'j3' } },
        revision: 1,
      });

      // Merge entities from transaction 2
      await tx2.merge('book:3', {
        entity: { 'book:3': { title: 'New Merged book by TX2' } },
        revision: 1,
      });
      await tx2.merge('book:1', {
        entity: {
          'book:1': {
            title: 'Conflict updated by TX2',
            sub: 'j32',
            sub2: '12',
          },
        },
        revision: 1,
      });
      await tx2.merge('book:4', {
        entity: { 'book:4': { title: 'new book 4', sub: 'j32', sub2: '12' } },
        revision: 1,
      });

      // Validate entries in Transaction 1
      expect(tx1.get('book:1')).toEqual({
        'book:1': { title: 'original book Conflict', sub: 'j3' },
      });
      expect(tx1.get('book:2')).toEqual({
        'book:2': { title: 'Marlborough: his life and times' },
      });
      expect(tx1.get('book:3')).toEqual({
        'book:3': { title: 'New Merged book TX1' },
      });

      // Validate entries in Transaction 2
      expect(tx2.get('book:1')).toEqual({
        'book:1': { title: 'Conflict updated by TX2', sub: 'j32', sub2: '12' },
      });
      expect(tx2.get('book:2')).toEqual({
        'book:2': { title: 'Marlborough: his life and times' },
      });
      expect(tx2.get('book:3')).toEqual({
        'book:3': { title: 'New Merged book by TX2' },
      });
      expect(tx2.get('book:4')).toEqual({
        'book:4': { title: 'new book 4', sub: 'j32', sub2: '12' },
      });

      // Validate entries in original Cache
      expect(await cache.get('book:1')).toEqual({
        'book:1': { title: 'A History of the English speaking peoples' },
      });
      expect(await cache.get('book:2')).toEqual({
        'book:2': { title: 'Marlborough: his life and times' },
      });
      expect(await cache.get('book:3')).toEqual(undefined);

      // commit transaction 1
      await tx1.commit();

      // Validate entries in original Cache after 1st commit
      expect(await cache.get('book:1')).toEqual({
        'book:1': { title: 'original book Conflict', sub: 'j3' },
      });
      expect(await cache.get('book:2')).toEqual({
        'book:2': { title: 'Marlborough: his life and times' },
      });
      expect(await cache.get('book:3')).toEqual({
        'book:3': { title: 'New Merged book TX1' },
      });
      expect(await cache.get('book:4')).toEqual(undefined);

      // Validate entries in Transaction 2 Cache after 1st transaction commit and it remains masked
      expect(tx2.get('book:1')).toEqual({
        'book:1': { title: 'Conflict updated by TX2', sub: 'j32', sub2: '12' },
      });
      expect(tx2.get('book:2')).toEqual({
        'book:2': { title: 'Marlborough: his life and times' },
      });
      expect(tx2.get('book:3')).toEqual({
        'book:3': { title: 'New Merged book by TX2' },
      });
      expect(tx2.get('book:4')).toEqual({
        'book:4': { title: 'new book 4', sub: 'j32', sub2: '12' },
      });

      // commit transaction 1
      await tx2.commit();

      // Validate entries in original Cache after 2nd commit
      expect(await cache.get('book:1')).toEqual({
        'book:1': { title: 'Conflict updated by TX2', sub: 'j32', sub2: '12' },
      });
      expect(await cache.get('book:2')).toEqual({
        'book:2': { title: 'Marlborough: his life and times' },
      });
      expect(await cache.get('book:3')).toEqual({
        'book:3': { title: 'New Merged book by TX2' },
      });
      expect(await cache.get('book:4')).toEqual({
        'book:4': { title: 'new book 4', sub: 'j32', sub2: '12' },
      });
    });

    it('test local entries', async function () {
      let cache = buildCache();

      await cache.load([
        [
          'book:1',
          { 'book:1': { title: 'A History of the English speaking peoples' } },
        ],
        ['book:2', { 'book:2': { title: 'Marlborough: his life and times' } }],
      ]);

      let tx = await cache.beginTransaction();

      await tx.merge('book:3', {
        entity: { 'book:3': { title: 'New Merged book' } },
        revision: 1,
      });
      await tx.merge('book:1', {
        entity: { 'book:1': { title: 'Conflict', sub: 'j3' } },
        revision: 1,
      });
      const localEntries = [];

      for await (const [key, value, state] of tx.localEntries()) {
        localEntries.push([key, value, state]);
      }

      expect(localEntries[0][1]).toEqual({
        'book:3': { title: 'New Merged book' },
      });
      expect(localEntries[1][1]).toEqual({
        'book:1': { title: 'Conflict', sub: 'j3' },
      });
    });

    it('test merging entities with array values', async function () {
      let cache = buildCache();

      await cache.load([
        [
          'book:1',
          {
            'book:1': {
              title: 'A History of the English speaking peoples',
              subjects: [{ a: 1 }],
            },
          },
        ],
        ['book:2', { 'book:2': { title: 'Marlborough: his life and times' } }],
      ]);

      // transaction 1 starts
      let tx = await cache.beginTransaction();

      await tx.merge('book:3', {
        entity: { 'book:3': { title: 'New Merged book' } },
        revision: 1,
      });
      await tx.merge('book:1', {
        entity: {
          'book:1': {
            title: 'Conflict',
            sub: 'j3',
            subjects: [{ a: 1 }, { b: 2 }],
          },
        },
        revision: 1,
      });

      // Validate Transactional entries
      expect(tx.get('book:1')).toEqual({
        'book:1': {
          title: 'Conflict',
          sub: 'j3',
          subjects: [{ a: 1 }, { b: 2 }],
        },
      });
      expect(tx.get('book:2')).toEqual({
        'book:2': { title: 'Marlborough: his life and times' },
      });
      expect(tx.get('book:3')).toEqual({
        'book:3': { title: 'New Merged book' },
      });

      // Validate Cache before commit
      expect(await cache.get('book:1')).toEqual({
        'book:1': {
          title: 'A History of the English speaking peoples',
          subjects: [{ a: 1 }],
        },
      });
      expect(await cache.get('book:2')).toEqual({
        'book:2': { title: 'Marlborough: his life and times' },
      });
      expect(await cache.get('book:3')).toEqual(undefined);

      const cacheEntriesBeforeCommit = await cache.save();
      expect(cacheEntriesBeforeCommit.length).toEqual(2);

      await tx.commit();

      // Validate Cache after commit
      expect(await cache.get('book:1')).toEqual({
        'book:1': {
          title: 'Conflict',
          sub: 'j3',
          subjects: [{ a: 1 }, { b: 2 }],
        },
      });
      expect(await cache.get('book:2')).toEqual({
        'book:2': { title: 'Marlborough: his life and times' },
      });
      expect(await cache.get('book:3')).toEqual({
        'book:3': { title: 'New Merged book' },
      });
    });

    it('test delete', async function () {
      let cache = buildCache();

      await cache.load([
        [
          'book:1',
          {
            'book:1': {
              title: 'A History of the English speaking peoples',
              subjects: [{ a: 1 }],
            },
          },
        ],
        ['book:2', { 'book:2': { title: 'Marlborough: his life and times' } }],
      ]);

      // transaction 1 starts
      let tx = await cache.beginTransaction();

      await tx.merge('book:3', {
        entity: { 'book:3': { title: 'New Merged book' } },
        revision: 1,
      });

      await tx.delete('book:1');

      expect(tx.get('book:2')).toEqual({
        'book:2': { title: 'Marlborough: his life and times' },
      });
      expect(tx.get('book:1')).toEqual(undefined);
    });
  });

  describe('test revision strategy', function () {
    it('test entry revisions are merged correctly', async function () {
      let cache = buildCache();

      await cache.load([
        [
          'book:1',
          { 'book:1': { title: 'A History of the English speaking peoples' } },
        ],
      ]);

      let tx = await cache.beginTransaction();

      await tx.merge('book:1', {
        entity: { 'book:1': { title: 'Conflict', sub: 'j3' } },
        revision: 2,
      });

      await tx.commit();

      const entryRevisions = cache.entryRevisions('book:1');
      const revisions = [];
      for await (const entry of entryRevisions) {
        revisions.push(entry);
      }

      expect(revisions.length).toEqual(3);
      expect(
        revisions.includes({
          entity: {
            'book:1': { title: 'A History of the English speaking peoples' },
          },
          revision: 1,
        })
      );
      expect(
        revisions.includes({
          entity: { 'book:1': { title: 'Conflict', sub: 'j3' } },
          revision: 2,
        })
      );
      expect(
        revisions.includes({
          entity: { 'book:1': { title: 'Conflict', sub: 'j3' } },
          revision: 3,
        })
      );
    });
  });

  describe('test LRU', function () {
    it('test LRU policy', async function () {
      let cache = buildCache({ expiration: { lru: 4, ttl: 5000 } });

      await cache.load([
        ['book:1', { 'book:1': { title: 'A History1' } }],
        ['book:2', { 'book:2': { title: 'A History2' } }],
        ['book:3', { 'book:3': { title: 'A History3' } }],
        ['book:4', { 'book:4': { title: 'A History4' } }],
      ]);

      let tx = await cache.beginTransaction();

      tx.set('book:5', { 'book:5': { title: 'A History5_lru' } });
      tx.get('book:3');
      await tx.merge('book:4', {
        entity: { 'book:4': { title: 'A History4_lru' } },
        revision: 2,
      });
      await tx.merge('book:1', {
        entity: { 'book:1': { title: 'A History1_lru' } },
        revision: 1,
      });

      await tx.commit();

      const cacheEntries = await cache.save();

      const lru = cacheEntries.filter((entry) => {
        const entryState = entry[2] as { retained: { lru: true | false } };
        if (entry[2]) {
          return entryState.retained?.lru === true;
        }
      });

      expect(lru[0][0]).toEqual('book:1');
      expect(lru[1][0]).toEqual('book:4');
      expect(lru[2][0]).toEqual('book:5');
    });
  });
});
