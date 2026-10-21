import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('./'); });

test('chargement sans erreur, phase initiale et projections', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.reload();
  await expect(page).toHaveTitle('Phase Lab — Explorer le déphasage');
  await expect(page.locator('#status')).toHaveText('Quadrature');
  await expect(page.locator('#circles')).toContainText('sA = 2 cm');
  await expect(page.locator('#circles')).toContainText('sB = 0 cm');
  await expect(page.locator('#metrics')).toContainText('−0,25'.replace('−','-'));
  expect(errors).toEqual([]);
});

test('les expériences règlent réellement les signaux', async ({ page }) => {
  await page.getByRole('button', {name:'En phase 0',exact:true}).click();
  await expect(page.locator('#status')).toHaveText('En phase');
  await expect(page.locator('#circles')).toContainText('sB = 2 cm');
  await page.getByRole('button', {name:'Opposition π',exact:true}).click();
  await expect(page.locator('#status')).toHaveText('Opposition de phase');
  await expect(page.locator('#circles')).toContainText('sB = -2 cm');
  await page.getByRole('button', {name:'B en retard −π/2',exact:true}).click();
  await expect(page.locator('#explanation-text')).toContainText('en retard');
  await page.getByRole('button', {name:'Un tour complet 2π',exact:true}).click();
  await expect(page.locator('#status')).toHaveText('En phase');
  await expect(page.locator('#metrics')).toContainText('réduit : 0°');
  await expect(page.locator('#metrics')).toContainText('-1 s');
});

test('mode onde : distance conservée après un changement de fréquence ou célérité', async ({ page }) => {
  await page.locator('#mode').selectOption('wave');
  await expect(page.locator('#phase-control')).toBeHidden();
  await page.getByRole('button', {name:'Une onde λ',exact:true}).click();
  await expect(page.locator('#distance-number')).toHaveValue('2');
  await expect(page.locator('#status')).toHaveText('En phase');
  await expect(page.locator('#explanation-text')).toContainText('un nombre entier de cycles');
  await page.locator('#frequency').fill('2');
  await expect(page.locator('#distance-number')).toHaveValue('2');
  await expect(page.locator('#distance-ratio')).toHaveText('2 λ');
  await page.locator('#velocity').fill('4');
  await expect(page.locator('#distance-number')).toHaveValue('2');
  await expect(page.locator('#distance-ratio')).toHaveText('1 λ');
});

test('pause, reprise et pas à pas partagent le même instant', async ({ page }) => {
  await page.getByRole('button',{name:'Avancer de T/24'}).click();
  await expect(page.locator('#time-output')).toHaveText('0,042 s');
  await expect(page.locator('#circles')).toContainText('A · θ = 15°');
  const before = await page.locator('#scope .sample-point').first().getAttribute('cy');
  await page.getByRole('button',{name:'Reprendre la lecture'}).click();
  await expect.poll(async () => page.locator('#scope .sample-point').first().getAttribute('cy')).not.toBe(before);
  await page.getByRole('button',{name:'Mettre en pause'}).click();
  const t = await page.locator('#time-output').textContent();
  await page.waitForTimeout(150);
  await expect(page.locator('#time-output')).toHaveText(t!);
  await page.getByRole('button',{name:'Réinitialiser le temps'}).click();
  await expect(page.locator('#time-output')).toHaveText('0 s');
});

test('les onglets et les curseurs sont accessibles au clavier', async ({ page }) => {
  await page.getByRole('tab',{name:'Vue synchronisée'}).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab',{name:'Oscilloscope',exact:true})).toHaveAttribute('aria-selected','true');
  await expect(page.locator('#circles-panel')).toBeHidden();
  await page.locator('#time-scrub').fill('500');
  await expect(page.locator('#time-output')).toHaveText('1 s');
  await page.locator('#measure1-input').fill('10');
  await page.locator('#measure2-input').fill('60');
  await expect(page.locator('#measurement')).toHaveText('Curseurs : Δt = 1 s · 1 T');
});

test('canaux, base de temps et échelle verticale', async ({ page }) => {
  await expect(page.locator('#scope .signal')).toHaveCount(2);
  await page.locator('#show-a').uncheck();
  await expect(page.locator('#scope .signal')).toHaveCount(1);
  await page.locator('#show-b').uncheck();
  await expect(page.locator('#scope .signal')).toHaveCount(0);
  await page.locator('#periods').selectOption('3');
  await page.locator('#time-base').selectOption('2');
  await expect(page.locator('#measurement')).toContainText('2,1 s');
  await page.locator('#vertical').selectOption('2');
  await page.locator('#show-a').check();
  await expect(page.locator('#scope .signal')).toHaveCount(1);
});

test('saisie décimale, bornes et restauration', async ({ page }) => {
  await page.locator('#phase-number').fill('-450');
  await expect(page.locator('#status')).toHaveText('Quadrature');
  await expect(page.locator('#metrics')).toContainText('1,25 s');
  await page.locator('#mode').selectOption('wave');
  await page.locator('#distance-number').fill('0.75');
  await expect(page.locator('#distance-ratio')).toHaveText('0,38 λ');
  await page.getByRole('button',{name:'Restaurer les paramètres initiaux'}).click();
  await expect(page.locator('#mode')).toHaveValue('phase');
  await expect(page.locator('#phase-number')).toHaveValue('90');
  await expect(page.locator('#time-output')).toHaveText('0 s');
});

test('glisser B sur le cercle ajuste sa phase en pause', async ({ page }) => {
  const svg = page.locator('#circles svg');
  const bounds = (await svg.boundingBox())!;
  const point = page.locator('[data-drag="phase"]');
  await point.hover(); await page.mouse.down();
  await page.mouse.move(bounds.x + 528/876 * bounds.width, bounds.y + 119/300 * bounds.height,{steps:5});
  await page.mouse.up();
  expect(Number(await page.locator('#phase-number').inputValue())).toBeCloseTo(0,0);
  await expect(page.locator('#status')).toHaveText('En phase');
});

test('glisser B dans l’espace change d et conserve les projections', async ({ page }) => {
  await page.locator('#mode').selectOption('wave');
  const bounds=(await page.locator('#wave svg').boundingBox())!;
  await page.locator('[data-drag="distance"]').hover();await page.mouse.down();
  await page.mouse.move(bounds.x + (66 + 774/2.2)/876 * bounds.width,bounds.y + 100/296 * bounds.height,{steps:5});await page.mouse.up();
  expect(Number(await page.locator('#distance-number').inputValue())).toBeCloseTo(2,1);
  await expect(page.locator('#status')).toHaveText('En phase');
});

test('vitesse de lecture indépendante des grandeurs physiques', async ({ page }) => {
  const metrics=await page.locator('#metrics').textContent();
  await page.locator('#speed').selectOption('2');
  await expect(page.locator('#metrics')).toHaveText(metrics!);
});

test('mode présentation fonctionnel, sortie par Échap', async ({ page }) => {
  await page.locator('#presentation').click();
  await expect(page.locator('body')).toHaveClass('presentation');
  await expect(page.locator('.scope-tools')).toBeHidden();
  await expect(page.locator('#presets')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('body')).not.toHaveClass('presentation');
});

for (const width of [320,390,768,1440]) test(`mise en page sans débordement à ${width}px`, async ({ page }) => {
  await page.setViewportSize({width,height:900});await page.reload();
  if(width<=760){await expect(page.locator('#parameters')).not.toHaveAttribute('open','');await page.locator('#parameters summary').click();}
  await page.locator('#mode').selectOption('wave');
  for(const view of ['Vue synchronisée','Oscilloscope','Cercles de phase','Onde progressive']) {
    await page.getByRole('tab',{name:view,exact:true}).click();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
});
