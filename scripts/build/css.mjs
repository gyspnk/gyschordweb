import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { transformSync } from "esbuild";

const root = process.cwd();
const tailwindLayerPath = join(root, "_test_temp", "tailwind-layer.css");
const outputPath = join(root, "docs", "css", "tailwind.css");

const legacySources = [
  "docs/css/01-fonts.css",
  "docs/css/02-theme.css",
  "docs/css/03-layout.css",
  "docs/css/04-viewer.css",
  "docs/css/05-components.css",
  "docs/css/06-help.css",
  "docs/css/07-responsive.css",
  "docs/css/08-animations.css",
  "docs/css/09-scaling.css",
  "docs/css/10-toast.css",
];

mkdirSync(join(root, "_test_temp"), { recursive: true });

execSync("npm run build:css:tailwind", {
  cwd: root,
  stdio: "inherit",
});

const sections = [];

for (const relativePath of legacySources) {
  const fullPath = join(root, relativePath);
  const css = readFileSync(fullPath, "utf8").trim();
  sections.push(css);
}

const tailwindLayer = readFileSync(tailwindLayerPath, "utf8").trim();
sections.push(tailwindLayer);

const combinedCss = `${sections.join("\n\n")}\n`;
const { code: outputCss } = transformSync(combinedCss, {
  loader: "css",
  minify: true,
  legalComments: "none",
  target: ["es2019"],
});
writeFileSync(outputPath, outputCss, "utf8");

console.log(`Built CSS bundle at ${outputPath}`);
console.log(`Bundle size: ${(outputCss.length / 1024).toFixed(1)} KB`);
