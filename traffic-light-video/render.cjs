// Renders scene.html frame-by-frame in headless Chromium and pipes JPEGs into ffmpeg.
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const path = require('node:path');

(async () => {

const FPS = 30, out = process.argv[2] || 'safesignal.mp4';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => { console.error(e); process.exit(1); });
await page.goto('file://' + path.join(__dirname, 'scene.html'));
const duration = await page.evaluate(() => window.DURATION);
const ff = spawn('ffmpeg', ['-y', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
for (let f = 0; f < duration * FPS; f++) {
  await page.evaluate(t => window.render(t), f / FPS);
  ff.stdin.write(await page.screenshot({ type: 'jpeg', quality: 92 }));
  if (f % 150 === 0) console.log(`frame ${f}/${duration * FPS}`);
}
ff.stdin.end();
await new Promise(r => ff.on('close', r));
await browser.close();
})();
