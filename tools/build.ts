// Build the player into single-file pages:
//   out/site/index.html   Worker static asset (wrangler.toml)
//   out/demo.html         same page, open directly
//   out/artifact.html     same page without the document skeleton (claude.ai artifact)
//   --only=<scene>        one scene as its own page: out/<scene>.html and out/<scene>.artifact.html
// esbuild is a build-time tool only; the runtime has no dependencies.
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const root = new URL('../', import.meta.url).pathname;
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7) ?? null;
const t0 = performance.now();
const result = await build({
  entryPoints: [root + 'app/main.ts'],
  // The app project's compiler options (class fields with define semantics, as Node runs them)
  tsconfig: root + 'tsconfig.app.json',
  bundle: true, format: 'esm', platform: 'browser', target: 'es2022',
  minify: process.argv.includes('--minify'), write: false, legalComments: 'none',
  define: { __ONLY__: JSON.stringify(only) },
});
const js = result.outputFiles[0]!.text.replace(/<\/script/g, '<\\/script');
const css = readFileSync(root + 'app/player.css', 'utf8');
// The page loads ./main.js: the dev server serves app/main.ts under that name, the build inlines the bundle
const html = readFileSync(root + 'app/index.html', 'utf8')
  .replace('<link rel="stylesheet" href="./player.css">', () => `<style>${css}</style>`)
  .replace('<script type="module" src="./main.js"></script>', () => `<script type="module">${js}</script>`);
// The artifact is hosted elsewhere, so its guide points at the deployed Worker (app/guide.ts)
const artifact = '<title>lantern: animated, steppable code explainers</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n' +
  '<meta name="lantern:api" content="https://lantern.ivar.workers.dev">\n' +
  html.slice(html.indexOf('<link rel="preconnect"'), html.indexOf('</head>')) +
  html.slice(html.indexOf('<main>'), html.indexOf('</body>'));
mkdirSync(root + 'out/site', { recursive: true });
if (only) {
  writeFileSync(root + `out/${only}.html`, html);
  writeFileSync(root + `out/${only}.artifact.html`, artifact);
  console.log(`built in ${(performance.now() - t0).toFixed(0)} ms: out/${only}.html ${(html.length / 1024).toFixed(0)} KB`);
} else {
  writeFileSync(root + 'out/site/index.html', html);
  writeFileSync(root + 'out/demo.html', html);
  writeFileSync(root + 'out/artifact.html', artifact);
  console.log(`built in ${(performance.now() - t0).toFixed(0)} ms: out/demo.html ${(html.length / 1024).toFixed(0)} KB`);
}
