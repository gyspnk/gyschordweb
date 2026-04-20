import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { transformSync } from "esbuild";

const root = process.cwd();

const orderedSources = [
  "docs/js/midi-engine.js",
  "docs/js/app-core.js",
  "docs/js/viewer-core.js",
  "docs/js/ui-core.js",
  "docs/js/playlist-core.js",
  "docs/js/media-session.js",
];

const outputPath = join(root, "docs", "js", "app.bundle.min.js");

const bundleSource = orderedSources
  .map((relativePath) => {
    const fullPath = join(root, relativePath);
    return readFileSync(fullPath, "utf8").trim();
  })
  .join("\n;\n");

const { code } = transformSync(bundleSource, {
  loader: "js",
  minify: true,
  legalComments: "none",
  target: ["es2019"],
  charset: "utf8",
});

writeFileSync(outputPath, `${code}\n`, "utf8");

const extraRuntimeTargets = [
  {
    input: "docs/js/midi-render-worker.js",
    output: "docs/js/midi-render-worker.min.js",
  },
  {
    input: "docs/sw.js",
    output: "docs/sw.min.js",
  },
];

for (const target of extraRuntimeTargets) {
  const fullInputPath = join(root, target.input);
  const fullOutputPath = join(root, target.output);
  const source = readFileSync(fullInputPath, "utf8");
  const { code: minifiedCode } = transformSync(source, {
    loader: "js",
    minify: true,
    legalComments: "none",
    target: ["es2019"],
    charset: "utf8",
  });
  writeFileSync(fullOutputPath, `${minifiedCode}\n`, "utf8");
}

console.log(`Built JS bundle at ${outputPath}`);
console.log(`Bundle size: ${(code.length / 1024).toFixed(1)} KB`);
console.log("Built minified runtime files: docs/js/midi-render-worker.min.js, docs/sw.min.js");
