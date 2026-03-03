import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const isWatch = process.argv.includes('--watch');

mkdirSync('dist', { recursive: true });

const uiBuild = esbuild.context({
  entryPoints: ['src/ui.tsx'],
  bundle: true,
  minify: !isWatch,
  write: false,
  jsx: 'automatic',
  jsxImportSource: 'preact',
  format: 'esm',
  target: 'es2017',
  plugins: [{
    name: 'html-output',
    setup(build) {
      build.onEnd(result => {
        if (result.errors.length > 0) return;
        const js = result.outputFiles?.[0]?.text || '';
        const html = `<!DOCTYPE html>
<html>
<head>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #root { height: 100%; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script>${js}</script>
</body>
</html>`;
        writeFileSync('dist/ui.html', html);
        console.log('[ui] built');
      });
    },
  }],
});

const codeBuild = esbuild.context({
  entryPoints: ['src/code.ts'],
  bundle: true,
  minify: !isWatch,
  outfile: 'dist/code.js',
  format: 'cjs',
  target: 'es2017',
  plugins: [{
    name: 'log',
    setup(build) {
      build.onEnd(() => {
        console.log('[code] built');
      });
    },
  }],
});

async function run() {
  const [uiCtx, codeCtx] = await Promise.all([uiBuild, codeBuild]);

  if (isWatch) {
    await Promise.all([uiCtx.watch(), codeCtx.watch()]);
    console.log('watching for changes...');
  } else {
    await Promise.all([uiCtx.rebuild(), codeCtx.rebuild()]);
    await Promise.all([uiCtx.dispose(), codeCtx.dispose()]);
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
