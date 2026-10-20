// Bundles the whole game into one self-contained HTML file: dist-single/glowmaze.html.
// The file has no <html>/<head>/<body> wrapper so it can be published as a claude.ai artifact;
// browsers open it directly as well.
import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const result = await build({
  entryPoints: ['src/main.ts'],
  bundle: true,
  format: 'iife',
  minify: true,
  target: 'es2020',
  write: false,
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = await readFile('src/style.css', 'utf8');
const html = await readFile('index.html', 'utf8');
const markup = html.match(/<!-- markup:start -->([\s\S]*?)<!-- markup:end -->/)?.[1].trim();
if (!markup) throw new Error('index.html is missing the markup:start / markup:end block');

const page = `<title>Glowmaze</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="description" content="A neon arcade maze chase with classic arcade rules.">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap">
<style>
${css}
</style>
${markup}
<script>
${js}
</script>
`;

await mkdir('dist-single', { recursive: true });
await writeFile('dist-single/glowmaze.html', page);
console.log(`dist-single/glowmaze.html  ${(page.length / 1024).toFixed(1)} kB`);
