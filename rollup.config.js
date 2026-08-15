import { resolve, dirname } from "path";
import esbuild from "rollup-plugin-esbuild";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import { visualizer } from "rollup-plugin-visualizer";

export const input = "./src/index.ts";

// Workaround for @rollup/plugin-node-resolve v16 not applying the package.json
// "browser" field file-level remappings for internal relative imports within
// transitive dependencies. Specifically, multiformats/esm/src/basics.js imports
// "./hashes/sha2.js" (Node.js version using `import crypto from 'crypto'`)
// instead of the browser-safe "./hashes/sha2-browser.js" (using Web Crypto API).
// This plugin runs before nodeResolve and redirects the import.
// Applies to multiformats <=9.x internal layout. Re-verify on upgrades.
// The failOnNodeBuiltins guard below will catch it if this workaround stops applying.
// See: https://github.com/WalletConnect/walletconnect-monorepo/issues/7197
const browserFieldOverrides = {
  name: "browser-field-overrides",
  resolveId(source, importer) {
    if (!importer || !source.startsWith(".")) return null;
    if (!importer.includes("node_modules/multiformats/")) return null;
    const resolved = resolve(dirname(importer), source);
    if (resolved.endsWith("/hashes/sha2.js")) {
      return resolved.replace("/hashes/sha2.js", "/hashes/sha2-browser.js");
    }
    return null;
  },
};

// Strip bare `new TextEncoder,new TextDecoder;` side-effect expressions that
// originate from multiformats (transitive dep of uint8arrays) after minification.
// These crash React Native / Hermes where TextDecoder is not a native global.
// See: https://github.com/WalletConnect/walletconnect-monorepo/issues/7214
const stripBareTextCodecs = {
  name: "strip-bare-text-codecs",
  renderChunk(code) {
    const stripped = code.replace(/new TextEncoder,new TextDecoder;?/g, "");
    return stripped !== code ? { code: stripped, map: null } : null;
  },
};

export const plugins = [
  browserFieldOverrides,
  nodeResolve({ preferBuiltins: false, browser: true, exportConditions: ["browser"] }),
  json(),
  commonjs(),
  esbuild({
    minify: true,
    tsconfig: "./tsconfig.json",
    loaders: {
      ".json": "json",
    },
  }),
  stripBareTextCodecs,
  visualizer(),
];

// Rollup's `external` option with a plain array only matches exact dependency names,
// so subpath imports like "uint8arrays/from-string" are not externalized and get bundled,
// pulling in transitive dependencies (e.g. multiformats -> Node.js crypto).
// This function returns a matcher that also externalizes subpath imports (dep + "/...").
export function isExternal(packageDependencies) {
  return (id) => packageDependencies.some((dep) => id === dep || id.startsWith(dep + "/"));
}

// Fail the UMD (browser) build if Node.js built-in modules are referenced.
// This catches regressions where transitive dependencies leak Node.js-only
// imports (e.g. "crypto", "fs", "path") into the browser bundle.
function failOnNodeBuiltins(warning, defaultHandler) {
  if (warning.code === "MISSING_NODE_BUILTINS") {
    throw new Error(warning.message);
  }
  if (warning.code === "UNRESOLVED_IMPORT" && warning.exporter && isNodeBuiltin(warning.exporter)) {
    throw new Error(`Node.js built-in "${warning.exporter}" imported by ${warning.id} — not allowed in browser bundles`);
  }
  defaultHandler(warning);
}

const NODE_BUILTINS = new Set([
  "assert", "buffer", "child_process", "cluster", "crypto", "dgram", "dns",
  "events", "fs", "http", "http2", "https", "net", "os", "path", "perf_hooks",
  "punycode", "querystring", "readline", "stream", "string_decoder", "tls",
  "tty", "url", "util", "v8", "vm", "worker_threads", "zlib",
]);

function isNodeBuiltin(id) {
  return NODE_BUILTINS.has(id) || NODE_BUILTINS.has(id.replace("node:", ""));
}

export default function createConfig(
  packageName,
  packageDependencies,
  umd = {},
  cjs = {},
  es = {},
  extraBuilds = [],
) {
  return [
    {
      input,
      plugins,
      onwarn: failOnNodeBuiltins,
      output: {
        file: "./dist/index.umd.js",
        format: "umd",
        exports: "named",
        name: packageName,
        sourcemap: true,
        ...umd,
      },
    },
    {
      input,
      plugins,
      external: isExternal(packageDependencies),
      output: [
        {
          file: "./dist/index.cjs",
          format: "cjs",
          exports: "named",
          interop: "auto",
          name: packageName,
          sourcemap: true,
          ...cjs,
        },
        {
          file: "./dist/index.js",
          format: "es",
          exports: "named",
          name: packageName,
          sourcemap: true,
          ...es,
        },
      ],
    },
    ...extraBuilds,
  ];
}
