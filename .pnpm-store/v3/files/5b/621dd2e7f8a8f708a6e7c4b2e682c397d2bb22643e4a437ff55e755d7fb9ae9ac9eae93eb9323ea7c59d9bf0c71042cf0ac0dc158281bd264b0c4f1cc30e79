// src/index.ts
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { transform } from "@swc/core";
var runtimePublicPath = "/@react-refresh";
var preambleCode = `import { injectIntoGlobalHook } from "__PATH__";
injectIntoGlobalHook(window);
window.$RefreshReg$ = () => {};
window.$RefreshSig$ = () => (type) => type;`;
var _dirname = typeof __dirname !== "undefined" ? __dirname : dirname(fileURLToPath(import.meta.url));
var refreshContentRE = /\$Refresh(?:Reg|Sig)\$\(/;
var react = (options) => [
  {
    name: "vite:react-swc",
    apply: "serve",
    config: () => ({
      esbuild: false,
      optimizeDeps: { include: ["react/jsx-dev-runtime"] }
    }),
    resolveId: (id) => id === runtimePublicPath ? id : void 0,
    load: (id) => id === runtimePublicPath ? readFileSync(join(_dirname, "refresh-runtime.js"), "utf-8") : void 0,
    transformIndexHtml: (_, config) => [
      {
        tag: "script",
        attrs: { type: "module" },
        children: preambleCode.replace(
          "__PATH__",
          config.server.config.base + runtimePublicPath.slice(1)
        )
      }
    ],
    async transform(code, _id, transformOptions) {
      const id = _id.split("?")[0];
      if (id.includes("node_modules"))
        return;
      const parser = id.endsWith(".tsx") ? { syntax: "typescript", tsx: true } : id.endsWith(".ts") ? { syntax: "typescript", tsx: false } : id.endsWith(".jsx") ? { syntax: "ecmascript", jsx: true } : void 0;
      if (!parser)
        return;
      let result;
      try {
        result = await transform(code, {
          filename: id,
          swcrc: false,
          configFile: false,
          sourceMaps: true,
          jsc: {
            target: "es2020",
            parser,
            transform: {
              useDefineForClassFields: true,
              react: {
                refresh: !(transformOptions == null ? void 0 : transformOptions.ssr),
                development: true,
                useBuiltins: true,
                runtime: "automatic",
                importSource: options == null ? void 0 : options.jsxImportSource
              }
            }
          }
        });
      } catch (e) {
        const message = e.message;
        const fileStartIndex = message.indexOf("\u256D\u2500[");
        if (fileStartIndex !== -1) {
          const match = message.slice(fileStartIndex).match(/:(\d+):(\d+)]/);
          if (match) {
            e.line = match[1];
            e.column = match[2];
          }
        }
        throw e;
      }
      if ((transformOptions == null ? void 0 : transformOptions.ssr) || !refreshContentRE.test(result.code)) {
        return result;
      }
      result.code = `import * as RefreshRuntime from "${runtimePublicPath}";
  
  if (!window.$RefreshReg$) throw new Error("React refresh preamble was not loaded. Something is wrong.");
  const prevRefreshReg = window.$RefreshReg$;
  const prevRefreshSig = window.$RefreshSig$;
  window.$RefreshReg$ = RefreshRuntime.getRefreshReg("${id}");
  window.$RefreshSig$ = RefreshRuntime.createSignatureFunctionForTransform;
  
  ${result.code}
  
  window.$RefreshReg$ = prevRefreshReg;
  window.$RefreshSig$ = prevRefreshSig;
  import.meta.hot.accept((nextExports) => {
  if (!nextExports) return;
  import(/* @vite-ignore */ import.meta.url).then((current) => {
    const invalidateMessage = RefreshRuntime.validateRefreshBoundaryAndEnqueueUpdate(current, nextExports);
    if (invalidateMessage) import.meta.hot.invalidate(invalidateMessage);
  });
});
  `;
      const sourceMap = JSON.parse(result.map);
      sourceMap.mappings = ";;;;;;;;" + sourceMap.mappings;
      return { code: result.code, map: sourceMap };
    }
  },
  {
    name: "vite:react-swc",
    apply: "build",
    config: () => ({
      esbuild: {
        jsx: "automatic",
        jsxImportSource: options == null ? void 0 : options.jsxImportSource,
        tsconfigRaw: { compilerOptions: { useDefineForClassFields: true } }
      }
    })
  }
];
var src_default = react;
export {
  src_default as default
};
