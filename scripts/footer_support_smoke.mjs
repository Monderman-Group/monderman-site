// Real published HTML/CSS with only navigation/support scripts enabled.
// Remote requests are blocked: this does not submit forms or start diagnostics.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, webkit } from 'playwright';
const root = path.resolve(process.env.SITE_SOURCE_DIR || '.render-public');
const output = path.resolve(process.env.FOOTER_TEST_OUTPUT || 'output/floating-support');
await fs.mkdir(output, { recursive: true });
const pages = [];
for (const file of (await fs.readdir(root)).filter(f => f.endsWith('.html'))) {
  const source = await fs.readFile(path.join(root, file), 'utf8');
  if (!/<footer\b[^>]*\bmond-footer\b/.test(source)) continue;
  const shell = /<body\b[^>]*\bcanonical-green-shell\b/.test(source);
  const html = source.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace('</body>',
    (shell ? '<script src="/assistant.js"></script><script src="/connect-widget.js"></script><script src="/canonical-site-shell.js"></script><script src="/first-run-telemetry.js"></script>' : '') + '</body>');
  pages.push({ file, shell, html });
}
assert.equal(pages.length, 65);
assert.equal(pages.filter(p => p.shell).length, 61);
const security = await fs.readFile(path.join(root, 'security.html'), 'utf8');
assert.ok(security.includes('id="administrative-device-protection"'));
assert.ok(security.includes('are not covered by this device subscription'));
const results = [], failures = [];
const shots = new Set(['index.html', 'research.html', 'platform-services.html', 'security.html', 'decision-velocity.html']);
for (const [engineName, engine] of Object.entries({ chromium, webkit })) {
  const browser = await engine.launch({ headless: true });
  try {
    const queue = pages.filter(p => !process.env.FOOTER_PAGE || p.file === process.env.FOOTER_PAGE).flatMap(p => [390, 768, 1440].map(width => ({ ...p, width })));
    queue.push({ ...pages.find(p => p.file === 'index.html'), width: 320 });
    for (const file of ['index.html','decision-velocity.html'])
      if (!process.env.FOOTER_PAGE || process.env.FOOTER_PAGE === file)
        queue.push({ ...pages.find(p => p.file === file), width:375 });
    await Promise.all(Array.from({ length: 4 }, async () => {
      while (queue.length) {
        const { file, shell, html, width } = queue.shift();
        const label = `${engineName}/${file}/${width}`;
        const page = await browser.newPage({ viewport: { width, height: 1024 }, reducedMotion: 'reduce' });
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        let blockedExternal = 0;
        await page.route('**/*', async route => {
          const url = new URL(route.request().url());
          if (url.hostname !== '127.0.0.1') { blockedExternal++; return route.abort(); }
          if (url.pathname === '/' + file) return route.fulfill({ contentType: 'text/html', body: html });
          const target = path.resolve(root, '.' + decodeURIComponent(url.pathname));
          if (!target.startsWith(root + path.sep)) return route.abort();
          try {
            const types = { '.js':'application/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.woff2':'font/woff2', '.woff':'font/woff' };
            return route.fulfill({ contentType: types[path.extname(target)] || 'application/octet-stream', body: await fs.readFile(target) });
          } catch { return route.fulfill({ status: 404, body: 'Missing fixture asset' }); }
        });
        const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        async function geometry() {
          await settle();
          return page.evaluate(() => {
            const rect = node => { const r = node.getBoundingClientRect(); return { left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height }; };
            return { footerTop: document.querySelector('.mond-footer').getBoundingClientRect().top,
              headerBottom: document.querySelector('#siteHeader')?.getBoundingClientRect().bottom || 0,
              controls: [...document.querySelectorAll('#mnd-launcher,.mdn-cn-launch')].map(node => ({
                ...rect(node), text:node.textContent.trim(), position:getComputedStyle(node).position,
                visible:getComputedStyle(node).visibility !== 'hidden' && getComputedStyle(node).display !== 'none'
              })) };
          });
        }
        function checkStack(g) {
          assert.equal(g.controls.length, 2, label + ': both native controls exist');
          for (const c of g.controls) {
            assert.equal(c.position, 'fixed', label + ': native floating control');
            assert.ok(c.height >= 48 && c.width >= 100, label + ': touch target');
            if (c.visible) assert.ok(c.left >= 0 && c.right <= width + 1 && c.top >= 0 && c.bottom <= Math.min(1024, g.footerTop - 15), label + ': viewport/footer clearance');
          }
          assert.deepEqual(g.controls.map(c => c.text), ['Chat', 'Connect']);
          const [a,b] = [...g.controls].sort((a,b) => a.top-b.top);
          assert.ok(Math.abs(a.right-b.right) <= 1 && Math.abs(a.width-b.width) <= 1 && b.top-a.bottom >= 11.5, label + ': balanced stack');
        }
        try {
          await page.goto('http://127.0.0.1/' + file, { waitUntil:'networkidle' });
          await page.evaluate(() => document.fonts.ready);
          assert.deepEqual(errors, [], label + ': support script errors');
          assert.equal(await page.locator('.mf-device-protection').innerText(), 'Administrative device protection: CrowdStrike Falcon');
          assert.equal(await page.locator('.mf-device-protection a').getAttribute('href'), 'security.html#administrative-device-protection');
          assert.ok(await page.locator('.mf-device-protection a').evaluate(n => {
            const link = getComputedStyle(n), paragraph = getComputedStyle(n.parentElement);
            return link.fontSize === paragraph.fontSize && link.lineHeight === paragraph.lineHeight && link.fontFamily === paragraph.fontFamily && link.letterSpacing === 'normal';
          }), label + ': device disclosure typography is isolated from legacy page link styles');
          assert.equal(await page.locator('.site-support,.site-widget-actions,.site-widget-action').count(), 0);
          if (shell) {
            const initial = await geometry();
            checkStack(initial);
            if (file === 'index.html') {
              assert.ok(initial.controls.every(c => c.visible), label + ': homepage controls visible');
              const chat = page.locator('#mnd-launcher'), connect = page.locator('.mdn-cn-launch');
              await chat.focus(); await page.keyboard.press('Enter');
              await page.locator('#mnd-panel.mnd-open').waitFor({state:'visible'});
              await page.locator('#mnd-close').click();
              assert.ok(await chat.evaluate(n => n === document.activeElement), label + ': Chat focus restored');
              await connect.click();
              await page.locator('#mdn-cn-panel.mdn-cn-open').waitFor({state:'visible'});
              await page.locator('.mdn-cn-close').click();
              assert.ok(await connect.evaluate(n => n === document.activeElement), label + ': Connect focus restored');
            }
            await page.evaluate(() => scrollTo({top:document.querySelector('.mond-footer').getBoundingClientRect().top + scrollY - (innerHeight - 40),behavior:'instant'}));
            checkStack(await geometry());
            if (shots.has(file)) await page.screenshot({ path:path.join(output, `${engineName}-${file}-${width}-floating.png`) });
            await page.evaluate(() => scrollTo({top:document.querySelector('.mond-footer').getBoundingClientRect().top + scrollY - 100,behavior:'instant'}));
            const nearTop = await geometry();
            checkStack(nearTop);
            if (nearTop.footerTop < nearTop.headerBottom + 140)
              assert.ok(nearTop.controls.every(c => !c.visible), label + ': controls hide when no space remains above footer');
          }
          await page.locator('.mond-footer').scrollIntoViewIfNeeded();
          const footer = await page.locator('.mond-footer').evaluate(n => {
            const r=n.getBoundingClientRect(), c=n.querySelector('.mf-device-protection').getBoundingClientRect();
            return {left:r.left,right:r.right,bottom:r.bottom,claimLeft:c.left,claimRight:c.right,claimBottom:c.bottom};
          });
          assert.ok(footer.left>=-1 && footer.right<=width+1 && footer.claimLeft>=0 && footer.claimRight<=width && footer.claimBottom<=footer.bottom, label+': footer containment');
          // Check the entire wrapped link as a real tap target, not just text bounds.
          if (!shell) await page.addStyleTag({content:'#pageLoader{display:none!important}'});
          const deviceLink=page.locator('.mf-device-protection a');
          await deviceLink.scrollIntoViewIfNeeded();
          assert.ok(await deviceLink.evaluate(n=>{
            const r=n.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
            return hit===n||n.contains(hit);
          }),label+': wrapped device link remains clickable');
          if (shots.has(file)) {
            await page.addStyleTag({content:'#siteHeader,.skip-link,#pageLoader{display:none!important}'});
            await page.locator('.mond-footer').screenshot({path:path.join(output,`${engineName}-${file}-${width}-footer.png`)});
          }
          await page.emulateMedia({media:'print'});
          if (shell) for (const selector of ['#mnd-launcher','#mdn-cn-root']) assert.equal(await page.locator(selector).evaluate(n=>getComputedStyle(n).display),'none',label+': no printed widget');
          results.push({label,passed:true,blockedExternal,footer});
        } catch(error) {
          console.error(label + ': ' + error.message);
          failures.push({label,error:error.message});
          await page.screenshot({path:path.join(output,`${engineName}-${file}-${width}-FAIL.png`)}).catch(()=>{});
        } finally { await page.close(); }
      }
    }));
  } finally { await browser.close(); }
}
await fs.writeFile(path.join(output,'results.json'),JSON.stringify({passed:failures.length===0,pages:pages.length,cases:results.length,failures,results},null,2));
console.log(JSON.stringify({passed:failures.length===0,cases:results.length,failures}));
assert.equal(failures.length,0,'Floating widget / footer regression checks');
