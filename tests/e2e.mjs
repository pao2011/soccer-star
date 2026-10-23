// Prueba de extremo a extremo en Chromium sin interfaz. Requiere: npm i -D playwright  y  npm start (puerto 5173).
// CHROMIUM_PATH opcional para usar un Chromium ya instalado.
import { chromium } from 'playwright';

const URL = process.env.URL || 'http://localhost:5173/';
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
const page = await ctx.newPage(); const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
const ok = (c, msg) => { if (!c) { console.error('FALLO:', msg); process.exitCode = 1; } else console.log('ok -', msg); };

await page.goto(URL); await page.waitForFunction(() => window.__app);
await page.click('[data-go=create]'); await page.fill('#inName', 'Zoe'); await page.click('[data-act=createCareer]');
await page.click('button[data-act=startTutorial]'); await page.waitForTimeout(3000);
// controles reales: joystick y gesto de pase
await page.mouse.move(80, 700); await page.mouse.down(); await page.mouse.move(80, 630, { steps: 4 }); await page.waitForTimeout(1500); await page.mouse.up();
ok(await page.evaluate(() => window.__app.scene().m.hs.moved > 50), 'el joystick mueve al jugador');
const pb = await page.locator('#btnB').boundingBox();
await page.mouse.move(pb.x + 40, pb.y + 40); await page.mouse.down(); await page.mouse.move(pb.x, pb.y - 60, { steps: 5 }); await page.mouse.up(); await page.waitForTimeout(300);
ok(await page.evaluate(() => window.__app.scene().m.hs.passes >= 1), 'el gesto de pase golpea el balón');
await page.evaluate(() => window.__app.leaveMatch()); await page.evaluate(() => window.__app.ui.go('menu'));

// temporada completa (se fuerza el final de cada partido)
for (let i = 0; i < 10; i++) {
  await page.evaluate(() => window.__app.ui.go('career'));
  await page.click('[data-act=playNext]'); await page.click('[data-act=kickoff]'); await page.waitForTimeout(1200);
  await page.evaluate(() => window.__app.scene().m.finish());
  await page.waitForSelector('.res-head', { timeout: 8000 }); await page.click('[data-act=continue]'); await page.waitForTimeout(150);
}
ok(await page.evaluate(() => !!window.__app.save.career.seasonEnd), 'la temporada termina y muestra ofertas');
await page.click('[data-act=stay]');
ok(await page.evaluate(() => window.__app.save.career.season === 2), 'comienza la temporada 2');
await page.reload(); await page.waitForFunction(() => window.__app);
ok(await page.evaluate(() => window.__app.save.career.season === 2), 'el progreso sobrevive a la recarga');
await ctx.addInitScript(() => { if (!sessionStorage.getItem('c')) { sessionStorage.setItem('c', '1'); localStorage.setItem('mss_style_save', '{"v":1,"profile":{"name":3},"attrs":null}'); } });
await page.reload(); await page.waitForFunction(() => window.__app);
ok(await page.evaluate(() => !window.__app.save.profile && !!document.querySelector('.warn')), 'un guardado dañado no bloquea el juego');
ok(errs.length === 0, 'sin errores de consola ' + JSON.stringify(errs));
await b.close();
