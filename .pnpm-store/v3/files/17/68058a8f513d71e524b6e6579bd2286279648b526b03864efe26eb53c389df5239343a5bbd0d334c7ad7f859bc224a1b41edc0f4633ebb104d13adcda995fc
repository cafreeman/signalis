# @data-eden/cache

## Principles

- **Configurable**: Configuration to allow for application wide default
  settings as well as per-query settings (e.g. handling non-standard API
  endpoints, opting out of [cached entity](#definitions) merging per query).
- **Extensible & Layered**: Supplies extension points allowing custom caching
  implementations (e.g. persistent caching via IndexDB). Users are _not_ limited to
  out of the box caching configurations.
- **Zero Config**: Works with sensible default settings "out of the box" with
  minimal user setup.
- **Independent**: Caching system is not "aware" of GraphQL semantics or the
  specifics of how data is loaded (e.g. `fetch` layer, websockets, etc).
- **Ergonomic Invalidation**: Cache invalidation is notoriously difficult. This
  system attempts to make invalidation as easy as possible. APIs are designed
  up front to enable the cache to absorb the complexities of invalidation (and
  _not_ force that complexity onto the user).
- **Debuggable**: Exposes the ability to debug caching details. Understanding
  the sources of the _contents_ of the cache (e.g. [entities](#definitions) being merged as a
  result of multiple queries) or the reason specific entities are being
  retained due to caching configuration should not require deep understanding
  of the cache internals.
- **Consistent**: A specific [cached entities](#definitions) Identical cached entities loaded across multiple queries are
  updated "live". Extension points exist to trigger rerendering for various
  frameworks (e.g. Ember, Glimmer, React, etc).

## Features

- All cache layer APIs must be async
- Can be extended and composed (e.g. an application could implement persistent caching _on top_ of our default caching system without having to re-implement [entity](#definitions) merging)
- Supports layered caching
- Supports merging [cached entities](#definitions)
  - enable/disable per-request
  - customizable merging strategies
  - ID field is configurable by app and by query
- Supports intelligent merging (implementable in application / infra)
- retain as much information as is feasible about the sources of data (likely more information available in development than in production, but _some_ information should still be included in production)
- in development/test mode: can identify each of the responses that are merged into a given [entity](#definitions) (including as much information about where those requests actually come from)
  - provides that information to an application level configurable "[entity](#definitions) merging hook"
  - can be used to aide debugging
- [Cached entities](#definitions) and queries can be unloaded in a configurable way with resonable defaults Support caching expiration via multiple mechanisms:
  - time based (e.g. entities are released after a specific amount of time)
  - least recently used (e.g. hold on to at least X entities)
  - ....???
- Expose low-level API to expire cache entries
- Expose low-level API for manual cache eviction
- Exposes public API's to access cache contents for debugging
  - should this be development mode only??
- Exposes API for exporting the full cache contents

## Features

- **Zero-Cost Debugging** Powerful debugging and introspection utilities, discoverable through `cache.$debug` that are stripped in production builds, but are lazily loadable.

## API

```typescript
// Primary "user-land" API for creating a new cache instance
type DefaultRegistry = Record<string, unknown>;
export function buildCache<CacheKeyRegistry = DefaultRegistry, $Debug=unknown, UserExtensionData=unknown>(options?: CacheOptions<CacheKeyRegistry, $Debug, UserExtensionData>): Cache<CacheKeyRegistry, $Debug, UserExtensionData>;

type CacheEntry<CacheKeyRegistry, UserExtensionData=unknown> = [key: Key extends keyof CacheKeyRegistry, value: CacheKeyRegistry[Key], CacheEntryState<UserExtensionData>];

export interface CacheEntrySerializer<CacheKeyRegistry, Key extends keyof CacheKeyRegistry, SerializedValue = unknown> {
  serialize(cacheEntry: CacheEntry<CacheKeyRegistry>): [Key, SerializedValue, CacheEntryState<UserExtensionData>];
  deserialize(cacheEntry: [Key, SerializedValue, CacheEntryState<UserExtensionData>]): CacheEntry<CacheKeyRegistry>;
}

export interface Cache<
  CacheKeyRegistry extends DefaultRegistry,
  Key extends keyof CacheKeyRegistry,
  $Debug = unknown,
  UserExtensionData = unknown
  > {
  beginTransaction(): CacheTransaction<CacheKeyRegistry, $Debug, UserExtensionData>;

  async get(cacheKey: Key): CacheKeyRegistry[Key] | undefined;

  /**
    Generator function that yields each of the cache entries. Note that this
    will include both strongly held (unexpired entries) as well as weakly held
    entries.
  */
  [Symbol.asyncIterator](): AsyncIterableIterator<[Key, CacheKeyRegistry[Key], CacheEntryState<UserExtensionData>]>

  /**
    Generator function that yields each of the cache entries. Note that this
    will include both strongly held (unexpired entries) as well as weakly held
    entries.
  */
  entries(): AsyncIterableIterator<[Key, CacheKeyRegistry[Key], CacheEntryState<UserExtensionData>]>
  entryRevisions(cacheKey: Key):  AsyncIterableIterator<[entity: CacheKeyRegistry[Key], revision: number][]>;
  keys(): AsyncIterableIterator<Key>
  values(): AsyncIterableIterator<CacheKeyRegistry[Key]>

  /**
    Calling `.save()` without a serializer will iterate over the cache entries
    and return an array of cache entry tuples. The values contained within the
    tuples are copied via `structuredClone`.

    If your cache entries are not structured clonable, (e.g. a function)
    `.save()` will throw an error. In this case, use the alternate form of
    `.save` passing in a `CacheEntrySerializer`.

    @see <https://developer.mozilla.org/en-US/docs/Web/API/structuredClone>
  */
  async save(): [Key, CacheKeyRegistry[Key], CacheEntryState<UserExtensionData>][];

  /**
    Calling `.save()` passing a `CacheEntrySerializer` will iterate over the
    cache entries and pass each cache entry tuple in to the `serializer.serialize()`
    function. The `serializer.serialize()` method is expected to return a
    serialized cache entry tuple that its `serializer.deserialize()` can
    interprete back into a cache entry tuple.

    This is mainly intended to allow cache values that are not structured
    clonable to be saved/loaded. If all of your cached values are structured
    clonable (e.g. simple POJOs, strings, numbers, booleans, etc) you do not
    need to pass a `CacheEntrySerializer` and you can call `.save()` (without
    arguments).
  */
  async save(serializer: CacheEntrySerializer): ReturnType<CacheEntrySerializer>[];

  /**
    Calling `.load()` will add all entries passed to the cache.

    Note: `.load()` does not clear pre-existing entries, if you need to clear
    entries before loading call `.clear()`.
  */
  async load<Key extends keyof CacheKeyRegistry>(entries: CacheEntry<CacheKeyRegistry, Key, UserExtensionData>[]): void;
  // TODO: needs entries
  async load<Key extends keyof CacheKeyRegistry>(serializer: CacheEntrySerializer): ReturnType<CacheEntrySerializer>[];

  /**
    Evict all entries from the cache.
  */
  clear(): void;

  readonly get options(): CacheOptions<CacheKeyRegistry, $Debug, UserExtensionData>;

  $debug: $Debug & CacheDebugAPIs;
}

export interface CacheOptions<CacheKeyRegistry=DefaultRegistry,$Debug=unknown, UserExtensionData=unknown> {
  hooks: {
    /**
    An optional callback that is invoked just before a transaction is committed.

    This does not allow users to mutate the transaction, but it is a hook where
    custom retention policies can be implemented.

    The default retention policies are all implementable in userland as commit hooks.
    */
    commit?: (tx: CacheTransaction<CacheKeyRegistry, $Debug, UserExtensionData>) => void;
    /**
    An optional hook for merging new versions of an entity into the cache. This
    hook specifies the default behaviour for the cache -- a different merge
    strategy can be passed in per call to `LiveCacheTransaction.merge`

    The hook returns the updated merged entry -- it may not mutate any of its arguments.

    If unspecified, the default merge strategy is to deeply merge objects.
    */
    entitymergeStrategy?: EntityMergeStrategy<CacheKeyRegistry, $Debug, UserExtensionData>;
    /**
    An optional hook for merging the list of revisions for a cache entry.

    If unspecified, the default retention strategy is to keep the full history
    of an entry as long as it's in the cache, evicting revisions only when the
    value itself is evicted.
    */
    revisionMergeStrategy?: RevisionMergeStrategy;
  }
  expiration?: ExpirationPolicy;
  $debug?: $Debug;
}

type ExpirationPolicy = false | {
  lru: number;
  ttl: number;
}

export interface EntityMergeStrategy<
  CacheKeyRegistry,
  Key extends keyof CacheKeyRegistry,
  $Debug = unknown,
  UserExtensionData = unknown
> {
  (cacheKey: Key, newEntityRevision: CachedEntityRevision<CacheKeyRegistry[Key]>, current: CacheKeyRegistry[Key] | undefined, tx: CacheTransaction<CacheKeyRegistry, $Debug, UserExtensionData>): CacheKeyValue;
}

export interface RevisionMergeStrategy<
  CacheKeyRegistry,
  Key extends keyof CacheKeyRegistry,
  $Debug = unknown,
  UserExtensionData = unknown
> {
  (cacheKey: Key, tx: CommittingTransaction<CacheKeyRegistry, $Debug, UserExtensionData>): void;
}

export interface CacheEntryState<UserExtensionData=unknown> {
  retained: {
    lru: boolean;
    ttl: number;
  };
  /**
  The last time this cache entry was accessed, either via `get`, `set`, or
  `merge`.

  Mainly useful for userland retention policies.
  */
  lastAccessed: number;
  extensions: UserExtensionData;
}

export interface CacheDebugAPIs {
  size(): void;
  entries(): void;
  history(): void;
}
export interface CacheTransactionDebugAPIs {
  size(): void;
  entries(): void;
}

interface CachedEntityRevision<CacheKeyValue> {
  entity: CacheKeyValue;
  revision: number;
}

export interface CacheTransaction<
  CacheKeyRegistry,
  Key extends keyof CacheKeyRegistry,
  $Debug = unknown,
  UserExtensionData = unknown
> {
  /**
  Get the value of `cacheKey` in the cache.  If `key` has been modified in this
  transaction (e.g. via `merge` or `set`), `tx.get` will return the updated
  entry in this transaction. The return value can therefore differ from
  `cache.get`.
  */
  async get(cacheKey: Key): CacheKeyRegistry[Key] | undefined;
  localEntries(): AsyncIterableIterator<[Key, CacheKeyRegistry[Key], CacheEntryState]>
  entries(): AsyncIterableIterator<[Key, CacheKeyRegistry[Key], CacheEntryState]>
  /**
    Generator function that yields each of the transaction local entries.
  */
  [Symbol.asyncIterator](): AsyncIterableIterator<[Key, CacheKeyRegistry[Key], CacheEntryState<UserExtensionData>]>
  /**
  An async generator that produces the revisions of `key` within this transaction.
  */
  localRevisions(cacheKey: Key):  AsyncIterableIterator<CachedEntityRevision<CacheKeyRegistry[Key]>>;
  /**
  An async generator that produces the complete list of revisions for `key`,
  from the time the transaction began and including the revisions added in this
  transaction.
  */
  entryRevisions(cacheKey: Key):  AsyncIterableIterator<CachedEntityRevision<CacheKeyRegistry[Key]>>;

  $debug: $Debug & CacheTransactionDebugAPIs;
}
export interface CommittingTransaction<
  CacheKeyRegistry,
  Key extends keyof CacheKeyRegistry,
  $Debug = unknown,
  UserExtensionData = unknown
> extends CacheTransaction<CacheKeyRegistry, $Debug, UserExtensionData> {
  cache: {
    clearRevisions(id: Key): void;
    appendRevisions(id: Key, revisions: CachedEntityRevision<CacheKeyRegistry[Key]>[]): void;
  }
}
export interface LiveCacheTransaction<
  CacheKeyRegistry,
  Key extends keyof CacheKeyRegistry,
  $Debug = unknown,
  UserExtensionData = unknown
> extends CacheTransaction<CacheKeyRegistry, $Debug, UserExtensionData> {

  //       let mergedEntity = await tx.merge(id, entity, { revision, entityMergeStrategy, revisionMergeStrategy, $debug: { rawDocument } });

  async merge(cacheKey: Key, value: CachedEntityRevision<CacheKeyRegistry[Key]>, options?: {
    entityMergeStrategy: EntityMergeStrategy<CacheKeyRegistry, $Debug, UserExtensionData>;
    revisionMergeStrategy: RevisionMergeStrategy<CacheKeyRegistry, $Debug, UserExtensionData>;
    $debug: $Debug;
  }): Promise<CacheKeyRegistry[Key]>;
  async set(cacheKey: Key, value: CacheKeyRegistry[Key]): Promise<CacheKeyRegistry[Key]>;
  async delete(cacheKey: Key): Promise<boolean>;

  /**

  Updates the cache values.

    * Entities with an updated value (either from merging or setting) are
      updated in the cache (i.e. calling cache.get(key) will return the values
      set in the transation)
    * Entities deleted from the transaction are deleted from the cache.

  Updates the cache revisions.
    * The retention merge strategy is called for each entity with new
      revisions. It is called with a CommittingTransaction and has the
      opportunity to update the saved revisions for an entity.


  **Transaction Conflicts**

  During a transaction, merges occurred between new revisions of an entity and
  the revision in the cache at the time the transaction began. If a separate
  transaction has committed since then, these merges may be out of date. When
  this happens, `mergeStrategy` will be called again during `commit` to resolve
  these merge conflicts.

  **Transaction Timeout**

  `commit` is atomic -- when it is called it will attempt to acquire the write
  lock for the cache. After `timeout` milliseconds the promise will reject if
  it has not yet acquired the lock.

  If `timeout` is `false` then commit will immediately rejectd if it cannot
  acquire the write lock.

  */
  async commit(options?: {
    timeout: number | false = false;
  }): Promise<void>;

  /**
  Abandon this transaction and discard any changes or other transaction state.
  */
  rollback(): void;
}

export function defaultMergeStrategy(): MergeStrategy;
```

## Examples

// TODO: re-write as a tutorial + example
// TODO: explain how to do type-aware cache registry; see https://tsplay.dev/NrnDlN

```javascript
// query 1
let query1 = {
  data: {
    bookstore: {
      id: 'urn:bookstore:1',
      books: [
        {
          metadata: 'urn:author:1',
          // soldInBookstores: ['urn:li:bookstore:1']
          soldInBookstores: [
            {
              id: 'urn:bookstore:1',
              city: 'London',
            },
          ],
          // author: 'urn:author:1',
          author: {
            id: 'urn:author:1',
            name: 'JK Rowling',
          },
        },
      ],
      topSellingAuthor: {
        id: 'urn:author:1',
        name: 'JK Rowling',
      },
    },
  },
};

// query 2
let query2 = {
  data: {
    author: {
      id: 'urn:author:1',
      name: 'Winston Churchill',
    },
  },
};

let doc1 = executeQuery(query1);
let bookAuthor = doc1.data.bookstore.books[0].author;
let topSellingAuthor = doc1.data.bookstore.topSellingAuthor;

expect(bookAuthor).toBe(topSellingAuthor);
expect(bookAuthor.name).toEqual('JK Rowling');

let doc2 = executeQuery(query2);
let author = doc2.data.author;

expect(author).toBe(bookAuthor);
expect(bookAuthor.name).toEqual('Winston Churchill');
expect(doc2.data.author).toBe(doc1.data.topSellingAuthor);
```

```typescript
let cache = buildCache();

type CachedEntities = any;

let DocumentEntityMap = new WeakMap();
let DocumentProxyMap = new WeakMap();
let globalRevisionCounter = 0;


async function handleGraphQLResponse(
  requestUrl: string,
  responseBody: object,
  parseEntities: (document) => TimestampedEntity[]
  entityId: (entity: object) => string,
  queryMetaData: QueryMetaData,
  options: OperationOptions,
) {
  let documentKey = requestUrl;
  let document = responseBody;
  let rawDocument;
  /*
  Trampoline debugging -- the then block here is transformed into a no-op
  function that is replaced by the real function lazily when debugging is
  loaded.
  */
  if(hasDebug()) {
    // Exact implementation TBD
    // maybe Response.clone().json()
    // maybe JSON.parse(JSON.stringify)
    // maybe rawDocument = awit response.text(); document = JSON.parse(rawDocument);
    rawDocument = deepCopy(document);
  }

  let defaultRevision = ++globalRevisionCounter;
  let tx = cache.beginTransaction();
  let txSucceeded = false;
  try {
    let cachedEntities = [];
    // parseEntities yields in post-order depth-first-search i.e. children before parents
    for(let { entity, parent, prop, revision: entityRevision } of await parseEntities(document, queryMetaData)) {
      let id = entityId(entity);
      let revision = entityRevision ?? defaultRevision;
      let { entityMergeStrategy, revisionMergeStrategy } = options;

      // merges with pre-existing entities (along with debugging data) and
      // returns the merged result
      let mergedEntity = await tx.merge(id, entity, { revision, entityMergeStrategy, revisionMergeStrategy, $debug: { rawDocument } });
      // For example, parent === book, prop === 'author'
      // Because all userland calls go through Graphql operations, we have
      // the metadata necessary to differentiate strings from references
      parent[prop] = id;
      cachedEntities.push(mergedEntity);
    }
    DocumentEntityMap.set(document, cachedEntities);
    // Proxy exists to do at least the following:
    //  1. access referenced cached entities and
    //  2. field mask them
    let documentProxy = new DocumentProxy(document, queryMetaData, { $debug: { rawDocument } });
    DocumentProxyMap.set(document, documentProxy);

    await tx.set(documentKey, document);
    await tx.commit();
    txSucceeded = true;

    return documentProxy;
  } finally {
    if(!txSucceeded) {
      tx.rollback();
    }
  }
}


// Popopulating transaction ids
// entityUrn_a ... timestamp1 transactionId1
// entityUrn_a ... timestamp2 transactionId2

const defaultMergeStrategy = deepMergeStrategy;
async function shallowMergeStrategy<CacheKeyRegistry>(id, { entity, revision }, current: CacheKeyValue | undefined, tx: CacheTransaction<CacheKeyRegistry>) {
  return Object.assign({}, current, entity);
}

async function deepMergeStrategy<CacheKeyRegistry>(id, { entity, revision }, current: CacheKeyValue | undefined, tx: CacheTransaction<CacheKeyRegistry>) {
  // ...
}

async function lastWriteWinsStrategy<CacheKeyRegistry>(id, { entity, revision }, current: CacheKeyValue | undefined, tx: CacheTransaction<CacheKeyRegistry>) {
  return entity;
}

async function lastWriteWinsTimestampStrategy<CacheKeyRegistry>(id, { entity, revision }, current?: CacheKeyValue, tx: CacheTransaction<CacheKeyRegistry>) {
  let revisionsGenerator = tx.entryRevisions(id);
  let priorRevision = await revisionsGenerator.next()?.value;

  if(priorRevision) {
    return revision > priorRevision.revision ? entity : priorRevision.entity;
  }

  return entity;
}

// how a user might merge differently by type
async function forkedMergeStrategy<CacheKeyRegistry>(id, newEntityRevision, current?: CacheKeyValue, tx: CacheTransaction<CacheKeyRegistry>) {
  let type = userLandParseType(id);
  switch(type) {
    case 'SomeType':
      // ...
      return deepMergeStrategy(id, newEntityRevision, current, cache);
    default:
      // ...
      return shallowMergeStrategy(id, newEntityRevision, current, cache);
  }
}

// example cache with custom merge
let cacheWithCustomMerge = buildCache({ hooks: { entityMergeStrategy: lastWriteWinsTimestampStrategy }});


async function take(generator, n) {
  if(n <= 0) {
    return [];
  }

  let i = 0;
  let result = [];
  for (let value of await generator) {
    result.push(value);
    if (++i == n) {
      return result;
    }
  }

  return result;
}

const defaultRetensionStrategy = retainAllRevisions;
async function retainNoRevisions(id, tx: CommittingTransaction<CacheKeyRegistry>) {
}
async function retainAllRevisions(id, tx: CommittingTransaction<CacheKeyRegistry>) {
  tx.cache.appendRevisions([...await tx.localRevisions(id)]);
}
async function retainLast5Revisions(id, tx: CommittingTransaction<CacheKeyRegistry>) {
  let lastFiveRevisions = await take(tx.entryRevisions(id), 5);

  tx.cache.clearRevisions(id);
  tx.cache.appendRevisions(lastFiveRevisions);
}

let cacheWithCustomRevisionRetention = buildCache({ hooks: { revisionMergeStrategy: retainLast5Revisions }});


// userland ttl
let ttlRetention = new Map(); // Map not WeakMap so entries retained
let cacheWithUserlandTTL = buildCache({ hooks: { commit: userTTL }});

const ttl = 5_000; // 5 seconds
async function userTTL(tx) {
  for (let [key, value] of tx.entries()) {
    ttlRetention.set(key, value);
    setTimeout(ttl, function() {
      ttlRetention.delete(key);
    });
  }
}
```

# Definitions

- **Cached Entity**: An object in the cache that is uniquely identifiable, and is kept consistent across cache operations via the cache's (configurable) merging strategy.
