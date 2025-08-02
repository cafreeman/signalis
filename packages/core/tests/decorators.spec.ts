import { expect, describe, test, vi } from 'vitest';
import isEqual from 'lodash/isEqual';
import { createEffect } from '../src/effect';
import { signal, derived } from '../src/decorators';

describe('@signal decorator', () => {
  test('basic signal decorator works', () => {
    class TestClass {
      @signal
      count = 0;
    }

    const instance = new TestClass();
    const spy = vi.fn(() => {
      instance.count;
    });

    createEffect(spy);
    expect(spy).toHaveBeenCalledTimes(1);

    instance.count = 1;
    expect(spy).toHaveBeenCalledTimes(2);
    expect(instance.count).toBe(1);
  });

  test('signal decorator with custom equality function', () => {
    class TestClass {
      @signal({ isEqual: (a, b) => a.id === b.id })
      user = { id: 1, name: 'John' };
    }

    const instance = new TestClass();
    const spy = vi.fn(() => {
      instance.user;
    });

    createEffect(spy);
    expect(spy).toHaveBeenCalledTimes(1);

    // Same ID, should not trigger update
    instance.user = { id: 1, name: 'Jane' };
    expect(spy).toHaveBeenCalledTimes(1);

    // Different ID, should trigger update
    instance.user = { id: 2, name: 'Jane' };
    expect(spy).toHaveBeenCalledTimes(2);
  });

  test('signal decorator with volatile option', () => {
    class TestClass {
      @signal({ volatile: true })
      timestamp = Date.now();
    }

    const instance = new TestClass();
    const spy = vi.fn(() => {
      instance.timestamp;
    });

    createEffect(spy);
    expect(spy).toHaveBeenCalledTimes(1);

    // Even same value should trigger update when volatile
    const sameValue = instance.timestamp;
    instance.timestamp = sameValue;
    expect(spy).toHaveBeenCalledTimes(2);
  });

  test('signal decorator with isEqual: false', () => {
    class TestClass {
      @signal({ isEqual: false })
      value = 'test';
    }

    const instance = new TestClass();
    const spy = vi.fn(() => {
      instance.value;
    });

    createEffect(spy);
    expect(spy).toHaveBeenCalledTimes(1);

    // Should always trigger update
    instance.value = 'test';
    expect(spy).toHaveBeenCalledTimes(2);
  });

  test('signal decorator with deep equality', () => {
    class TestClass {
      @signal({ isEqual: isEqual })
      data = { a: 1, b: 2 };
    }

    const instance = new TestClass();
    const spy = vi.fn(() => {
      instance.data;
    });

    createEffect(spy);
    expect(spy).toHaveBeenCalledTimes(1);

    // Deep equality should work
    instance.data = { a: 1, b: 2 };
    expect(spy).toHaveBeenCalledTimes(1);

    instance.data = { a: 1, b: 3 };
    expect(spy).toHaveBeenCalledTimes(2);
  });

  test('signal decorator called with options function', () => {
    class TestClass {
      @signal({ isEqual: isEqual })
      data = { a: 1, b: 2 };
    }

    const instance = new TestClass();
    const spy = vi.fn(() => {
      instance.data;
    });

    createEffect(spy);
    expect(spy).toHaveBeenCalledTimes(1);

    // Deep equality should work
    instance.data = { a: 1, b: 2 };
    expect(spy).toHaveBeenCalledTimes(1);

    instance.data = { a: 1, b: 3 };
    expect(spy).toHaveBeenCalledTimes(2);
  });

  test('signal decorator without initial value', () => {
    class TestClass {
      @signal
      value: string;
    }

    const instance = new TestClass();
    const spy = vi.fn(() => {
      instance.value;
    });

    createEffect(spy);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(instance.value).toBeUndefined();

    instance.value = 'test';
    expect(spy).toHaveBeenCalledTimes(2);
    expect(instance.value).toBe('test');
  });
});

describe('@derived decorator', () => {
  test('basic derived decorator works', () => {
    class TestClass {
      @signal
      firstName = 'John';

      @signal
      lastName = 'Doe';

      @derived
      get fullName() {
        return `${this.firstName} ${this.lastName}`;
      }
    }

    const instance = new TestClass();
    const spy = vi.fn(() => {
      instance.fullName;
    });

    createEffect(spy);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(instance.fullName).toBe('John Doe');

    instance.firstName = 'Jane';
    expect(spy).toHaveBeenCalledTimes(2);
    expect(instance.fullName).toBe('Jane Doe');
  });

  test('derived decorator with label', () => {
    class TestClass {
      @signal
      count = 0;

      @derived({ label: 'doubled' })
      get doubled() {
        return this.count * 2;
      }
    }

    const instance = new TestClass();
    const spy = vi.fn(() => {
      instance.doubled;
    });

    createEffect(spy);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(instance.doubled).toBe(0);

    instance.count = 5;
    expect(spy).toHaveBeenCalledTimes(2);
    expect(instance.doubled).toBe(10);
  });

  test('derived decorator with complex computation', () => {
    class TestClass {
      @signal
      items = [1, 2, 3];

      @signal
      multiplier = 2;

      @derived
      get processedItems() {
        return this.items.map(item => item * this.multiplier);
      }
    }

    const instance = new TestClass();
    const spy = vi.fn(() => {
      instance.processedItems;
    });

    createEffect(spy);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(instance.processedItems).toEqual([2, 4, 6]);

    instance.multiplier = 3;
    expect(spy).toHaveBeenCalledTimes(2);
    expect(instance.processedItems).toEqual([3, 6, 9]);

    instance.items = [1, 2];
    expect(spy).toHaveBeenCalledTimes(3);
    expect(instance.processedItems).toEqual([3, 6]);
  });

  test('derived decorator throws error on non-getter', () => {
    expect(() => {
      class TestClass {
        @derived
        normalMethod() {
          return 'test';
        }
      }
    }).toThrow('@derived can only be used on getter methods');
  });

  test('derived decorator throws error on property', () => {
    expect(() => {
      class TestClass {
        @derived
        normalProperty = 'test';
      }
    }).toThrow('@derived can only be used on getter methods');
  });

  test('derived decorator with multiple dependencies', () => {
    class TestClass {
      @signal
      a = 1;

      @signal
      b = 2;

      @signal
      c = 3;

      @derived
      get sum() {
        return this.a + this.b + this.c;
      }
    }

    const instance = new TestClass();
    const spy = vi.fn(() => {
      instance.sum;
    });

    createEffect(spy);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(instance.sum).toBe(6);

    instance.a = 10;
    expect(spy).toHaveBeenCalledTimes(2);
    expect(instance.sum).toBe(15);

    instance.b = 20;
    expect(spy).toHaveBeenCalledTimes(3);
    expect(instance.sum).toBe(33);
  });
});

describe('Decorator integration', () => {
  test('signal and derived work together in complex scenarios', () => {
    class Calculator {
      @signal
      a = 10;

      @signal
      b = 5;

      @derived
      get sum() {
        return this.a + this.b;
      }

      @derived
      get product() {
        return this.a * this.b;
      }

      @derived
      get average() {
        return this.sum / 2;
      }
    }

    const calc = new Calculator();
    const sumSpy = vi.fn(() => calc.sum);
    const productSpy = vi.fn(() => calc.product);
    const averageSpy = vi.fn(() => calc.average);

    createEffect(sumSpy);
    createEffect(productSpy);
    createEffect(averageSpy);

    expect(sumSpy).toHaveBeenCalledTimes(1);
    expect(productSpy).toHaveBeenCalledTimes(1);
    expect(averageSpy).toHaveBeenCalledTimes(1);

    expect(calc.sum).toBe(15);
    expect(calc.product).toBe(50);
    expect(calc.average).toBe(7.5);

    calc.a = 20;
    expect(sumSpy).toHaveBeenCalledTimes(2);
    expect(productSpy).toHaveBeenCalledTimes(2);
    expect(averageSpy).toHaveBeenCalledTimes(2);

    expect(calc.sum).toBe(25);
    expect(calc.product).toBe(100);
    expect(calc.average).toBe(12.5);
  });

  test('decorators work with class inheritance', () => {
    class BaseClass {
      @signal
      baseValue = 'base';
    }

    class DerivedClass extends BaseClass {
      @signal
      derivedValue = 'derived';

      @derived
      get combined() {
        return `${this.baseValue} + ${this.derivedValue}`;
      }
    }

    const instance = new DerivedClass();
    const spy = vi.fn(() => instance.combined);

    createEffect(spy);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(instance.combined).toBe('base + derived');

    instance.baseValue = 'newBase';
    expect(spy).toHaveBeenCalledTimes(2);
    expect(instance.combined).toBe('newBase + derived');

    instance.derivedValue = 'newDerived';
    expect(spy).toHaveBeenCalledTimes(3);
    expect(instance.combined).toBe('newBase + newDerived');
  });

  test('decorators maintain proper instance isolation', () => {
    class TestClass {
      @signal
      value = 0;

      @derived
      get doubled() {
        return this.value * 2;
      }
    }

    const instance1 = new TestClass();
    const instance2 = new TestClass();

    const spy1 = vi.fn(() => instance1.doubled);
    const spy2 = vi.fn(() => instance2.doubled);

    createEffect(spy1);
    createEffect(spy2);

    expect(spy1).toHaveBeenCalledTimes(1);
    expect(spy2).toHaveBeenCalledTimes(1);

    instance1.value = 5;
    expect(spy1).toHaveBeenCalledTimes(2);
    expect(spy2).toHaveBeenCalledTimes(1);

    instance2.value = 10;
    expect(spy1).toHaveBeenCalledTimes(2);
    expect(spy2).toHaveBeenCalledTimes(2);

    expect(instance1.doubled).toBe(10);
    expect(instance2.doubled).toBe(20);
  });

  test('decorators work with multiple inheritance levels', () => {
    class GrandParent {
      @signal
      grandParentValue = 'grandparent';
    }

    class Parent extends GrandParent {
      @signal
      parentValue = 'parent';

      @derived
      get parentCombined() {
        return `${this.grandParentValue} + ${this.parentValue}`;
      }
    }

    class Child extends Parent {
      @signal
      childValue = 'child';

      @derived
      get fullCombined() {
        return `${this.parentCombined} + ${this.childValue}`;
      }
    }

    const instance = new Child();
    const spy = vi.fn(() => instance.fullCombined);

    createEffect(spy);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(instance.fullCombined).toBe('grandparent + parent + child');

    instance.grandParentValue = 'newGrandParent';
    expect(spy).toHaveBeenCalledTimes(2);
    expect(instance.fullCombined).toBe('newGrandParent + parent + child');

    instance.parentValue = 'newParent';
    expect(spy).toHaveBeenCalledTimes(3);
    expect(instance.fullCombined).toBe('newGrandParent + newParent + child');
  });

  test('decorators work with computed dependencies', () => {
    class TestClass {
      @signal
      items = [1, 2, 3, 4, 5];

      @signal
      filter = 'even';

      @derived
      get filteredItems() {
        if (this.filter === 'even') {
          return this.items.filter(item => item % 2 === 0);
        } else if (this.filter === 'odd') {
          return this.items.filter(item => item % 2 === 1);
        }
        return this.items;
      }

      @derived
      get sum() {
        return this.filteredItems.reduce((sum, item) => sum + item, 0);
      }
    }

    const instance = new TestClass();
    const spy = vi.fn(() => instance.sum);

    createEffect(spy);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(instance.sum).toBe(6); // 2 + 4

    instance.filter = 'odd';
    expect(spy).toHaveBeenCalledTimes(2);
    expect(instance.sum).toBe(9); // 1 + 3 + 5

    instance.items = [10, 20, 30];
    expect(spy).toHaveBeenCalledTimes(3);
    expect(instance.sum).toBe(0); // no odd numbers
  });
});

describe('Decorator edge cases', () => {
  test('signal decorator with null initial value', () => {
    class TestClass {
      @signal
      value = null;
    }

    const instance = new TestClass();
    const spy = vi.fn(() => instance.value);

    createEffect(spy);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(instance.value).toBeNull();

    instance.value = 'test';
    expect(spy).toHaveBeenCalledTimes(2);
    expect(instance.value).toBe('test');
  });

  test('signal decorator with undefined initial value', () => {
    class TestClass {
      @signal
      value = undefined;
    }

    const instance = new TestClass();
    const spy = vi.fn(() => instance.value);

    createEffect(spy);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(instance.value).toBeUndefined();

    instance.value = 'test';
    expect(spy).toHaveBeenCalledTimes(2);
    expect(instance.value).toBe('test');
  });

  test('derived decorator with conditional logic', () => {
    class TestClass {
      @signal
      condition = true;

      @signal
      valueA = 'A';

      @signal
      valueB = 'B';

      @derived
      get result() {
        return this.condition ? this.valueA : this.valueB;
      }
    }

    const instance = new TestClass();
    const spy = vi.fn(() => instance.result);

    createEffect(spy);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(instance.result).toBe('A');

    instance.condition = false;
    expect(spy).toHaveBeenCalledTimes(2);
    expect(instance.result).toBe('B');

    instance.valueA = 'newA';
    expect(spy).toHaveBeenCalledTimes(2); // Should not trigger since condition is false

    instance.condition = true;
    expect(spy).toHaveBeenCalledTimes(3);
    expect(instance.result).toBe('newA');
  });

  test('decorators work with async-like patterns', () => {
    class TestClass {
      @signal
      loading = false;

      @signal
      data = null;

      @derived
      get displayData() {
        if (this.loading) {
          return 'Loading...';
        }
        return this.data || 'No data';
      }
    }

    const instance = new TestClass();
    const spy = vi.fn(() => instance.displayData);

    createEffect(spy);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(instance.displayData).toBe('No data');

    instance.loading = true;
    expect(spy).toHaveBeenCalledTimes(2);
    expect(instance.displayData).toBe('Loading...');

    instance.data = 'Hello World';
    expect(spy).toHaveBeenCalledTimes(2); // Should not trigger since loading is true

    instance.loading = false;
    expect(spy).toHaveBeenCalledTimes(3);
    expect(instance.displayData).toBe('Hello World');
  });
});
