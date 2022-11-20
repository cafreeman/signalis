import defer from 'p-defer';
import { describe, expect, test, vi } from 'vitest';
import { createEffect, createSignal } from '../src';
import { createResource } from '../src/resource';

describe('Resource', () => {
  describe('without source', () => {
    test('it works', async () => {
      const deferred = defer<string>();
      const resourceSpy = vi.fn(() => deferred.promise);

      const resource = createResource<string>(resourceSpy);

      let message: string | undefined = '';

      const effectSpy = vi.fn(() => {
        message = resource.value;
      });

      createEffect(effectSpy);

      expect(message).toEqual(undefined);

      expect(resource.loading.value).toBe(true);

      deferred.resolve('foo');

      expect(effectSpy).toHaveBeenCalledOnce();

      await expect(deferred.promise).resolves.toEqual('foo');

      expect(effectSpy).toHaveBeenCalledTimes(2);
      expect(message).toEqual('foo');

      expect(resource.loading.value).toBe(false);
    });

    test('with error', async () => {
      const d = defer();
      const resourceSpy = vi.fn(() => d.promise);

      const resource = createResource(resourceSpy);

      expect(resource.loading.value).toBe(true);

      d.reject('error');

      await expect(d.promise).rejects.toThrow('error');
      expect(resource.error).toEqual('error');
      expect(resource.loading.value).toBe(false);
    });
  });

  describe('with source', () => {
    test('it works', async () => {
      const source = createSignal(0);
      const deferred = defer<number>();

      const resourceSpy = vi.fn(() => {
        return deferred.promise;
      });

      const resource = createResource(source, resourceSpy);

      let message: number | undefined;

      const effectSpy = vi.fn(() => {
        message = resource.value;
      });

      createEffect(effectSpy);

      expect(message).toEqual(undefined);

      expect(resource.loading.value).toBe(true);
      deferred.resolve(0);

      await expect(deferred.promise).resolves.toEqual(0);

      expect(resourceSpy).toHaveBeenLastCalledWith(0);
      expect(resourceSpy).toHaveBeenCalledOnce();
      source.value = 1;
      expect(resourceSpy).toHaveBeenCalledTimes(2);
      expect(resourceSpy).toHaveBeenLastCalledWith(1);

      source.value = 2;
      expect(resourceSpy).toHaveBeenCalledTimes(3);
      expect(resourceSpy).toHaveBeenLastCalledWith(2);
    });
  });
});
