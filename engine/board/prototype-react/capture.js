async (page) => {
  const out = '/Users/dinq/Dinq/PROJECTS/celetis/.claude/worktrees/prototype-board-react/docs/superpowers/captures/';
  const base = 'http://127.0.0.1:4471/';
  const result = {};
  for (const variant of ['current', 'A']) {
    for (const [w, h] of [[1440, 900], [375, 812]]) {
      for (const state of ['operations-rest', 'operations-stop-dialog', 'operations-palette']) {
        const p = await page.context().newPage();
        await p.setViewportSize({ width: w, height: h });
        const errors = [];
        p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
        p.on('pageerror', (e) => errors.push(e.message));
        await p.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI)); });
        if (variant === 'current') {
          await p.goto(base);
          await p.waitForSelector('#columns article.card', { timeout: 15000, state: 'attached' });
        } else {
          await p.goto(`${base}?variant=A&state=${state}`);
          await p.waitForSelector('article', { timeout: 15000, state: 'attached' }).catch(() => {});
        }
        await p.evaluate(() => document.fonts.ready);
        await p.waitForTimeout(700);
        if (variant === 'current' && state === 'operations-stop-dialog')
          await p.evaluate(() => { const card = document.querySelector('.col-running article.card'); const n = card?.querySelector('.num')?.textContent ?? '#332'; const step = card?.querySelector('.status .detail.mono')?.textContent ?? 'implement'; document.getElementById('stop-title').textContent = `Stop the ${step} session of ${n}?`; document.getElementById('stop-dialog').showModal(); });
        if (variant === 'current' && state === 'operations-palette') await p.keyboard.press('ControlOrMeta+k');
        if (variant === 'A') await p.evaluate(() => { const bar = document.getElementById('prototype-bar'); if (bar) bar.style.display = 'none'; });
        await p.waitForTimeout(500);
        const name = `${variant}-${state}-${w}x${h}.png`;
        await p.screenshot({ path: out + name });
        result[name] = { csp: (await p.evaluate(() => window.__csp)).length, styles: await p.evaluate(() => document.querySelectorAll('style').length), errors };
        await p.close();
      }
    }
  }
  return result;
}
