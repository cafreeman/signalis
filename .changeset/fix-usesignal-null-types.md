---
'@signalis/react': patch
---

Fix useSignal type signature to properly handle null values

- Remove T extends {} constraint from implementation signature that was preventing useSignal(null) from working
- Fix arguments object usage in arrow function for ES5 compatibility
- Update documentation to reflect correct type signatures
- Add comprehensive type tests for all useSignal modes

Fixes issue where useSignal(null) was incorrectly rejected by TypeScript despite being a valid use case.