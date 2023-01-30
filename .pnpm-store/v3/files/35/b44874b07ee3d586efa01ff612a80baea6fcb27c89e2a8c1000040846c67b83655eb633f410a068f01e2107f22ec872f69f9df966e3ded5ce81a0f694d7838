// eslint-disable-next-line
function structuredClone(x: any): any {
  try {
    return JSON.parse(JSON.stringify(x));
  } catch (error) {
    throw new Error(
      'The cache value is not structured clonable use `save` with serializer'
    );
  }
}

const DEFAULT_EXPIRATION = { lru: 1000, ttl: 60000 };

const DEFAULT_ENTRY_STATE = {
  retained: { lru: false, ttl: DEFAULT_EXPIRATION.ttl },
};

type DefaultRegistry = Record<string, object>;

export interface CacheDebugAPIs {
  size(): void;
  entries(): void;
  history(): void;
}
export interface CacheTransactionDebugAPIs {
  size(): void;
  entries(): void;
}

/**
  A 3-tuple of a cache entry that contains
  - *key*
  - *value*
  - *state* (optional)
*/
type CacheEntry<
  CacheKeyRegistry extends DefaultRegistry,
  Key extends keyof CacheKeyRegistry = keyof CacheKeyRegistry,
  UserExtensionData = unknown
> = [
  key: Key,
  value: CacheKeyRegistry[Key],
  state?: CacheEntryState<UserExtensionData>
];

/**
 * A entry state (retention,last accessed) of each cache entry
 */
export interface CacheEntryState<UserExtensionData = unknown> {
  retained: {
    lru: boolean;
    ttl: number;
  };
  /**
  The last time this cache entry was accessed, either via `get`, `set`, or
  `merge`.
  Mainly useful for userland retention policies.
  */
  lastAccessed?: number; // timestamp
  extensions?: UserExtensionData;
}

/**
 * LRU Cache
 */
export interface LruCache<
  CacheKeyRegistry extends DefaultRegistry,
  Key extends keyof CacheKeyRegistry = keyof CacheKeyRegistry
> {
  set(cacheKey: Key, value: CacheKeyRegistry[Key]): void;
}

class LruCacheImpl<
  CacheKeyRegistry extends DefaultRegistry,
  Key extends keyof CacheKeyRegistry
> implements LruCache<CacheKeyRegistry, Key>
{
  #max: number;
  #lruCache: Map<Key, CacheKeyRegistry[Key]>;

  constructor(maxCapacity: number) {
    this.#max = maxCapacity;
    this.#lruCache = new Map<Key, CacheKeyRegistry[Key]>();
  }

  set(cacheKey: Key, value: CacheKeyRegistry[Key]) {
    // refresh data
    if (this.#lruCache.has(cacheKey)) {
      this.#lruCache.delete(cacheKey);
    } else if (this.#lruCache.size === this.#max) {
      // find and evict the LRU entry
      const lruEntryKey = this.#lruCache.keys().next().value as Key;
      this.#lruCache.delete(lruEntryKey);
    }

    this.#lruCache.set(cacheKey, value);
  }

  getCache(): Map<Key, CacheKeyRegistry[Key]> {
    return this.#lruCache;
  }
}

type CacheKeyValue = Record<string, object | string | number> | string | number;

export interface EntityMergeStrategy<
  CacheKeyRegistry extends DefaultRegistry,
  Key extends keyof CacheKeyRegistry = keyof CacheKeyRegistry,
  $Debug = unknown,
  UserExtensionData = unknown
> {
  (
    cacheKey: Key,
    newEntityRevision: CachedEntityRevision<CacheKeyValue>,
    current: CacheKeyRegistry[Key] | undefined,
    tx: CacheTransaction<CacheKeyRegistry, Key, $Debug, UserExtensionData>
  ): CacheKeyValue;
}
export interface RevisionMergeStrategy<
  CacheKeyRegistry extends DefaultRegistry,
  Key extends keyof CacheKeyRegistry,
  $Debug = unknown,
  UserExtensionData = unknown
> {
  (
    cacheKey: Key,
    tx: CommittingTransactionImpl<
      CacheKeyRegistry,
      Key,
      $Debug,
      UserExtensionData
    >
  ): void;
}

interface CachedEntityRevision<CacheKeyValue> {
  entity: CacheKeyValue;
  revision: number;
  revisionContext?: string; // Use to store queryIds that can be used for debugging
}

type ExpirationPolicy =
  | false
  | {
      lru: number;
      ttl: number;
    };
export interface CacheOptions<
  CacheKeyRegistry extends DefaultRegistry,
  Key extends keyof CacheKeyRegistry,
  $Debug = unknown,
  UserExtensionData = unknown
> {
  hooks?: {
    /**
    An optional callback that is invoked just before a transaction is committed.
    This does not allow users to mutate the transaction, but it is a hook where
    custom retention policies can be implemented.
    The default retention policies are all implementable in userland as commit hooks.
    */
    commit?: (
      tx: CacheTransaction<CacheKeyRegistry, Key, $Debug, UserExtensionData>
    ) => void;

    /**
    An optional hook for merging new versions of an entity into the cache. This
    hook specifies the default behaviour for the cache -- a different merge
    strategy can be passed in per call to `LiveCacheTransaction.merge`
    The hook returns the updated merged entry -- it may not mutate any of its arguments.
    If unspecified, the default merge strategy is to deeply merge objects.
    */
    entitymergeStrategy?: EntityMergeStrategy<
      CacheKeyRegistry,
      Key,
      $Debug,
      UserExtensionData
    >;
    /**
    An optional hook for merging the list of revisions for a cache entry.
    If unspecified, the default retention strategy is to keep the full history
    of an entry as long as it's in the cache, evicting revisions only when the
    value itself is evicted.
    */
    revisionMergeStrategy?: RevisionMergeStrategy<
      CacheKeyRegistry,
      Key,
      $Debug,
      UserExtensionData
    >;
  };
  expiration?: ExpirationPolicy;
  $debug?: $Debug;
}

export interface Cache<
  CacheKeyRegistry extends DefaultRegistry,
  Key extends keyof CacheKeyRegistry,
  $Debug = unknown,
  UserExtensionData = unknown
> {
  /**
    Evict all entries from the cache.
  */
  clear(): Promise<void>;

  /**
    Restuns all cache options passed
  */
  getCacheOptions():
    | CacheOptions<CacheKeyRegistry, Key, $Debug, UserExtensionData>
    | undefined;

  /**
    Get Cache value based on cache key
  */
  get(cacheKey: Key): Promise<CacheKeyRegistry[Key] | undefined>;

  /**
    Calling `.save()` without a serializer will iterate over the cache entries
    and return an array of cache entry tuples. The values contained within the
    tuples are copied via `structuredClone`.
    If your cache entries are not structured clonable, (e.g. a function)
    `.save()` will throw an error. In this case, use the alternate form of
    `.save` passing in a `CacheEntrySerializer`.
    @see <https://developer.mozilla.org/en-US/docs/Web/API/structuredClone>
  */
  save(): Promise<
    [
      Key,
      CacheKeyRegistry[Key],
      CacheEntryState<UserExtensionData> | undefined
    ][]
  >;

  /**
    Calling `.load()` will add all entries passed to the cache.
    Note: `.load()` does not clear pre-existing entries, if you need to clear
    entries before loading call `.clear()`.
  */
  load(
    entries: CacheEntry<CacheKeyRegistry, Key, UserExtensionData>[]
  ): Promise<void>;

  [Symbol.asyncIterator](): AsyncIterableIterator<
    [Key, CacheKeyRegistry[Key], CacheEntryState<UserExtensionData>?]
  >;

  /**
    Generator function that yields each of the cache entries. Note that this
    will include both strongly held (unexpired entries) as well as weakly held
    entries.
  */
  entries(): AsyncIterableIterator<
    [Key, CacheKeyRegistry[Key], CacheEntryState<UserExtensionData>]
  >;

  /**
    Generator function that yields each of the cache entry revision
  */
  entryRevisions(
    cacheKey: Key
  ): AsyncIterableIterator<CachedEntityRevision<CacheKeyValue>>;

  /**
    Generator function that yields each of the cache entry keys
  */
  keys(): AsyncIterableIterator<Key>;

  /**
    Generator function that yields each of the cache entry values
  */
  values(): AsyncIterableIterator<CacheKeyRegistry[Key]>;

  /**
    Creates a live transaction instance
  */
  beginTransaction(): Promise<
    LiveCacheTransaction<CacheKeyRegistry, Key, $Debug, UserExtensionData>
  >;
}

export interface CacheTransaction<
  CacheKeyRegistry extends DefaultRegistry,
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
  get(cacheKey: Key): CacheKeyRegistry[Key] | CacheKeyValue | undefined;

  [Symbol.asyncIterator](
    entryMap: Map<Key, CacheKeyRegistry[Key]>
  ): AsyncIterableIterator<
    [Key, CacheKeyRegistry[Key], CacheEntryState<UserExtensionData>]
  >;

  /**
    Generator function that yields each of the transaction entries including local entries and entries before transaction began.
  */
  entries(): AsyncIterableIterator<
    [
      Key,
      CacheKeyRegistry[Key] | CacheKeyValue,
      CacheEntryState<UserExtensionData>
    ]
  >;

  /**
    Generator function that yields each of the transaction local entries.
  */
  localEntries(): AsyncIterableIterator<
    [
      Key,
      CacheKeyRegistry[Key] | CacheKeyValue,
      CacheEntryState<UserExtensionData>
    ]
  >;

  /**
   An async generator that produces the revisions of `key` within this transaction.
  */
  localRevisions(
    cacheKey: Key
  ): AsyncIterableIterator<CachedEntityRevision<CacheKeyValue>>;

  /**
   An async generator that produces the complete list of revisions for `key`,
   from the time the transaction began and including the revisions added in this
   transaction.
  */
  entryRevisions(
    cacheKey: Key
  ): AsyncIterableIterator<CachedEntityRevision<CacheKeyValue>>;

  $debug?: $Debug & CacheTransactionDebugAPIs;
}

/**
 * Interface specifc to handle Live transaction
 */
export interface LiveCacheTransaction<
  CacheKeyRegistry extends DefaultRegistry,
  Key extends keyof CacheKeyRegistry,
  $Debug = unknown,
  UserExtensionData = unknown
> extends CacheTransaction<CacheKeyRegistry, Key, $Debug, UserExtensionData> {
  /**
   * Merges cache entries based on merge strategy
   */
  merge(
    cacheKey: Key,
    value: CachedEntityRevision<CacheKeyValue>,
    options?: {
      $debug: $Debug;
    }
  ): Promise<CacheKeyRegistry[Key] | CacheKeyValue>;

  /**
   * sets cache values within the transaction
   */
  set(
    cacheKey: Key,
    value: CacheKeyRegistry[Key] | CacheKeyValue
  ): CacheKeyRegistry[Key] | CacheKeyValue;

  /**
   * Deletes an entry from live transction
   */
  delete(cacheKey: Key): Promise<boolean>;

  /**
   * Commits live transction entries. Calls Rollback if there are errors during commit or if commit exceeds timeout
   */
  commit(): Promise<void>;

  /**
   * Rollsback the cache to pre-transactional state
   */
  rollback(): Promise<void>;
}

export interface CommittingTransaction<
  CacheKeyRegistry extends DefaultRegistry,
  Key extends keyof CacheKeyRegistry = keyof CacheKeyRegistry,
  $Debug = unknown,
  UserExtensionData = unknown
> extends Omit<
    CacheTransaction<CacheKeyRegistry, Key, $Debug, UserExtensionData>,
    'get' | 'entries' | 'localEntries' | 'localRevisions' | 'entryRevisions'
  > {
  cache: {
    clearRevisions(
      tx: CommittingTransactionImpl<
        CacheKeyRegistry,
        Key,
        $Debug,
        UserExtensionData
      >,
      id: Key
    ): void;
    appendRevisions(
      tx: CommittingTransactionImpl<
        CacheKeyRegistry,
        Key,
        $Debug,
        UserExtensionData
      >,
      id: Key,
      revisions: CachedEntityRevision<CacheKeyValue>[]
    ): void;
  };
}

class CommittingTransactionImpl<
  CacheKeyRegistry extends DefaultRegistry,
  Key extends keyof CacheKeyRegistry = keyof CacheKeyRegistry,
  $Debug = unknown,
  UserExtensionData = unknown
> implements
    CommittingTransaction<CacheKeyRegistry, Key, $Debug, UserExtensionData>
{
  $debug?: ($Debug & CacheTransactionDebugAPIs) | undefined;
  #mergedRevisions: Map<Key, CachedEntityRevision<CacheKeyValue>[]>;

  cache: {
    clearRevisions(
      tx: CommittingTransactionImpl<
        CacheKeyRegistry,
        Key,
        $Debug,
        UserExtensionData
      >,
      id: Key
    ): void;
    appendRevisions(
      tx: CommittingTransactionImpl<
        CacheKeyRegistry,
        Key,
        $Debug,
        UserExtensionData
      >,
      id: Key,
      revisions: CachedEntityRevision<CacheKeyValue>[]
    ): void;
  } = {
    clearRevisions(
      tx: CommittingTransactionImpl<
        CacheKeyRegistry,
        Key,
        $Debug,
        UserExtensionData
      >,
      id: Key
    ): void {
      tx.#mergedRevisions.delete(id);
    },

    appendRevisions(
      tx: CommittingTransactionImpl<
        CacheKeyRegistry,
        Key,
        $Debug,
        UserExtensionData
      >,
      id: Key,
      revisions: CachedEntityRevision<CacheKeyValue>[]
    ): void {
      if (tx.#mergedRevisions.has(id)) {
        const appendedRevisions =
          tx.#mergedRevisions.get(id)?.concat(revisions) || [];
        tx.#mergedRevisions.set(id, appendedRevisions);
      } else {
        tx.#mergedRevisions.set(id, revisions);
      }
    },
  };

  constructor() {
    this.#mergedRevisions = new Map<
      Key,
      CachedEntityRevision<CacheKeyValue>[]
    >();
  }

  [Symbol.asyncIterator](
    entryMap: Map<Key, CacheKeyRegistry[Key]>
  ): AsyncIterableIterator<
    [Key, CacheKeyRegistry[Key], CacheEntryState<UserExtensionData>]
  > {
    throw new Error('Method not implemented.');
  }

  mergedRevisions(): Map<Key, CachedEntityRevision<CacheKeyValue>[]> {
    return this.#mergedRevisions;
  }
}

class LiveCacheTransactionImpl<
  CacheKeyRegistry extends DefaultRegistry,
  Key extends keyof CacheKeyRegistry,
  $Debug = unknown,
  UserExtensionData = unknown
> implements
    LiveCacheTransaction<CacheKeyRegistry, Key, $Debug, UserExtensionData>
{
  #originalCacheReference: CacheImpl<
    CacheKeyRegistry,
    Key,
    $Debug,
    UserExtensionData
  >;
  #transactionalCache: Map<Key, CacheKeyRegistry[Key]>;
  #localUpdatedEntries: Map<Key, CacheKeyRegistry[Key]>;
  #commitingTransaction: CommittingTransactionImpl<
    CacheKeyRegistry,
    Key,
    $Debug,
    UserExtensionData
  >;
  #cacheSnapshotBeforeCommit: Map<Key, CacheKeyRegistry[Key]>;
  #cacheEntryState: Map<Key, CacheEntryState<UserExtensionData>>;
  #userOptionRetentionPolicy: ExpirationPolicy;
  #ttlPolicy: number;
  #lruPolicy: number;
  #localRevisions: Map<Key, CachedEntityRevision<CacheKeyValue>[]>;
  #entryRevisions: Map<Key, CachedEntityRevision<CacheKeyValue>[]>;

  constructor(
    originalCache: CacheImpl<CacheKeyRegistry, Key, $Debug, UserExtensionData>,
    transactionalCacheEntryMap: Map<Key, CacheKeyRegistry[Key]>,
    entryRevisions: Map<Key, CachedEntityRevision<CacheKeyValue>[]>
  ) {
    this.#originalCacheReference = originalCache;
    this.#transactionalCache = transactionalCacheEntryMap;
    this.#localUpdatedEntries = new Map<Key, CacheKeyRegistry[Key]>();
    this.#cacheSnapshotBeforeCommit = new Map<Key, CacheKeyRegistry[Key]>();
    this.#cacheEntryState = new Map<Key, CacheEntryState<UserExtensionData>>();
    this.#ttlPolicy = DEFAULT_EXPIRATION.ttl;
    this.#lruPolicy = DEFAULT_EXPIRATION.lru;

    this.#localRevisions = new Map<
      Key,
      CachedEntityRevision<CacheKeyValue>[]
    >();
    this.#entryRevisions = entryRevisions;

    this.#userOptionRetentionPolicy =
      this.#originalCacheReference.getCacheOptions()?.expiration ||
      DEFAULT_EXPIRATION;

    if (
      this.#userOptionRetentionPolicy &&
      this.#userOptionRetentionPolicy?.lru &&
      typeof this.#userOptionRetentionPolicy.lru === 'number'
    ) {
      this.#lruPolicy = this.#userOptionRetentionPolicy.lru;
    }

    if (
      this.#userOptionRetentionPolicy &&
      this.#userOptionRetentionPolicy?.ttl &&
      typeof this.#userOptionRetentionPolicy.ttl === 'number'
    ) {
      this.#ttlPolicy = this.#userOptionRetentionPolicy.ttl;
    }

    this.#commitingTransaction = new CommittingTransactionImpl<
      CacheKeyRegistry,
      Key,
      $Debug,
      UserExtensionData
    >();
  }

  static async beginLiveTransaction<
    CacheKeyRegistry extends DefaultRegistry,
    Key extends keyof CacheKeyRegistry,
    $Debug = unknown,
    UserExtensionData = unknown
  >(
    originalCache: CacheImpl<CacheKeyRegistry, Key, $Debug, UserExtensionData>
  ) {
    const transactionalCache = new Map<Key, CacheKeyRegistry[Key]>();
    const entryRevisions = new Map<
      Key,
      CachedEntityRevision<CacheKeyValue>[]
    >();
    for await (const [key, value] of originalCache.entries()) {
      transactionalCache.set(key, { ...value });

      for await (const entryRevision of originalCache.entryRevisions(key)) {
        entryRevisions.set(key, [entryRevision]);
      }
    }

    return new LiveCacheTransactionImpl<
      CacheKeyRegistry,
      Key,
      $Debug,
      UserExtensionData
    >(originalCache, transactionalCache, entryRevisions);
  }

  get(cacheKey: Key): CacheKeyRegistry[Key] | undefined {
    const cacheValue = this.#transactionalCache.get(cacheKey);

    if (cacheValue) {
      // Update cache entry state
      this.#cacheEntryState.set(cacheKey, {
        retained: { lru: true, ttl: this.#ttlPolicy },
        lastAccessed: Date.now(),
      });
    }

    return cacheValue;
  }

  async *[Symbol.asyncIterator](
    entryMap: Map<Key, CacheKeyRegistry[Key]>
  ): AsyncIterableIterator<
    [Key, CacheKeyRegistry[Key], CacheEntryState<UserExtensionData>]
  > {
    for (const [key, value] of entryMap) {
      const state = this.#cacheEntryState.get(key) || DEFAULT_ENTRY_STATE;
      yield [key, value, state];
    }
  }

  entries(): AsyncIterableIterator<
    [Key, CacheKeyRegistry[Key], CacheEntryState<UserExtensionData>]
  > {
    return this[Symbol.asyncIterator](this.#transactionalCache);
  }

  localEntries(): AsyncIterableIterator<
    [Key, CacheKeyRegistry[Key], CacheEntryState<UserExtensionData>]
  > {
    return this[Symbol.asyncIterator](this.#localUpdatedEntries);
  }

  localRevisions(
    cacheKey: Key
  ): AsyncIterableIterator<CachedEntityRevision<CacheKeyValue>> {
    const entryRevisionIterator = {
      async *[Symbol.asyncIterator](
        revisions: CachedEntityRevision<CacheKeyValue>[]
      ): AsyncIterableIterator<CachedEntityRevision<CacheKeyValue>> {
        for (const revision of revisions) {
          yield revision;
        }
      },
    };

    const revisions = this.#localRevisions.get(cacheKey) || [];
    return entryRevisionIterator[Symbol.asyncIterator](revisions);
  }

  entryRevisions(
    cacheKey: Key
  ): AsyncIterableIterator<CachedEntityRevision<CacheKeyValue>> {
    const entryRevisionIterator = {
      async *[Symbol.asyncIterator](
        revisions: CachedEntityRevision<CacheKeyValue>[]
      ): AsyncIterableIterator<CachedEntityRevision<CacheKeyValue>> {
        for (const revision of revisions) {
          yield revision;
        }
      },
    };

    const entryRevisions = this.#entryRevisions.get(cacheKey) || [];
    const localRevisions = this.#localRevisions.get(cacheKey) || [];

    return entryRevisionIterator[Symbol.asyncIterator](
      entryRevisions.concat(localRevisions)
    );
  }

  set(cacheKey: Key, value: CacheKeyRegistry[Key]): CacheKeyRegistry[Key] {
    this.#transactionalCache.set(cacheKey, value);
    this.#localUpdatedEntries.set(cacheKey, value);

    // Update cache entry state
    this.#cacheEntryState.set(cacheKey, {
      retained: { lru: true, ttl: this.#ttlPolicy },
      lastAccessed: Date.now(),
    });

    return value;
  }

  async delete(cacheKey: Key): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.#transactionalCache.has(cacheKey)) {
        this.#transactionalCache.delete(cacheKey);
      }

      if (this.#localUpdatedEntries.has(cacheKey)) {
        this.#localUpdatedEntries.delete(cacheKey);
      }

      return resolve(
        this.#transactionalCache.has(cacheKey) === false &&
          this.#localUpdatedEntries.has(cacheKey) === false
      );
    });
  }

  async merge(
    cacheKey: Key,
    entityRevision: CachedEntityRevision<CacheKeyValue>,
    options?: {
      $debug: $Debug;
    }
  ): Promise<CacheKeyRegistry[Key] | CacheKeyValue> {
    // assign custom merge strategy if specified else use default
    const mergeStrategyFromCacheOptionHook =
      this.#originalCacheReference.getCacheOptions()?.hooks
        ?.entitymergeStrategy;
    const mergeStrategy =
      mergeStrategyFromCacheOptionHook || defaultMergeStrategy;

    // get current cache value within this transaction
    const currentValue = this.#transactionalCache.get(cacheKey);

    const mergedEntity = mergeStrategy(
      cacheKey,
      {
        entity: entityRevision.entity,
        revision: entityRevision.revision,
        revisionContext: entityRevision?.revisionContext,
      },
      currentValue,
      this
    );

    // TODO throw error if Merge entity is undefined

    // Update transactional cache with merged entity
    this.set(cacheKey, mergedEntity as CacheKeyRegistry[Key]);

    // Update local & entry revisions with new revision values
    const revision = {
      entity: mergedEntity,
      revision: entityRevision.revision,
      revisionContext: entityRevision?.revisionContext,
    };
    if (this.#localRevisions.has(cacheKey)) {
      this.#localRevisions.get(cacheKey)?.push(revision);
    } else {
      this.#localRevisions.set(cacheKey, [revision]);
    }

    return mergedEntity;
  }

  async commit(options?: { timeout: number | false }): Promise<void> {
    for await (const [cacheKey] of this.#originalCacheReference.entries()) {
      const originalCacheValue = await this.#originalCacheReference.get(
        cacheKey
      );
      if (originalCacheValue) {
        this.#cacheSnapshotBeforeCommit.set(cacheKey, {
          ...originalCacheValue,
        });
      }
    }

    const timeout: number = options?.timeout ? options.timeout : 10000;
    const commitLock = new Promise((resolve, reject) =>
      setTimeout(reject, timeout)
    );
    const writeToCache = async () => {
      const trasactionCacheEntries: [
        Key,
        CacheKeyRegistry[Key],
        CacheEntryState<UserExtensionData> | undefined
      ][] = [];

      for await (const [cacheKey, value, state] of this.localEntries()) {
        const latestCacheValue = await this.#originalCacheReference.get(
          cacheKey
        );
        let entityToCommit;

        // assign custom merge strategy if specified else use default
        const mergeStrategyFromCacheOptionHook =
          this.#originalCacheReference.getCacheOptions()?.hooks
            ?.entitymergeStrategy;
        const mergeStrategy =
          mergeStrategyFromCacheOptionHook || defaultMergeStrategy;

        if (latestCacheValue) {
          // TODO fix revision
          entityToCommit = mergeStrategy(
            cacheKey,
            { entity: value as CacheKeyValue, revision: 3 },
            latestCacheValue,
            this
          );
        } else {
          entityToCommit = value;
        }
        const structuredClonedValue = structuredClone(
          entityToCommit
        ) as CacheKeyRegistry[Key];

        trasactionCacheEntries.push([cacheKey, structuredClonedValue, state]);

        // Update saved revisions of the entity
        const localRevisions = this.#localRevisions.get(cacheKey);
        let revisionNumber =
          localRevisions && localRevisions[localRevisions.length - 1].revision
            ? localRevisions[localRevisions.length - 1].revision
            : 0;

        const entityRevision = {
          entity: entityToCommit as CacheKeyValue,
          revision: ++revisionNumber,
        };
        if (this.#localRevisions.has(cacheKey)) {
          this.#localRevisions.get(cacheKey)?.push(entityRevision);
        } else {
          this.#localRevisions.set(cacheKey, [entityRevision]);
        }

        const revisionStrategy = this.#originalCacheReference.getCacheOptions()
          ?.hooks?.revisionMergeStrategy
          ? async (
              id: Key,
              commitTx: CommittingTransactionImpl<
                CacheKeyRegistry,
                Key,
                $Debug,
                UserExtensionData
              >,
              liveTx: LiveCacheTransactionImpl<
                CacheKeyRegistry,
                Key,
                $Debug,
                UserExtensionData
              >
            ) =>
              this.#originalCacheReference.getCacheOptions()?.hooks
                ?.revisionMergeStrategy
          : defaultRevisionStrategy;

        // Update revisions based on revision strategy
        await revisionStrategy(cacheKey, this.#commitingTransaction, this);
      }

      // Call commit hook to apply custom retention policies before commit (if passed by cache options)
      const customRetentionPolicy =
        this.#originalCacheReference.getCacheOptions()?.hooks?.commit;
      if (customRetentionPolicy) {
        customRetentionPolicy(this);
      }

      const mergedRevisions = this.#commitingTransaction.mergedRevisions();

      // commit merged transaction & revisions entries to main cache
      await this.#originalCacheReference.commitTransaction(
        trasactionCacheEntries,
        mergedRevisions
      );
    };

    try {
      await Promise.race([writeToCache(), commitLock]);
    } catch {
      // TODO throw error/warning
      await this.rollback();
    }
  }

  async rollback(): Promise<void> {
    const arrayOfCacheEntryTuples: [
      Key,
      CacheKeyRegistry[Key],
      CacheEntryState<UserExtensionData>?
    ][] = [];

    for (const [cacheKey] of this.#cacheSnapshotBeforeCommit) {
      const prevCacheValue = this.#cacheSnapshotBeforeCommit.get(cacheKey);

      const structuredClonedValue = structuredClone(
        prevCacheValue
      ) as CacheKeyRegistry[Key];
      arrayOfCacheEntryTuples.push([cacheKey, structuredClonedValue]);
    }

    await this.#originalCacheReference.clear();
    await this.#originalCacheReference.load(arrayOfCacheEntryTuples);
  }
}

class CacheImpl<
  CacheKeyRegistry extends DefaultRegistry,
  Key extends keyof CacheKeyRegistry,
  $Debug = unknown,
  UserExtensionData = unknown
> implements Cache<CacheKeyRegistry, Key, $Debug, UserExtensionData>
{
  #weakCache: Map<Key, WeakRef<CacheKeyRegistry[Key]>>;
  #entryRevisions: Map<Key, CachedEntityRevision<CacheKeyValue>[]>;
  #cacheOptions:
    | CacheOptions<CacheKeyRegistry, Key, $Debug, UserExtensionData>
    | undefined;
  #cacheEntryState: Map<Key, CacheEntryState<UserExtensionData> | undefined>;
  #lruCache: LruCacheImpl<CacheKeyRegistry, Key>;
  #lruPolicy: number;

  constructor(
    options:
      | CacheOptions<CacheKeyRegistry, Key, $Debug, UserExtensionData>
      | undefined
  ) {
    this.#weakCache = new Map<Key, WeakRef<CacheKeyRegistry[Key]>>();
    this.#cacheOptions = options;
    this.#lruPolicy = DEFAULT_EXPIRATION.lru;
    this.#entryRevisions = new Map<
      Key,
      CachedEntityRevision<CacheKeyValue>[]
    >();
    this.#cacheEntryState = new Map<
      Key,
      CacheEntryState<UserExtensionData> | undefined
    >();

    const expiration = this.#cacheOptions?.expiration || DEFAULT_EXPIRATION;
    if (expiration && expiration?.lru && typeof expiration.lru === 'number') {
      this.#lruPolicy = expiration.lru;
    }
    this.#lruCache = new LruCacheImpl<CacheKeyRegistry, Key>(this.#lruPolicy);
  }

  /**
    Evict all entries from the cache.
  */
  async clear(): Promise<void> {
    for await (const [key] of this.entries()) {
      this.#weakCache.delete(key);
      this.#lruCache.getCache().delete(key);
      this.#entryRevisions.delete(key);
    }
  }

  getCacheOptions():
    | CacheOptions<CacheKeyRegistry, Key, $Debug, UserExtensionData>
    | undefined {
    return this.#cacheOptions;
  }

  async get(cacheKey: Key): Promise<CacheKeyRegistry[Key] | undefined> {
    let ref = this.#weakCache.get(cacheKey);
    return ref?.deref();
  }

  /**
    Calling `.save()` without a serializer will iterate over the cache entries
    and return an array of cache entry tuples.
  */
  async save(): Promise<
    [
      Key,
      CacheKeyRegistry[Key],
      CacheEntryState<UserExtensionData> | undefined
    ][]
  > {
    const arrayOfCacheEntryTuples: [
      Key,
      CacheKeyRegistry[Key],
      CacheEntryState<UserExtensionData> | undefined
    ][] = [];
    for await (const [key, value, state] of this.entries()) {
      // TODO create state?
      const structuredClonedValue = structuredClone(
        value
      ) as CacheKeyRegistry[Key];
      arrayOfCacheEntryTuples.push([key, structuredClonedValue, state]);
    }
    return arrayOfCacheEntryTuples;
  }

  /**
    Calling `.load()` will add all entries passed to the cache.
    Note: `.load()` does not clear pre-existing entries, if you need to clear
    entries before loading call `.clear()`.
  */
  async load(
    entries: CacheEntry<CacheKeyRegistry, Key, UserExtensionData>[]
  ): Promise<void> {
    let revisionCounter = 0;
    for await (let entry of entries) {
      let [key, value, state] = entry;

      // TODO: finalizregistry
      let clone = structuredClone(value) as CacheKeyRegistry[Key];
      this.#weakCache.set(key, new WeakRef(clone));

      this.#lruCache.set(key, clone);
      this.#cacheEntryState.set(key, state);

      const entityRevision = {
        entity: value as CacheKeyValue,
        revision: ++revisionCounter,
      };
      if (this.#entryRevisions.has(key)) {
        const revisions =
          this.#entryRevisions.get(key)?.concat(entityRevision) || [];
        this.#entryRevisions.set(key, revisions);
      } else {
        this.#entryRevisions.set(key, [entityRevision]);
      }
    }
  }

  async commitTransaction(
    entries: CacheEntry<CacheKeyRegistry, Key, UserExtensionData>[],
    entryRevisions: Map<Key, CachedEntityRevision<CacheKeyValue>[]>
  ): Promise<void> {
    const sortEntries = entries.sort(([, , state], [, , state1]) =>
      state?.lastAccessed &&
      state1?.lastAccessed &&
      state?.lastAccessed < state1?.lastAccessed
        ? 1
        : -1
    );

    for await (let entry of sortEntries) {
      let [key, value, state] = entry;

      // TODO: finalizregistry
      this.#weakCache.set(key, new WeakRef(value));

      this.#cacheEntryState.set(key, state);

      if (state?.retained.lru) {
        this.#lruCache.set(key, value);
      }
    }

    for await (const [cacheKey, revision] of entryRevisions) {
      if (this.#entryRevisions.has(cacheKey)) {
        const revisions =
          this.#entryRevisions.get(cacheKey)?.concat(revision) || [];
        this.#entryRevisions.set(cacheKey, revisions);
      } else {
        this.#entryRevisions.set(cacheKey, revision);
      }
    }
  }

  /**
    Generator function for async iterable that yields iterable cache entries. This
    will include both strongly held (unexpired entries) as well as weakly held
    entries.
  */
  async *[Symbol.asyncIterator](): AsyncIterableIterator<
    [Key, CacheKeyRegistry[Key], CacheEntryState<UserExtensionData>]
  > {
    // yield weekly held values
    for await (const [key] of this.#weakCache) {
      const valueRef = this.#weakCache.get(key)?.deref();

      // Because of the limited guarantees of `FinalizationRegistry`, when yielding
      // weakly-held values to the user in `entries` we have to check that the
      // value is actually present,
      if (!valueRef) {
        throw new Error('ref is undefined');
      }

      const state = this.#cacheEntryState.get(key) || DEFAULT_ENTRY_STATE;

      yield [key, valueRef, state];
    }
  }

  /**
    Generator function that yields each of the iterable cache entries. Note that this
    will include both strongly held (unexpired entries) as well as weakly held
    entries.
  */
  entries(): AsyncIterableIterator<
    [Key, CacheKeyRegistry[Key], CacheEntryState<UserExtensionData>]
  > {
    return this[Symbol.asyncIterator]();
  }

  entryRevisions(
    cacheKey: Key
  ): AsyncIterableIterator<CachedEntityRevision<CacheKeyValue>> {
    const entryRevisionIterator = {
      async *[Symbol.asyncIterator](
        revisions: CachedEntityRevision<CacheKeyValue>[]
      ): AsyncIterableIterator<CachedEntityRevision<CacheKeyValue>> {
        for (const revision of revisions) {
          yield revision;
        }
      },
    };

    const revisions = this.#entryRevisions.get(cacheKey) || [];
    return entryRevisionIterator[Symbol.asyncIterator](revisions);
  }

  /**
   * Generator function that yields each of the iterable cache entry Keys.
   */
  async *keys(): AsyncIterableIterator<Key> {
    for await (const [key] of this.entries()) {
      yield key;
    }
  }

  /**
   * Generator function that yields each of the iterable cache entry Values.
   */
  async *values(): AsyncIterableIterator<CacheKeyRegistry[Key]> {
    for await (const [, value] of this.entries()) {
      yield value;
    }
  }

  async beginTransaction(): Promise<
    LiveCacheTransaction<CacheKeyRegistry, Key, $Debug, UserExtensionData>
  > {
    return await LiveCacheTransactionImpl.beginLiveTransaction(this);
  }
}

export function buildCache<
  CacheKeyRegistry extends DefaultRegistry = DefaultRegistry,
  Key extends keyof CacheKeyRegistry = keyof CacheKeyRegistry,
  $Debug = unknown,
  UserExtensionData = unknown
>(
  options?: CacheOptions<CacheKeyRegistry, Key, $Debug, UserExtensionData>
): Cache<CacheKeyRegistry, Key, $Debug, UserExtensionData> {
  return new CacheImpl<CacheKeyRegistry, Key, $Debug, UserExtensionData>(
    options
  );
}

const defaultMergeStrategy = function deepMergeStratey<
  CacheKeyRegistry extends DefaultRegistry,
  Key extends keyof CacheKeyRegistry
>(
  id: Key,
  { entity, revision }: CachedEntityRevision<CacheKeyValue>,
  current: CacheKeyRegistry[Key] | undefined,
  tx: CacheTransaction<CacheKeyRegistry, Key>
): CacheKeyValue {
  return deepMerge(current as CacheKeyValue, entity);
};

const defaultRevisionStrategy = async function retainAllRevisions<
  CacheKeyRegistry extends DefaultRegistry,
  Key extends keyof CacheKeyRegistry,
  $Debug = unknown,
  UserExtensionData = unknown
>(
  id: Key,
  commitTx: CommittingTransactionImpl<
    CacheKeyRegistry,
    Key,
    $Debug,
    UserExtensionData
  >,
  liveTx: LiveCacheTransactionImpl<
    CacheKeyRegistry,
    Key,
    $Debug,
    UserExtensionData
  >
): Promise<void> {
  const revisions: CachedEntityRevision<CacheKeyValue>[] = [];

  for await (const revision of liveTx.localRevisions(id)) {
    revisions.push(revision);
  }

  commitTx.cache.appendRevisions(commitTx, id, [...revisions]);
};

// eslint-disable-next-line
const isObject = function isObject(obj: any): obj is Record<string, any> {
  return obj !== null && !Array.isArray(obj) && typeof obj === 'object';
};

function deepMerge(
  targetData: CacheKeyValue,
  sourceData: CacheKeyValue
): CacheKeyValue {
  const source = isObject(sourceData) ? { ...sourceData } : sourceData;
  const target = isObject(targetData) ? { ...targetData } : targetData;

  if (isObject(source) && isObject(target)) {
    Object.keys(source).forEach((sourceKey) => {
      if (Object.prototype.hasOwnProperty.call(target, sourceKey)) {
        if (source[sourceKey] != target[sourceKey]) {
          // There is conflict that needs to be resolved
          const result = resolveConflict(target, source, sourceKey);

          if (result != target[sourceKey]) {
            target[sourceKey] = result;
          }
        }
      } else {
        // If there is no conflict, its safe, assign source to target
        target[sourceKey] = source[sourceKey];
      }
    });

    return target;
  }

  // If source or target is not an object use source.
  return source;
}

function resolveConflict(
  target: Record<string, object | string | number>,
  source: Record<string, object | string | number>,
  property: string
): CacheKeyValue {
  return deepMerge(
    target[property] as CacheKeyValue,
    source[property] as CacheKeyValue
  );
}
