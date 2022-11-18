import { consumeTag, createTag, dirtyTag, type Tag } from './tag';
import { GLOBAL_VERSION } from './version';

type Equality<T> = (oldValue: T, newValue: T) => boolean;

function baseEquality<T>(oldValue: T, newValue: T) {
  return oldValue === newValue;
}

export class Signal<T> {
  #value: T;
  #isEqual: Equality<T>;
  #tag: Tag;

  constructor(value: T, isEqual: Equality<T> = baseEquality) {
    this.#value = value;
    this.#isEqual = isEqual;
    this.#tag = createTag();
  }

  get value() {
    consumeTag(this.#tag);
    return this.#value;
  }

  peek() {
    return this.#value;
  }

  set value(v: T) {
    if (!this.#isEqual(this.#value, v)) {
      this.#value = v;
      dirtyTag(this.#tag);
    }
  }
}

export function createSignal<T>(value: T, isEqual?: Equality<T>) {
  return new Signal(value, isEqual);
}
