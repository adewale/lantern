import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { launch } from '../tools/lib/browser.ts';
import { measure } from '../tools/lib/bench-measure.ts';

for (const corrupt of [false, true]) test(corrupt ? 'benchmark refuses corrupt observer data' : 'benchmark observes real click blocking, stage writes and resting events', { skip: !process.env.EXPLAIN_BROWSER }, async () => {
  const html = '<!doctype html><div class="stage"><span>one</span></div><div class="stepper"><button class="primary">Next</button></div><div class="steps"><button data-step="one">one</button><button data-step="two">two</button><button data-step="three">three</button></div><script>' +
    'const finish=n=>requestAnimationFrame(()=>setTimeout(()=>document.dispatchEvent(new CustomEvent("rayner:step",{detail:{step:n}})),0));' +
    'document.querySelector(".primary").onclick=()=>{const start=performance.now();while(performance.now()-start<120){}document.querySelector(".stage span").textContent="two";finish("two")};' +
    'document.querySelector(".steps button:last-child").onclick=()=>{document.querySelector(".stage span").textContent="three";' + (corrupt ? 'window.__bench.shifts.push([NaN,1]);' : '') + 'finish("three")};' +
    'requestAnimationFrame(()=>requestAnimationFrame(()=>document.documentElement.dataset.ready="true"));' +
    '</script>';
  const server = createServer((_, res) => { res.setHeader('Content-Type', 'text/html'); res.end(html); });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const browser = await launch();
  try {
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    if (corrupt) {
      await assert.rejects(measure(browser, 'http://127.0.0.1:' + address.port, { cpu: 1, readMs: 0 }), /invalid trace observation/);
      return;
    }
    const sample = await measure(browser, 'http://127.0.0.1:' + address.port, { cpu: 1, readMs: 0 });
    assert.ok(sample.ready > 0);
    assert.ok(sample.motion >= 100, JSON.stringify(sample));
    assert.ok(sample.rest >= sample.motion);
    // A frame gap is clipped to the click→rest window, so the 120 ms busy loop
    // need not leave an 80 ms gap when its first/last frames straddle that window.
    assert.ok(sample.gap > 50, JSON.stringify(sample));
    assert.ok(sample.blocking >= 40, JSON.stringify(sample));
    assert.ok(sample.blocking <= sample.rest + sample.jump);
    assert.equal(sample.shift, 0);
  } finally {
    await browser.close();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
