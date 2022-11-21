import defer from 'p-defer';
import { describe, expect, expectTypeOf, test, vi } from 'vitest';
import { createEffect, createSignal } from '../src';
import { createResource, type Resource } from '../src/resource';

describe('Resource', () => {
  describe('without source', () => {
    test('it works', async () => {
      const deferred = defer<string>();
      const resourceSpy = vi.fn(() => deferred.promise);

      const resource = createResource(resourceSpy);
      expectTypeOf(resource).toEqualTypeOf<Resource<string>>();

      let message: string | undefined = '';

      const effectSpy = vi.fn(() => {
        message = resource.value;
      });

      createEffect(effectSpy);

      expect(message).toEqual(undefined);

      expect(resource.loading).toBe(true);

      deferred.resolve('foo');

      expect(effectSpy).toHaveBeenCalledOnce();

      await expect(deferred.promise).resolves.toEqual('foo');

      expect(effectSpy).toHaveBeenCalledTimes(2);
      expect(message).toEqual('foo');

      expect(resource.loading).toBe(false);
    });

    test('with error', async () => {
      const d = defer();
      const resourceSpy = vi.fn(() => d.promise);

      const resource = createResource(resourceSpy);

      expect(resource.loading).toBe(true);

      d.reject('error');

      await expect(d.promise).rejects.toThrow('error');
      expect(resource.error).toEqual('error');
      expect(resource.loading).toBe(false);
    });
  });

  describe('with source', () => {
    test('it reruns on source update', async () => {
      const source = createSignal(0);
      const deferred = defer<number>();

      const resourceSpy = vi.fn(() => {
        return deferred.promise;
      });

      const resource = createResource(source, resourceSpy);
      expect(resourceSpy).toHaveBeenCalledOnce();

      let message: number | undefined;

      const effectSpy = vi.fn(() => {
        message = resource.value;
      });

      createEffect(effectSpy);

      expect(message).toEqual(undefined);

      expect(resource.loading).toBe(true);
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

    test('it does not run when source is null, false, or undefined', async () => {
      const source = createSignal(null);
      const deferred = defer<number>();

      const resourceSpy = vi.fn(() => {
        return deferred.promise;
      });

      const resource = createResource(source, resourceSpy);
      // At this point, nothing should happen because the source is null
      expect(resourceSpy).not.toHaveBeenCalled();
      expect(resource.loading).toBe(false);

      source.value = 1;

      // Now that we've set the value to something eligible for a run, everything should suddenly
      // start running
      expect(resource.loading).toBe(true);
      expect(resourceSpy).toHaveBeenCalledOnce();
      expect(resourceSpy).toHaveBeenLastCalledWith(1);
      deferred.resolve(0);
      await expect(deferred.promise).resolves.toEqual(0);

      source.value = false;

      // updating the source to another ineligible value should not change anything, all the
      // prior assertions should still pass
      expect(resource.loading).toBe(false);
      expect(resourceSpy).toHaveBeenCalledOnce();
      expect(resourceSpy).toHaveBeenLastCalledWith(1);
    });
  });
});