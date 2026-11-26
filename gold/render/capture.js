// Drives render/index.html in headless Chromium and pipes frames to ffmpeg.
//   node capture.js stills <outdir> <frame> [frame...]
//   node capture.js video  <out.mp4> <startFrame> <endFrame>
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.otf': 'font/otf', '.ttf': 'font/ttf' };

function serve() {
  const server = http.createServer((req, res) => {
    const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!p.startsWith(ROOT) || !fs.existsSync(p)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
    fs.createReadStream(p).pipe(res);
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => r(server)));
}

(async () => {
  const [mode, out, ...rest] = process.argv.slice(2);
  const server = await serve();
  const port = server.address().port;
  const browser = await chromium.launch({ args: ['--font-render-hinting=none'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('console', m => { if (m.type() === 'error') console.error('[page]', m.text()); });
  page.on('pageerror', e => console.error('[pageerror]', e.message));
  await page.goto(`http://127.0.0.1:${port}/render/index.html?theme=${process.env.THEME || 'cream'}`);
  await page.waitForFunction('window.READY === true', null, { timeout: 180000 });

  if (mode === 'stills') {
    fs.mkdirSync(out, { recursive: true });
    for (const f of rest.map(Number)) {
      const b64 = await page.evaluate(i => { renderFrame(i); return document.getElementById('c').toDataURL('image/png').slice(22); }, f);
      fs.writeFileSync(path.join(out, `f${String(f).padStart(5, '0')}.png`), Buffer.from(b64, 'base64'));
    }
  } else {
    const start = Number(rest[0]), end = Number(rest[1]);
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '60', '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '15', '-pix_fmt', 'yuv420p', '-r', '60', out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const t0 = Date.now();
    for (let i = start; i < end; i++) {
      const b64 = await page.evaluate(i => { renderFrame(i); return document.getElementById('c').toDataURL('image/jpeg', 0.96).slice(23); }, i);
      const buf = Buffer.from(b64, 'base64');
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if ((i - start) % 300 === 0) console.log(`[${path.basename(out)}] frame ${i} (${((Date.now() - t0) / Math.max(1, i - start)).toFixed(1)} ms/f)`);
    }
    ff.stdin.end();
    await new Promise(r => ff.on('close', r));
  }
  await browser.close();
  server.close();
})().catch(e => { console.error(e); process.exit(1); });
