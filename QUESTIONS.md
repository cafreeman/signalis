# Effects

- Should effects only rerun when their direct dependencies change?
  - Right now, the only rerun when _any_ of their related dependencies change (so, if you have effect -> derived -> signal, and the signal changes, the effect will always recompute because the signal changed, otherwise we don't have any way of knowing whether the derived value was changed since we have to pull on it first in order to get it to mark itself as updated).
  - I'm not actually sure if it's possible to do this, given the issue mentioned above.
