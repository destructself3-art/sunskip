// Assembles src/ into two single-file builds:
//   index.html      — standalone page (open locally or host anywhere)
//   dist/artifact.html — the same page without the document wrapper, for claude.ai artifacts
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const src = (p) => readFileSync(join(root, 'src', p), 'utf8');
const js = readdirSync(join(root, 'src', 'js')).filter((f) => f.endsWith('.js')).sort().map((f) => `/* ---- ${f} ---- */\n` + src('js/' + f)).join('\n');

const fonts = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Dela+Gothic+One&family=M+PLUS+Rounded+1c:wght@500;700;800&display=swap">';
const style = `<style>\n${src('style.css')}\n</style>`;
const icon = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="18" r="11" fill="#FF7A6B" stroke="#2F2A55" stroke-width="3"/><path d="M3 22h26" stroke="#2F2A55" stroke-width="3" stroke-linecap="round"/><path d="M16 4l4 5-4 5-4-5z" fill="#FFE07A" stroke="#2F2A55" stroke-width="2"/></svg>');
const head = `<title>Sunskip</title>
<meta name="description" content="Sunskip: a pastel 3D runner over a tiny moon. Skim the dunes, graze the crystals, beat today's run.">
<meta name="theme-color" content="#FFF3E2">
<link rel="icon" href="${icon}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
${fonts}
${style}`;
// the artifact viewer adds its own document wrapper, charset and viewport
const artifactHead = `<title>Sunskip</title>\n${fonts}\n${style}`;
const body = `${src('body.html')}
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/0.149.0/three.min.js"></script>
<script>
${js}
</script>`;

const full = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
${head}
</head>
<body>
${body}
</body>
</html>
`;
writeFileSync(join(root, 'index.html'), full);
mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist', 'artifact.html'), artifactHead + '\n' + body + '\n');
console.log('built', (full.length / 1024).toFixed(1) + ' KB');
