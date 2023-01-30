/*! Copyright (c) Meta Platforms, Inc. and affiliates. **/
const REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref");
const REACT_MEMO_TYPE = Symbol.for("react.memo");
let allFamiliesByID = /* @__PURE__ */ new Map();
let allFamiliesByType = /* @__PURE__ */ new WeakMap();
let allSignaturesByType = /* @__PURE__ */ new WeakMap();
let updatedFamiliesByType = /* @__PURE__ */ new WeakMap();
let pendingUpdates = [];
let helpersByRendererID = /* @__PURE__ */ new Map();
let helpersByRoot = /* @__PURE__ */ new Map();
let mountedRoots = /* @__PURE__ */ new Set();
let failedRoots = /* @__PURE__ */ new Set();
let rootElements = /* @__PURE__ */ new WeakMap();
let isPerformingRefresh = false;
function computeFullKey(signature) {
  if (signature.fullKey !== null) {
    return signature.fullKey;
  }
  let fullKey = signature.ownKey;
  let hooks;
  try {
    hooks = signature.getCustomHooks();
  } catch (err) {
    signature.forceReset = true;
    signature.fullKey = fullKey;
    return fullKey;
  }
  for (let i = 0; i < hooks.length; i++) {
    let hook = hooks[i];
    if (typeof hook !== "function") {
      signature.forceReset = true;
      signature.fullKey = fullKey;
      return fullKey;
    }
    let nestedHookSignature = allSignaturesByType.get(hook);
    if (nestedHookSignature === void 0) {
      continue;
    }
    let nestedHookKey = computeFullKey(nestedHookSignature);
    if (nestedHookSignature.forceReset) {
      signature.forceReset = true;
    }
    fullKey += "\n---\n" + nestedHookKey;
  }
  signature.fullKey = fullKey;
  return fullKey;
}
function haveEqualSignatures(prevType, nextType) {
  let prevSignature = allSignaturesByType.get(prevType);
  let nextSignature = allSignaturesByType.get(nextType);
  if (prevSignature === void 0 && nextSignature === void 0) {
    return true;
  }
  if (prevSignature === void 0 || nextSignature === void 0) {
    return false;
  }
  if (computeFullKey(prevSignature) !== computeFullKey(nextSignature)) {
    return false;
  }
  if (nextSignature.forceReset) {
    return false;
  }
  return true;
}
function isReactClass(type) {
  return type.prototype && type.prototype.isReactComponent;
}
function canPreserveStateBetween(prevType, nextType) {
  if (isReactClass(prevType) || isReactClass(nextType)) {
    return false;
  }
  if (haveEqualSignatures(prevType, nextType)) {
    return true;
  }
  return false;
}
function resolveFamily(type) {
  return updatedFamiliesByType.get(type);
}
function getProperty(object, property) {
  try {
    return object[property];
  } catch (err) {
    return void 0;
  }
}
function performReactRefresh() {
  if (pendingUpdates.length === 0) {
    return null;
  }
  if (isPerformingRefresh) {
    return null;
  }
  isPerformingRefresh = true;
  try {
    let staleFamilies = /* @__PURE__ */ new Set();
    let updatedFamilies = /* @__PURE__ */ new Set();
    let updates = pendingUpdates;
    pendingUpdates = [];
    updates.forEach(function(_ref) {
      let family = _ref[0], nextType = _ref[1];
      let prevType = family.current;
      updatedFamiliesByType.set(prevType, family);
      updatedFamiliesByType.set(nextType, family);
      family.current = nextType;
      if (canPreserveStateBetween(prevType, nextType)) {
        updatedFamilies.add(family);
      } else {
        staleFamilies.add(family);
      }
    });
    let update = {
      updatedFamilies,
      staleFamilies
    };
    helpersByRendererID.forEach(function(helpers) {
      helpers.setRefreshHandler(resolveFamily);
    });
    let didError = false;
    let firstError = null;
    let failedRootsSnapshot = new Set(failedRoots);
    let mountedRootsSnapshot = new Set(mountedRoots);
    let helpersByRootSnapshot = new Map(helpersByRoot);
    failedRootsSnapshot.forEach(function(root) {
      let helpers = helpersByRootSnapshot.get(root);
      if (helpers === void 0) {
        throw new Error(
          "Could not find helpers for a root. This is a bug in React Refresh."
        );
      }
      if (!failedRoots.has(root)) {
      }
      if (!rootElements.has(root)) {
        return;
      }
      let element = rootElements.get(root);
      try {
        helpers.scheduleRoot(root, element);
      } catch (err) {
        if (!didError) {
          didError = true;
          firstError = err;
        }
      }
    });
    mountedRootsSnapshot.forEach(function(root) {
      let helpers = helpersByRootSnapshot.get(root);
      if (helpers === void 0) {
        throw new Error(
          "Could not find helpers for a root. This is a bug in React Refresh."
        );
      }
      if (!mountedRoots.has(root)) {
      }
      try {
        helpers.scheduleRefresh(root, update);
      } catch (err) {
        if (!didError) {
          didError = true;
          firstError = err;
        }
      }
    });
    if (didError) {
      throw firstError;
    }
    return update;
  } finally {
    isPerformingRefresh = false;
  }
}
function debounce(fn, delay) {
  let handle;
  return () => {
    clearTimeout(handle);
    handle = setTimeout(fn, delay);
  };
}
const enqueueUpdate = debounce(performReactRefresh, 16);
function register(type, id) {
  if (type === null) {
    return;
  }
  if (typeof type !== "function" && typeof type !== "object") {
    return;
  }
  if (allFamiliesByType.has(type)) {
    return;
  }
  let family = allFamiliesByID.get(id);
  if (family === void 0) {
    family = {
      current: type
    };
    allFamiliesByID.set(id, family);
  } else {
    pendingUpdates.push([family, type]);
  }
  allFamiliesByType.set(type, family);
  if (typeof type === "object" && type !== null) {
    switch (getProperty(type, "$$typeof")) {
      case REACT_FORWARD_REF_TYPE:
        register(type.render, id + "$render");
        break;
      case REACT_MEMO_TYPE:
        register(type.type, id + "$type");
        break;
    }
  }
}
function getRefreshReg(filename) {
  return (type, id) => register(type, filename + " " + id);
}
function setSignature(type, key, forceReset = false, getCustomHooks) {
  if (!allSignaturesByType.has(type)) {
    allSignaturesByType.set(type, {
      forceReset,
      ownKey: key,
      fullKey: null,
      getCustomHooks: getCustomHooks || function() {
        return [];
      }
    });
  }
  if (typeof type === "object" && type !== null) {
    switch (getProperty(type, "$$typeof")) {
      case REACT_FORWARD_REF_TYPE:
        setSignature(type.render, key, forceReset, getCustomHooks);
        break;
      case REACT_MEMO_TYPE:
        setSignature(type.type, key, forceReset, getCustomHooks);
        break;
    }
  }
}
function collectCustomHooksForSignature(type) {
  let signature = allSignaturesByType.get(type);
  if (signature !== void 0) {
    computeFullKey(signature);
  }
}
function injectIntoGlobalHook(globalObject) {
  let hook = globalObject.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  if (hook === void 0) {
    let nextID = 0;
    globalObject.__REACT_DEVTOOLS_GLOBAL_HOOK__ = hook = {
      renderers: /* @__PURE__ */ new Map(),
      supportsFiber: true,
      inject: function(injected) {
        return nextID++;
      },
      onScheduleFiberRoot: function(id, root, children) {
      },
      onCommitFiberRoot: function(id, root, maybePriorityLevel, didError) {
      },
      onCommitFiberUnmount: function() {
      }
    };
  }
  if (hook.isDisabled) {
    console["warn"](
      "Something has shimmed the React DevTools global hook (__REACT_DEVTOOLS_GLOBAL_HOOK__). Fast Refresh is not compatible with this shim and will be disabled."
    );
    return;
  }
  let oldInject = hook.inject;
  hook.inject = function(injected) {
    let id = oldInject.apply(this, arguments);
    if (typeof injected.scheduleRefresh === "function" && typeof injected.setRefreshHandler === "function") {
      helpersByRendererID.set(id, injected);
    }
    return id;
  };
  hook.renderers.forEach(function(injected, id) {
    if (typeof injected.scheduleRefresh === "function" && typeof injected.setRefreshHandler === "function") {
      helpersByRendererID.set(id, injected);
    }
  });
  let oldOnCommitFiberRoot = hook.onCommitFiberRoot;
  let oldOnScheduleFiberRoot = hook.onScheduleFiberRoot || function() {
  };
  hook.onScheduleFiberRoot = function(id, root, children) {
    if (!isPerformingRefresh) {
      failedRoots.delete(root);
      rootElements.set(root, children);
    }
    return oldOnScheduleFiberRoot.apply(this, arguments);
  };
  hook.onCommitFiberRoot = function(id, root, maybePriorityLevel, didError) {
    let helpers = helpersByRendererID.get(id);
    if (helpers !== void 0) {
      helpersByRoot.set(root, helpers);
      let current = root.current;
      let alternate = current.alternate;
      if (alternate !== null) {
        let wasMounted = alternate.memoizedState != null && alternate.memoizedState.element != null;
        let isMounted = current.memoizedState != null && current.memoizedState.element != null;
        if (!wasMounted && isMounted) {
          mountedRoots.add(root);
          failedRoots.delete(root);
        } else if (wasMounted && isMounted) {
        } else if (wasMounted && !isMounted) {
          mountedRoots.delete(root);
          if (didError) {
            failedRoots.add(root);
          } else {
            helpersByRoot.delete(root);
          }
        } else if (!wasMounted && !isMounted) {
          if (didError) {
            failedRoots.add(root);
          }
        }
      } else {
        mountedRoots.add(root);
      }
    }
    return oldOnCommitFiberRoot.apply(this, arguments);
  };
}
function createSignatureFunctionForTransform() {
  let savedType;
  let hasCustomHooks;
  let didCollectHooks = false;
  return function(type, key, forceReset, getCustomHooks) {
    if (typeof key === "string") {
      if (!savedType) {
        savedType = type;
        hasCustomHooks = typeof getCustomHooks === "function";
      }
      if (type != null && (typeof type === "function" || typeof type === "object")) {
        setSignature(type, key, forceReset, getCustomHooks);
      }
      return type;
    } else {
      if (!didCollectHooks && hasCustomHooks) {
        didCollectHooks = true;
        collectCustomHooksForSignature(savedType);
      }
    }
  };
}
function isLikelyComponentType(type) {
  switch (typeof type) {
    case "function": {
      if (type.prototype != null) {
        if (type.prototype.isReactComponent) {
          return true;
        }
        const ownNames = Object.getOwnPropertyNames(type.prototype);
        if (ownNames.length > 1 || ownNames[0] !== "constructor") {
          return false;
        }
        if (type.prototype.__proto__ !== Object.prototype) {
          return false;
        }
      }
      const name = type.name || type.displayName;
      return typeof name === "string" && /^[A-Z]/.test(name);
    }
    case "object": {
      if (type != null) {
        switch (getProperty(type, "$$typeof")) {
          case REACT_FORWARD_REF_TYPE:
          case REACT_MEMO_TYPE:
            return true;
          default:
            return false;
        }
      }
      return false;
    }
    default: {
      return false;
    }
  }
}
function validateRefreshBoundaryAndEnqueueUpdate(prevExports, nextExports) {
  if (!predicateOnExport(prevExports, (key) => !!nextExports[key])) {
    return "Could not Fast Refresh (export removed)";
  }
  let hasExports = false;
  const allExportsAreComponentsOrUnchanged = predicateOnExport(
    nextExports,
    (key, value) => {
      hasExports = true;
      if (isLikelyComponentType(value))
        return true;
      if (!prevExports[key])
        return false;
      return prevExports[key] === nextExports[key];
    }
  );
  if (hasExports && allExportsAreComponentsOrUnchanged) {
    enqueueUpdate();
  } else {
    return "Could not Fast Refresh. Learn more at https://github.com/vitejs/vite-plugin-react-swc#consistent-components-exports";
  }
}
function predicateOnExport(moduleExports, predicate) {
  for (const key in moduleExports) {
    if (key === "__esModule")
      continue;
    const desc = Object.getOwnPropertyDescriptor(moduleExports, key);
    if (desc && desc.get)
      return false;
    if (!predicate(key, moduleExports[key]))
      return false;
  }
  return true;
}
var refresh_runtime_default = {
  getRefreshReg,
  injectIntoGlobalHook,
  createSignatureFunctionForTransform,
  validateRefreshBoundaryAndEnqueueUpdate
};
export {
  createSignatureFunctionForTransform,
  refresh_runtime_default as default,
  getRefreshReg,
  injectIntoGlobalHook,
  validateRefreshBoundaryAndEnqueueUpdate
};
