import { createTag, markDependency, markUpdate, type Tag } from './tag';

type Equality<T> = (oldValue: T, newValue: T) => boolean;

function baseEquality<T>(oldValue: T, newValue: T) {
  return oldValue === newValue;
}

export class Signal<T = unknown> {
  #value: T;
  protected isEqual: Equality<T>;
  protected tag: Tag;

  constructor(value: T, isEqual: Equality<T> | false = baseEquality) {
    this.#value = value;

    if (isEqual === false) {
      this.isEqual = () => false;
    } else {
      this.isEqual = isEqual;
    }
    this.tag = createTag();
  }

  get value() {
    markDependency(this.tag);
    return this.#value;
  }

  peek() {
    return this.#value;
  }

  set value(v: T) {
    if (!this.isEqual(this.#value, v)) {
      this.#value = v;
      markUpdate(this.tag);
    }
  }
}

export function createSignal<T>(value: T, isEqual?: Equality<T> | false) {
  return new Signal(value, isEqual);
}
