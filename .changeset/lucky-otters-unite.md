---
'@signalis/core': minor
---

Add new public APIs and fix several reactivity-graph correctness bugs:

- Export `when` and `untrack` from the package entry point. Both were implemented and tested but had never been exposed publicly.
- Add `Derived#dispose()`, which resets a derived to its freshly-constructed state: unlinked from all of its sources, source list dropped, and marked dirty. Dependents are invalidated so they never serve values cached from a node that no longer tracks upstream changes, including when read synchronously inside a batch. Because deriveds are lazy, a disposed instance isn't dead — the next time its value is read, it recomputes from scratch and fully re-subscribes to whatever it reads.
- Fix `batch` so pending updates and reactions still flush when the batch callback throws; previously an exception left the system stuck buffering updates forever.
- Make `untrack` reentrant: tracking suspension is now counted, so nested `untrack` calls no longer silently re-enable tracking in the middle of the outer untracked section.
- Fix `Reaction#dispose()` to unlink the reaction from _all_ of its sources; previously it started from the global context index, so a reaction disposed while another computation was running could leak subscriptions to its earlier sources.
