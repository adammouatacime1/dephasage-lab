import { expect, test, type Page } from '@playwright/test';

const labels = ['0', 'λ/4', 'λ/2', '3λ/4', 'λ', '3λ/2', '2λ', '3λ'];
const preset = (page: Page, label: string) => page.locator('.dp-presets > button').nth(labels.indexOf(label));
const metric = (page: Page, label: string) => page.locator('.lk-metric').filter({ has: page.getByText(label, { exact: true }) });
const metricValue = (page: Page, label: string) => metric(page, label).locator('.lk-metric-value');
const input = (page: Page, label: string) => page.getByRole('spinbutton', { name: label, exact: true });
async function setNumber(page: Page, label: string, value: string) {
  await input(page, label).fill(value);
  await input(page, label).press('Enter');
}
async function dragMicrophone(page: Page, centimeters: number) {
  const microphone = page.getByRole('slider', { name: 'Position longitudinale du microphone M2', exact: true });
  await microphone.scrollIntoViewIfNeeded();
  const target = await microphone.evaluate((element, position) => {
    const svg = (element as SVGElement).ownerSVGElement!;
    const left = Number(svg.dataset.rulerLeft), right = Number(svg.dataset.rulerRight);
    const y = svg.viewBox.baseVal.width === 600 ? 219 : 172;
    const point = new DOMPoint(left + position / 200 * (right - left), y).matrixTransform(svg.getScreenCTM()!);
    return { x: point.x, y: point.y };
  }, centimeters);
  await microphone.hover();
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 8 });
  await page.mouse.up();
}

test.beforeEach(async ({ page }) => { await page.goto('./'); });

test('chargement français sans erreur et valeurs initiales : 13,3 cm, 34 cm, 1 000 Hz', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Le son, une question de phase.' })).toBeVisible();
  await expect(input(page, 'Position de M2')).toHaveValue('13.3');
  await expect(metricValue(page, 'Distance entre microphones')).toContainText('13,3');
  await expect(metricValue(page, 'Longueur d’onde')).toContainText('34');
  await expect(input(page, 'Fréquence du GBF')).toHaveValue('1000');
  await expect(metricValue(page, 'Période')).toContainText('1');
  await expect(page.getByTestId('physical-time')).toHaveText('t = 0 ms');
  await expect(page.getByRole('button', { name: 'Lancer la simulation' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('Δx = 0 : retard nul et voies identiques', async ({ page }) => {
  await preset(page, '0').click();
  await expect(metricValue(page, 'Retard total calculé')).toContainText('0');
  await expect(metricValue(page, 'Retard de phase total')).toContainText('0');
  await expect(page.locator('.lk-badge').filter({ hasText: /^En phase$/ })).toBeVisible();
  const trace1 = await page.getByTestId('trace-ch1').getAttribute('d');
  await expect(page.getByTestId('trace-ch2')).toHaveAttribute('d', trace1!);
});

test('Δx = λ/2 : opposition de phase et décalage d’une demi-période', async ({ page }) => {
  await preset(page, 'λ/2').click();
  await expect(input(page, 'Position de M2')).toHaveValue('17');
  await expect(page.locator('.lk-badge').filter({ hasText: /^Opposition de phase$/ })).toBeVisible();
  await expect(metricValue(page, 'Retard total calculé')).toContainText('0,5');
  await expect(metricValue(page, 'Retard de phase total')).toContainText('π');
  await expect(metricValue(page, 'Différence de phase signée')).toContainText('−π');
});

for (const [position, centimeters, periods] of [['λ', '34', 1], ['3λ', '102', 3]] as const) {
  test(`Δx = ${position} : en phase, mais retard total ${periods} T`, async ({ page }) => {
    await preset(page, position).click();
    await expect(input(page, 'Position de M2')).toHaveValue(centimeters);
    await expect(page.locator('.lk-badge').filter({ hasText: /^En phase$/ })).toBeVisible();
    await expect(metric(page, 'Retard total calculé')).toContainText(`${periods} T`);
    await expect(metricValue(page, 'Retard de phase total')).toContainText(`${periods * 2}π`);
    await expect(page.locator('.dp-phase-summary')).toContainText('δ équivalent = 0 rad');
    await expect(page.locator('.lk-callout').filter({ hasText: 'CE QUE VOUS OBSERVEZ' })).toContainText('un nombre entier de périodes');
  });
}

test('doubler f conserve la position, double δ et divise λ par deux', async ({ page }) => {
  await preset(page, 'λ/4').click();
  await expect(input(page, 'Position de M2')).toHaveValue('8.5');
  await expect(metricValue(page, 'Retard de phase total')).toContainText('π/2');
  await setNumber(page, 'Fréquence du GBF', '2000');
  await expect(input(page, 'Position de M2')).toHaveValue('8.5');
  await expect(metricValue(page, 'Longueur d’onde')).toContainText('17');
  await expect(metricValue(page, 'Période')).toContainText('0,5');
  await expect(metricValue(page, 'Retard de phase total')).toContainText('π');
  await expect(metricValue(page, 'Retard total calculé')).toContainText('0,25');
});

test('atténuation spatiale : distance, amplitude reçue et désactivation', async ({ page }) => {
  await page.getByRole('checkbox', { name: 'Divergence sphérique et absorption' }).check();
  await setNumber(page, 'Position de M2', '20');
  await setNumber(page, 'Absorption', '0');
  await expect(metricValue(page, 'Amplitude de référence')).toContainText('1');
  await expect(metricValue(page, 'Amplitude reçue')).toContainText('0,5');
  await expect(metricValue(page, 'Amplitude restante')).toContainText('50');
  await expect(metricValue(page, 'Perte d’amplitude')).toContainText('50');
  await setNumber(page, 'Position de M2', '60');
  await expect(metricValue(page, 'Amplitude reçue')).toContainText('0,25');
  await page.getByRole('checkbox', { name: 'Divergence sphérique et absorption' }).uncheck();
  await expect(metricValue(page, 'Amplitude reçue')).toContainText('1');
  await expect(metricValue(page, 'Amplitude restante')).toContainText('100');
  await expect(metricValue(page, 'Perte d’amplitude')).toContainText('0');
});

test('saisie numérique française avec virgule et synchronisation des deux commandes', async ({ page }) => {
  await setNumber(page, 'Position de M2', '25,7');
  await expect(input(page, 'Position de M2')).toHaveValue('25.7');
  await expect(input(page, 'Déplacer M2')).toHaveValue('25.7');
  await expect(page.getByRole('slider', { name: 'Position longitudinale du microphone M2', exact: true })).toHaveAttribute('aria-valuenow', '25.7');
  await page.getByRole('slider', { name: 'Position de M2 — curseur', exact: true }).fill('40.5');
  await expect(input(page, 'Position de M2')).toHaveValue('40.5');
  await expect(input(page, 'Déplacer M2')).toHaveValue('40.5');
});

test('M2 se déplace au clavier avec les flèches, Maj, Début et Fin', async ({ page }) => {
  const microphone = page.getByRole('slider', { name: 'Position longitudinale du microphone M2', exact: true });
  await microphone.focus();
  await page.keyboard.press('ArrowRight');
  await expect(input(page, 'Position de M2')).toHaveValue('13.4');
  await page.keyboard.press('Shift+ArrowRight');
  await expect(input(page, 'Position de M2')).toHaveValue('14.4');
  await page.keyboard.press('End');
  await expect(input(page, 'Position de M2')).toHaveValue('200');
  await page.keyboard.press('Home');
  await expect(input(page, 'Position de M2')).toHaveValue('0');
});

test('glisser M2 sur sa règle modifie les commandes et le retard physique', async ({ page }) => {
  await dragMicrophone(page, 100);
  expect(Number(await input(page, 'Position de M2').inputValue())).toBeCloseTo(100, 1);
  expect(Number(await input(page, 'Déplacer M2').inputValue())).toBeCloseTo(100, 1);
  await expect(metricValue(page, 'Retard total calculé')).toContainText('2,941');
});

test('phase libre indépendante de la position conservée, sans atténuation acoustique', async ({ page }) => {
  await page.getByRole('checkbox', { name: 'Divergence sphérique et absorption' }).check();
  await setNumber(page, 'Position de M2', '80');
  await page.getByRole('combobox', { name: 'Modèle', exact: true }).selectOption('free');
  await setNumber(page, 'Retard de phase libre', '1080');
  await expect(metricValue(page, 'Retard de phase total')).toContainText('6π');
  await expect(metric(page, 'Décalage temporel mathématique')).toContainText('3 T');
  await expect(metricValue(page, 'Amplitude reçue')).toContainText('1');
  await expect(page.getByRole('spinbutton', { name: 'Déplacer M2', exact: true })).toBeDisabled();
  await expect(page.getByText(/Le décalage δ\/ω n’est pas présenté comme un temps de propagation/)).toBeVisible();
  await setNumber(page, 'Fréquence du GBF', '2000');
  await expect(metricValue(page, 'Retard de phase total')).toContainText('6π');
  await expect(metricValue(page, 'Distance entre microphones')).toContainText('80');
  await page.getByRole('combobox', { name: 'Modèle', exact: true }).selectOption('microphones');
  await expect(input(page, 'Position de M2')).toHaveValue('80');
});

test('pas T/24 : phases, projection verticale et tension oscilloscope restent synchronisés', async ({ page }) => {
  await preset(page, 'λ/4').click();
  await page.getByRole('button', { name: 'Avancer d’un pas' }).click();
  await expect(page.getByTestId('physical-time')).toHaveText('t = 0,04167 ms');
  await expect(page.locator('.dp-phase-circles')).toContainText('P1 · θ1 = 15°');
  await expect(page.getByTestId('instant-y1')).toHaveText('y₁ = 0,2588 V');
  await expect(page.getByTestId('instant-y2')).toHaveText('y₂ = -0,9659 V');
  const scope = page.getByTestId('oscilloscope');
  expect(Number(await scope.getAttribute('data-sample-y1'))).toBeCloseTo(Math.sin(Math.PI / 12), 10);
  expect(Number(await scope.getAttribute('data-sample-y2'))).toBeCloseTo(-Math.cos(Math.PI / 12), 10);
  await expect(page.locator('.dp-phase-circles')).toContainText('sin θ1 = 0,259');
  await page.getByRole('button', { name: 'Réinitialiser', exact: true }).click();
  await expect(page.getByTestId('physical-time')).toHaveText('t = 0 ms');
});

test('pause et vitesse de lecture ne modifient pas les paramètres physiques', async ({ page }) => {
  const before = await page.locator('.lk-metrics').allTextContents();
  await page.getByRole('combobox', { name: 'Vitesse de lecture' }).selectOption('2');
  expect(await page.locator('.lk-metrics').allTextContents()).toEqual(before);
  await page.getByRole('button', { name: 'Lancer la simulation' }).click();
  await expect.poll(async () => page.getByTestId('physical-time').textContent()).not.toBe('t = 0 ms');
  await page.getByRole('button', { name: 'Mettre en pause' }).click();
  const stopped = await page.getByTestId('physical-time').textContent();
  await page.getByRole('combobox', { name: 'Vitesse de lecture' }).selectOption('0.25');
  await expect(page.getByTestId('physical-time')).toHaveText(stopped!);
  expect(await page.locator('.lk-metrics').allTextContents()).toEqual(before);
});

test('oscilloscope : voies masquables, base commune et curseurs accessibles', async ({ page }) => {
  await expect(page.getByTestId('trace-ch1')).toBeVisible();
  await expect(page.getByTestId('trace-ch2')).toBeVisible();
  await page.getByRole('checkbox', { name: 'CH2 / M2', exact: true }).uncheck();
  await expect(page.getByTestId('trace-ch2')).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'CH2 / M2', exact: true }).check();
  await page.getByRole('combobox', { name: 'Base de temps', exact: true }).selectOption('0.5');
  await page.getByRole('combobox', { name: 'Sensibilité commune', exact: true }).selectOption('1');
  await page.getByRole('checkbox', { name: 'Acquisition stabilisée sur CH1', exact: true }).uncheck();
  await page.getByRole('slider', { name: 'Curseur temporel commun', exact: true }).fill('0.25');
  await expect(page.getByTestId('physical-time')).toHaveText('t = 0,25 ms');
  await expect(page.getByTestId('instant-y1')).toHaveText('y₁ = 1 V');
  await setNumber(page, 'Curseur de mesure 1 en pourcentage', '10');
  await setNumber(page, 'Curseur de mesure 2 en pourcentage', '30');
  await expect(page.locator('.dp-scope-measures')).toContainText('1 ms');
});

test('retard hors fenêtre : avertissement et ajustement réel de la base de temps', async ({ page }) => {
  await setNumber(page, 'Position de M2', '200');
  await page.getByRole('combobox', { name: 'Base de temps', exact: true }).selectOption('0.05');
  await expect(page.locator('.dp-scope-warning').filter({ hasText: 'dépasse la fenêtre' })).toBeVisible();
  await page.getByRole('button', { name: 'Ajuster la base de temps', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Base de temps', exact: true })).toHaveValue('1');
  await expect(page.locator('.dp-scope-warning').filter({ hasText: 'dépasse la fenêtre' })).toHaveCount(0);
});

test('les expériences hors de la course sont désactivées et expliquées', async ({ page }) => {
  await setNumber(page, 'Fréquence du GBF', '200');
  await setNumber(page, 'Célérité du son', '500');
  await expect(preset(page, '3λ')).toBeDisabled();
  await expect(preset(page, '3λ')).toHaveAttribute('title', 'Hors course : 750 cm dépasse 200 cm');
  await expect(preset(page, '3λ')).toContainText('hors course');
  await expect(preset(page, '0')).toBeEnabled();
  await expect(input(page, 'Position de M2')).toHaveValue('13.3');
});

test('thèmes clair et sombre et navigation des vues au clavier', async ({ page }) => {
  await expect(page.locator('.dephasage-lab')).toHaveAttribute('data-lab-theme', 'light');
  await page.getByRole('button', { name: 'Activer le thème sombre' }).click();
  await expect(page.locator('.dephasage-lab')).toHaveAttribute('data-lab-theme', 'dark');
  await page.getByRole('button', { name: 'Activer le thème clair' }).click();
  await expect(page.locator('.dephasage-lab')).toHaveAttribute('data-lab-theme', 'light');
  await page.getByRole('tab', { name: 'Microphones', exact: true }).click();
  await expect(page.locator('.dp-apparatus')).toBeVisible();
  await expect(page.locator('.dp-phase-circles')).toHaveCount(0);
  await page.getByRole('tab', { name: 'Microphones', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Cercles', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.dp-phase-circles')).toBeVisible();
  await expect(page.locator('.dp-apparatus')).toHaveCount(0);
  await page.getByRole('tab', { name: 'Vue synchronisée', exact: true }).click();
  await expect(page.locator('.dp-apparatus')).toBeVisible();
  await expect(page.locator('.dp-phase-circles')).toBeVisible();
});

for (const width of [320, 390, 768]) test(`mobile ${width}px : graphiques et panneaux sans débordement horizontal`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  for (const name of ['Vue synchronisée', 'Microphones', 'Cercles']) {
    await page.getByRole('tab', { name, exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.getByRole('tab', { name: 'Vue synchronisée', exact: true }).click();
  await setNumber(page, 'Déplacer M2', '54,2');
  await expect(input(page, 'Position de M2')).toHaveValue('54.2');
  const graph = await page.locator('.dp-scope-graph').boundingBox();
  expect(graph!.width).toBeGreaterThan(230);
  expect(graph!.width).toBeLessThanOrEqual(width);
});

test('glissement tactile de M2 sur téléphone', async ({ browser, page }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  const touchPage = await context.newPage();
  await touchPage.goto(page.url());
  const microphone = touchPage.getByRole('slider', { name: 'Position longitudinale du microphone M2', exact: true });
  await microphone.scrollIntoViewIfNeeded();
  const points = await microphone.evaluate(element => {
    const svg = (element as SVGElement).ownerSVGElement!, matrix = svg.getScreenCTM()!;
    const left = Number(svg.dataset.rulerLeft), right = Number(svg.dataset.rulerRight);
    const start = new DOMPoint(left + 13.3 / 200 * (right - left), 219).matrixTransform(matrix);
    const end = new DOMPoint(left + .5 * (right - left), 219).matrixTransform(matrix);
    return { start: { x: start.x, y: start.y }, end: { x: end.x, y: end.y } };
  });
  const session = await context.newCDPSession(touchPage);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...points.start, id: 1 }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...points.end, id: 1 }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  expect(Number(await input(touchPage, 'Position de M2').inputValue())).toBeCloseTo(100, 1);
  await context.close();
});

test('active=false et démontage annulent réellement requestAnimationFrame et arrêtent le temps', async ({ page }) => {
  await page.addInitScript(() => {
    const request = window.requestAnimationFrame.bind(window), cancel = window.cancelAnimationFrame.bind(window);
    const pending = new Set<number>();
    let callbacks = 0;
    window.requestAnimationFrame = callback => {
      const id = request(timestamp => { pending.delete(id); callbacks++; callback(timestamp); });
      pending.add(id); return id;
    };
    window.cancelAnimationFrame = id => { pending.delete(id); cancel(id); };
    (window as unknown as { __rafProbe: unknown }).__rafProbe = {
      pending: () => pending.size,
      callbacks: () => callbacks,
      frames: () => new Promise<void>(resolve => request(() => request(() => resolve()))),
    };
  });
  await page.reload();
  const read = () => page.evaluate(() => {
    const probe = (window as unknown as { __rafProbe: { pending: () => number; callbacks: () => number } }).__rafProbe;
    return { pending: probe.pending(), callbacks: probe.callbacks() };
  });
  const settle = () => page.evaluate(() => (window as unknown as { __rafProbe: { frames: () => Promise<void> } }).__rafProbe.frames());
  await page.getByRole('button', { name: 'Lancer la simulation' }).click();
  await expect.poll(async () => (await read()).pending).toBeGreaterThan(0);
  await expect.poll(async () => page.getByTestId('physical-time').textContent()).not.toBe('t = 0 ms');
  await page.getByRole('button', { name: 'Suspendre le laboratoire' }).click();
  await expect.poll(async () => (await read()).pending).toBe(0);
  const inactiveTime = await page.getByTestId('physical-time').textContent(), inactiveCount = (await read()).callbacks;
  await settle();
  await expect(page.getByTestId('physical-time')).toHaveText(inactiveTime!);
  expect((await read()).callbacks).toBe(inactiveCount);
  await expect(page.getByRole('button', { name: 'Lancer la simulation' })).toBeDisabled();
  await page.getByRole('button', { name: 'Réactiver le laboratoire' }).click();
  await expect.poll(async () => (await read()).pending).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Fermer le laboratoire' }).click();
  await expect(page.getByRole('heading', { name: 'Le laboratoire est fermé.' })).toBeVisible();
  await expect.poll(async () => (await read()).pending).toBe(0);
  const closedCount = (await read()).callbacks;
  await settle();
  expect((await read()).callbacks).toBe(closedCount);
  await page.getByRole('button', { name: 'Ouvrir le laboratoire de déphasage' }).click();
  await expect(page.getByTestId('physical-time')).toHaveText('t = 0 ms');
});

test('interrompre un glissement temporel par active=false libère la fenêtre déclenchée', async ({ page }) => {
  await page.getByRole('combobox', {name:'Vitesse de lecture'}).selectOption('2');
  await page.locator('.dp-time-handle').hover();
  await page.mouse.down();
  // Le site hôte peut désactiver le laboratoire sans qu'un pointerup parvienne au SVG.
  await page.getByRole('button', {name:'Suspendre le laboratoire'}).evaluate((button: HTMLButtonElement)=>button.click());
  await page.getByRole('button', {name:'Réactiver le laboratoire'}).evaluate((button: HTMLButtonElement)=>button.click());
  await page.getByRole('button', {name:'Lancer la simulation'}).evaluate((button: HTMLButtonElement)=>button.click());
  await expect.poll(async ()=>Number((await page.getByTestId('physical-time').textContent())!.match(/t = ([0-9,]+)/)![1].replace(',','.'))).toBeGreaterThan(2.1);
  await expect(page.locator('.dp-time-cursor')).toHaveCount(1);
  await expect(page.getByText(/L’instant commun est hors de cette courte fenêtre/)).toHaveCount(0);
  await page.mouse.up();
});
