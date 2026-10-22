import { expect, test, type Page } from '@playwright/test';

const labels = ['0', 'λ/4', 'λ/2', '3λ/4', 'λ', '3λ/2', '2λ', '3λ'];
const preset = (page: Page, label: string) => page.locator('.dp-presets > button').nth(labels.indexOf(label));
const metric = (page: Page, label: string) => page.locator('.lk-metric').filter({ has: page.getByText(label, { exact: true }) });
const metricValue = (page: Page, label: string) => metric(page, label).locator('.lk-metric-value');
const input = (page: Page, label: string) => page.getByRole('spinbutton', { name: label, exact: true });
const mediumButtons = (page: Page) => page.getByRole('group', { name: 'Milieu de l’expérience', exact: true });
async function displayedNumber(page: Page, label: string): Promise<number> {
  const text = (await metricValue(page, label).textContent())!.replace(/\s/g, '');
  const number = text.match(/[−-]?\d+(?:[,.]\d+)?/);
  if (!number) throw new Error(`Valeur numérique absente de ${label} : ${text}`);
  return Number(number[0].replace('−', '-').replace(',', '.'));
}
async function setNumber(page: Page, label: string, value: string) {
  await input(page, label).fill(value);
  await input(page, label).press('Enter');
}
async function dragMicrophone(page: Page, centimeters: number, water = false) {
  const microphone = page.getByRole('slider', { name: water ? 'Position longitudinale de l’hydrophone M2' : 'Position longitudinale du microphone M2', exact: true });
  await microphone.scrollIntoViewIfNeeded();
  const target = await microphone.evaluate((element, position) => {
    const svg = (element as SVGElement).ownerSVGElement!;
    const left = Number(svg.dataset.rulerLeft), right = Number(svg.dataset.rulerRight);
    const origin = new DOMPoint(0, 0).matrixTransform((element as SVGGraphicsElement).getScreenCTM()!);
    const point = new DOMPoint(left + position / 200 * (right - left), 0).matrixTransform(svg.getScreenCTM()!);
    return { x: point.x, y: origin.y, startX: origin.x, startY: origin.y };
  }, centimeters);
  // Viser le corps du capteur, pas le centre de son groupe SVG : une
  // étiquette de tension très longue peut élargir la boîte englobante.
  await page.mouse.move(target.startX, target.startY);
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
  await setNumber(page, 'Absorption illustrative', '0');
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
  // Comparer ici les phases avec des amplitudes explicitement égales.
  await page.getByRole('checkbox', { name: 'Divergence sphérique et absorption' }).uncheck();
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

test('l’air démarre avec un amortissement spatial activé et calculé en volts', async ({ page }) => {
  await expect(page.getByRole('checkbox', { name: 'Divergence sphérique et absorption' })).toBeChecked();
  await expect(page.getByRole('combobox', { name: 'Milieu de propagation', exact: true })).toHaveValue('air');
  const initialRatio = .2 / (.2 + .133) * Math.exp(-.2 * .133);
  expect(await displayedNumber(page, 'Amplitude reçue')).toBeCloseTo(initialRatio, 6);
  expect(await displayedNumber(page, 'Amplitude restante')).toBeCloseTo(100 * initialRatio, 2);
  expect(await displayedNumber(page, 'Perte d’amplitude')).toBeCloseTo(100 * (1 - initialRatio), 2);
  await setNumber(page, 'Position de M2', '100');
  const distantRatio = .2 / 1.2 * Math.exp(-.2);
  expect(await displayedNumber(page, 'Amplitude reçue')).toBeCloseTo(distantRatio, 6);
  expect(distantRatio).toBeLessThan(initialRatio);
  await setNumber(page, 'Absorption illustrative', '1');
  const absorbedRatio = .2 / 1.2 * Math.exp(-1);
  expect(await displayedNumber(page, 'Amplitude reçue')).toBeCloseTo(absorbedRatio, 6);
  expect(await displayedNumber(page, 'Perte d’amplitude')).toBeCloseTo(100 * (1 - absorbedRatio), 2);
  await page.getByRole('checkbox', { name: 'Divergence sphérique et absorption' }).uncheck();
  expect(await displayedNumber(page, 'Amplitude reçue')).toBe(1);
  expect(await displayedNumber(page, 'Amplitude restante')).toBe(100);
  expect(await displayedNumber(page, 'Perte d’amplitude')).toBe(0);
});

test('Eau douce : le sélecteur du montage recalcule célérité, phase, retard et absorption sans déplacer M2', async ({ page }) => {
  await mediumButtons(page).getByRole('button', { name: 'Eau douce', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Milieu de propagation', exact: true })).toHaveValue('water');
  await expect(mediumButtons(page).getByRole('button', { name: 'Eau douce', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(input(page, 'Célérité du son')).toHaveValue('1480');
  await expect(input(page, 'Absorption illustrative')).toHaveValue('0.05');
  await expect(input(page, 'Fréquence du GBF')).toHaveValue('1000');
  await expect(input(page, 'Position de M2')).toHaveValue('13.3');
  expect(await displayedNumber(page, 'Distance entre hydrophones')).toBe(13.3);
  expect(await displayedNumber(page, 'Longueur d’onde')).toBe(148);
  expect(await displayedNumber(page, 'Période')).toBe(1);
  expect(await displayedNumber(page, 'Retard total calculé')).toBeCloseTo(.133 / 1480 * 1000, 4);
  const phase = 2 * Math.PI * .133 / 1.48;
  expect(await displayedNumber(page, 'Retard de phase total')).toBeCloseTo(phase, 3);
  expect(await displayedNumber(page, 'Différence de phase signée')).toBeCloseTo(-phase, 3);
  const ratio = .2 / .333 * Math.exp(-.05 * .133);
  expect(await displayedNumber(page, 'Amplitude reçue')).toBeCloseTo(ratio, 6);
  const scope = page.getByTestId('oscilloscope');
  expect(Number(await scope.getAttribute('data-sample-y1'))).toBeCloseTo(0, 10);
  expect(Number(await scope.getAttribute('data-sample-y2'))).toBeCloseTo(-ratio * Math.sin(phase), 10);
  await expect(page.getByRole('heading', { name: 'Du GBF aux deux hydrophones', exact: true })).toBeVisible();
  await expect(page.locator('.dp-apparatus svg:visible').getByText('Émetteur immergé', { exact: true })).toBeVisible();
  await expect(page.getByRole('slider', { name: 'Position longitudinale de l’hydrophone M2', exact: true })).toBeVisible();
});

test('le retour à Air rétablit ses valeurs proposées et t=0 en conservant fréquence et distance', async ({ page }) => {
  await page.getByRole('combobox', { name: 'Milieu de propagation', exact: true }).selectOption('water');
  await setNumber(page, 'Fréquence du GBF', '1200');
  await setNumber(page, 'Position de M2', '40');
  await setNumber(page, 'Célérité du son', '1300');
  await setNumber(page, 'Absorption illustrative', '0,5');
  await page.getByRole('button', { name: 'Avancer d’un pas' }).click();
  await expect(page.getByTestId('physical-time')).not.toHaveText('t = 0 ms');
  await mediumButtons(page).getByRole('button', { name: 'Air', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Milieu de propagation', exact: true })).toHaveValue('air');
  await expect(input(page, 'Célérité du son')).toHaveValue('340');
  await expect(input(page, 'Absorption illustrative')).toHaveValue('0.2');
  await expect(input(page, 'Fréquence du GBF')).toHaveValue('1200');
  await expect(input(page, 'Position de M2')).toHaveValue('40');
  await expect(page.getByTestId('physical-time')).toHaveText('t = 0 ms');
  expect(await displayedNumber(page, 'Longueur d’onde')).toBeCloseTo(340 / 1200 * 100, 2);
  expect(await displayedNumber(page, 'Amplitude reçue')).toBeCloseTo(.2 / .6 * Math.exp(-.2 * .4), 6);
});

test('dans l’eau, une longueur d’onde vaut 148 cm avec retard T ; 2λ et 3λ sont hors course', async ({ page }) => {
  await page.getByRole('combobox', { name: 'Milieu de propagation', exact: true }).selectOption('water');
  await preset(page, 'λ').click();
  await expect(input(page, 'Position de M2')).toHaveValue('148');
  await expect(page.locator('.lk-badge').filter({ hasText: /^En phase$/ })).toBeVisible();
  expect(await displayedNumber(page, 'Retard total calculé')).toBe(1);
  await expect(metric(page, 'Retard total calculé')).toContainText('1 T');
  await expect(metricValue(page, 'Retard de phase total')).toContainText('2π');
  await expect(page.locator('.dp-phase-summary')).toContainText('δ équivalent = 0 rad');
  await expect(preset(page, '2λ')).toBeDisabled();
  await expect(preset(page, '2λ')).toHaveAttribute('title', 'Hors course : 296 cm dépasse 200 cm');
  await expect(preset(page, '3λ')).toBeDisabled();
  await expect(preset(page, '3λ')).toHaveAttribute('title', 'Hors course : 444 cm dépasse 200 cm');
  await page.getByRole('slider', { name: 'Curseur temporel commun', exact: true }).fill('0.25');
  const ratio = .2 / 1.68 * Math.exp(-.05 * 1.48);
  const scope = page.getByTestId('oscilloscope');
  expect(Number(await scope.getAttribute('data-sample-y1'))).toBeCloseTo(1, 10);
  expect(Number(await scope.getAttribute('data-sample-y2'))).toBeCloseTo(ratio, 10);
  expect(await displayedNumber(page, 'Amplitude reçue')).toBeCloseTo(ratio, 6);
});

test('l’hydrophone M2 se déplace au clavier et par glissement avec les mêmes unités', async ({ page }) => {
  await mediumButtons(page).getByRole('button', { name: 'Eau douce', exact: true }).click();
  const hydrophone = page.getByRole('slider', { name: 'Position longitudinale de l’hydrophone M2', exact: true });
  await hydrophone.focus();
  await page.keyboard.press('ArrowRight');
  await expect(input(page, 'Position de M2')).toHaveValue('13.4');
  await page.keyboard.press('Shift+ArrowRight');
  await expect(input(page, 'Position de M2')).toHaveValue('14.4');
  await dragMicrophone(page, 100, true);
  expect(Number(await input(page, 'Position de M2').inputValue())).toBeCloseTo(100, 1);
  expect(Number(await input(page, 'Déplacer M2').inputValue())).toBeCloseTo(100, 1);
  expect(await displayedNumber(page, 'Retard total calculé')).toBeCloseTo(1000 / 1480, 4);
  expect(await displayedNumber(page, 'Amplitude reçue')).toBeCloseTo(.2 / 1.2 * Math.exp(-.05), 6);
});

test('l’amortissement dans l’eau reste spatial pendant une période complète et les vues restent synchronisées', async ({ page }) => {
  await mediumButtons(page).getByRole('button', { name: 'Eau douce', exact: true }).click();
  await preset(page, 'λ/4').click();
  await expect(input(page, 'Position de M2')).toHaveValue('37');
  const ratio = .2 / .57 * Math.exp(-.05 * .37);
  expect(await displayedNumber(page, 'Amplitude reçue')).toBeCloseTo(ratio, 6);
  const amplitudeBefore = await metricValue(page, 'Amplitude reçue').textContent();
  const scope = page.getByTestId('oscilloscope');
  expect(Number(await scope.getAttribute('data-sample-y2'))).toBeCloseTo(-ratio, 10);
  const step = page.getByRole('button', { name: 'Avancer d’un pas' });
  for (let index = 0; index < 24; index++) await step.click();
  await expect(page.getByTestId('physical-time')).toHaveText('t = 1 ms');
  await expect(metricValue(page, 'Amplitude reçue')).toHaveText(amplitudeBefore!);
  expect(Number(await scope.getAttribute('data-sample-y1'))).toBeCloseTo(0, 10);
  expect(Number(await scope.getAttribute('data-sample-y2'))).toBeCloseTo(-ratio, 10);
  await expect(page.locator('.dp-phase-circles')).toContainText('sin θ2 = -1');
  const formattedRatio = ratio.toLocaleString('fr-FR', { maximumFractionDigits: 4 });
  await expect(page.getByTestId('instant-y2')).toHaveText(`y₂ = -${formattedRatio} V`);
});

test('phase libre : changer Air/Eau conserve δ et n’impose aucune atténuation aux signaux', async ({ page }) => {
  await mediumButtons(page).getByRole('button', { name: 'Eau douce', exact: true }).click();
  await setNumber(page, 'Position de M2', '47');
  await page.getByRole('combobox', { name: 'Modèle', exact: true }).selectOption('free');
  await setNumber(page, 'Retard de phase libre', '270');
  await expect(metricValue(page, 'Retard de phase total')).toContainText('3π/2');
  expect(await displayedNumber(page, 'Amplitude reçue')).toBe(1);
  expect(await displayedNumber(page, 'Amplitude restante')).toBe(100);
  expect(await displayedNumber(page, 'Décalage temporel mathématique')).toBe(.75);
  await expect(page.getByRole('checkbox', { name: 'Divergence sphérique et absorption' })).toBeDisabled();
  await mediumButtons(page).getByRole('button', { name: 'Air', exact: true }).click();
  await expect(metricValue(page, 'Retard de phase total')).toContainText('3π/2');
  expect(await displayedNumber(page, 'Décalage temporel mathématique')).toBe(.75);
  expect(await displayedNumber(page, 'Amplitude reçue')).toBe(1);
  expect(await displayedNumber(page, 'Distance entre microphones')).toBe(47);
  await expect(input(page, 'Célérité du son')).toHaveValue('340');
});

for (const width of [320, 390]) test(`Eau douce sur mobile ${width}px : sélecteurs, position et thèmes sans débordement`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const selector = page.getByRole('combobox', { name: 'Milieu de propagation', exact: true });
  await expect(selector).toBeVisible();
  await mediumButtons(page).getByRole('button', { name: 'Eau douce', exact: true }).click();
  await expect(selector).toHaveValue('water');
  await expect(page.getByRole('slider', { name: 'Position longitudinale de l’hydrophone M2', exact: true })).toBeVisible();
  await setNumber(page, 'Déplacer M2', '54,2');
  await expect(input(page, 'Position de M2')).toHaveValue('54.2');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Activer le thème sombre' }).click();
  await expect(page.locator('.dephasage-lab')).toHaveAttribute('data-lab-theme', 'dark');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Activer le thème clair' }).click();
  await expect(page.locator('.dephasage-lab')).toHaveAttribute('data-lab-theme', 'light');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('le profil spatial montre le bon rapport d’amplitude, suit M2 et devient horizontal sans atténuation', async ({ page }) => {
  await mediumButtons(page).getByRole('button', { name: 'Eau douce', exact: true }).click();
  const envelope = page.getByTestId('amplitude-envelope');
  await expect(envelope).toBeVisible();
  const initialCurve = await envelope.locator('.dp-envelope-path').getAttribute('d');
  const initialPosition = await envelope.locator('circle').last().getAttribute('cx');
  await setNumber(page, 'Position de M2', '100');
  const ratio = .2 / 1.2 * Math.exp(-.05);
  expect(Number(await envelope.getAttribute('data-ratio'))).toBeCloseTo(ratio, 12);
  expect(await displayedNumber(page, 'Amplitude reçue')).toBeCloseTo(ratio, 6);
  await expect(envelope.locator('circle').last()).not.toHaveAttribute('cx', initialPosition!);
  // Une position différente déplace le point sur la même loi spatiale ;
  // seul un changement de loi doit modifier toute l’enveloppe.
  await expect(envelope.locator('.dp-envelope-path')).toHaveAttribute('d', initialCurve!);
  await setNumber(page, 'Absorption illustrative', '1');
  await expect(envelope.locator('.dp-envelope-path')).not.toHaveAttribute('d', initialCurve!);
  expect(Number(await envelope.getAttribute('data-ratio'))).toBeCloseTo(.2 / 1.2 * Math.exp(-1), 12);
  await page.getByRole('checkbox', { name: 'Divergence sphérique et absorption' }).uncheck();
  expect(Number(await envelope.getAttribute('data-ratio'))).toBe(1);
  const flatCurve = (await envelope.locator('.dp-envelope-path').getAttribute('d'))!;
  const yCoordinates = [...flatCurve.matchAll(/[ML][\d.]+,([\d.]+)/g)].map(match => Number(match[1]));
  expect(yCoordinates.length).toBeGreaterThan(50);
  expect(new Set(yCoordinates).size).toBe(1);
  await page.getByRole('combobox', { name: 'Modèle', exact: true }).selectOption('free');
  await expect(envelope).toHaveCount(0);
});

test('interface Air → Eau : un microphone et un hydrophone, deux longueurs d’onde et un parcours composé', async ({ page }) => {
  await mediumButtons(page).getByRole('button', { name: 'Air → Eau', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Milieu de propagation', exact: true })).toHaveValue('air-water');
  await expect(input(page, 'Position de l’interface')).toHaveValue('40');
  await expect(input(page, 'Position de M2')).toHaveValue('60');
  const sensors = page.locator('.dp-apparatus svg:visible .dp-microphone');
  await expect(sensors.first()).toHaveAttribute('data-medium', 'air');
  await expect(sensors.last()).toHaveAttribute('data-medium', 'water');
  await expect(page.getByRole('slider', { name: 'Position longitudinale de l’hydrophone M2', exact: true })).toBeVisible();
  expect(await displayedNumber(page, 'Longueur d’onde · Air')).toBe(34);
  expect(await displayedNumber(page, 'Longueur d’onde · Eau douce')).toBe(148);
  const travel = .4 / 340 + .2 / 1480;
  expect(await displayedNumber(page, 'Temps de parcours')).toBeCloseTo(travel * 1000, 4);
  expect(await displayedNumber(page, 'Phase du parcours')).toBeCloseTo(2 * Math.PI * 1000 * travel, 3);
  expect(await displayedNumber(page, 'Intensité réfléchie')).toBeCloseTo(99.8895697635, 3);
  expect(await displayedNumber(page, 'Intensité transmise')).toBeCloseTo(.1104302365, 3);
  await expect(page.locator('.dp-interface-flow')).toContainText('Onde réfléchie');
  await expect(page.locator('.dp-interface-facts')).toContainText('Air : 40 cm · Eau douce : 20 cm');
});

test('interface Eau → Air : inversion des types de capteurs et du coefficient de réflexion de pression', async ({ page }) => {
  await page.getByRole('combobox', { name: 'Milieu de propagation', exact: true }).selectOption('water-air');
  await expect(input(page, 'Célérité · Eau douce')).toHaveValue('1480');
  await expect(input(page, 'Célérité · Air')).toHaveValue('340');
  const sensors = page.locator('.dp-apparatus svg:visible .dp-microphone');
  await expect(sensors.first()).toHaveAttribute('data-medium', 'water');
  await expect(sensors.last()).toHaveAttribute('data-medium', 'air');
  await expect(page.getByRole('slider', { name: 'Position longitudinale du microphone M2', exact: true })).toBeVisible();
  await expect(page.locator('.dp-apparatus svg:visible').getByText('Émetteur immergé', { exact: true })).toBeVisible();
  const Zwater = 998 * 1480, Zair = 1.2 * 340;
  expect(await displayedNumber(page, 'Réflexion de pression')).toBeCloseTo((Zair - Zwater) / (Zair + Zwater), 6);
  expect(await displayedNumber(page, 'Transmission de pression')).toBeCloseTo(2 * Zair / (Zwater + Zair), 6);
  expect(await displayedNumber(page, 'Temps de parcours')).toBeCloseTo((.4 / 1480 + .2 / 340) * 1000, 4);
  expect(await displayedNumber(page, 'Intensité réfléchie') + await displayedNumber(page, 'Intensité transmise')).toBeCloseTo(100, 3);
});

test('interface : le capteur M2 change de type lors d’un passage au clavier puis par glissement', async ({ page }) => {
  for (const [configuration, startsInWater, firstSpeed, secondSpeed] of [['air-water', true, 340, 1480], ['water-air', false, 1480, 340]] as const) {
    await page.getByRole('combobox', { name: 'Milieu de propagation', exact: true }).selectOption(configuration);
    await setNumber(page, 'Position de M2', '60');
    const initialName = startsInWater ? 'Position longitudinale de l’hydrophone M2' : 'Position longitudinale du microphone M2';
    await page.getByRole('slider', { name: initialName, exact: true }).focus();
    await page.keyboard.press('Home');
    await expect(input(page, 'Position de M2')).toHaveValue('0');
    await setNumber(page, 'Position de M2', '20');
    const firstSideName = startsInWater ? 'Position longitudinale du microphone M2' : 'Position longitudinale de l’hydrophone M2';
    await expect(page.getByRole('slider', { name: firstSideName, exact: true })).toBeVisible();
    expect(await displayedNumber(page, 'Temps de parcours')).toBeCloseTo(.2 / firstSpeed * 1000, 4);
    await dragMicrophone(page, 80, !startsInWater);
    expect(Number(await input(page, 'Position de M2').inputValue())).toBeCloseTo(80, 1);
    await expect(page.getByRole('slider', { name: initialName, exact: true })).toBeVisible();
    expect(await displayedNumber(page, 'Temps de parcours')).toBeCloseTo((.4 / firstSpeed + .4 / secondSpeed) * 1000, 4);
  }
});

test('interface : déplacer la frontière conserve M2 et recalcule son milieu et les deux trajets', async ({ page }) => {
  await mediumButtons(page).getByRole('button', { name: 'Air → Eau', exact: true }).click();
  await setNumber(page, 'Déplacer l’interface', '80');
  await expect(input(page, 'Position de l’interface')).toHaveValue('80');
  await expect(input(page, 'Position de M2')).toHaveValue('60');
  await expect(page.getByRole('slider', { name: 'Position longitudinale du microphone M2', exact: true })).toBeVisible();
  expect(await displayedNumber(page, 'Temps de parcours')).toBeCloseTo(.6 / 340 * 1000, 4);
  await setNumber(page, 'Position de l’interface', '20');
  await expect(input(page, 'Déplacer l’interface')).toHaveValue('20');
  await expect(input(page, 'Position de M2')).toHaveValue('60');
  await expect(page.getByRole('slider', { name: 'Position longitudinale de l’hydrophone M2', exact: true })).toBeVisible();
  expect(await displayedNumber(page, 'Temps de parcours')).toBeCloseTo((.2 / 340 + .4 / 1480) * 1000, 4);
});

test('interface sans absorption : réflexion, interférences et bilan énergétique restent présents', async ({ page }) => {
  await mediumButtons(page).getByRole('button', { name: 'Air → Eau', exact: true }).click();
  const coefficientBefore = await metricValue(page, 'Réflexion de pression').textContent();
  await page.getByRole('checkbox', { name: 'Absorption sur les trajets', exact: true }).uncheck();
  const r = (998 * 1480 - 1.2 * 340) / (998 * 1480 + 1.2 * 340);
  const phaseRoundTrip = 2 * 2 * Math.PI * 1000 * .4 / 340;
  const A1 = Math.hypot(1 + r * Math.cos(phaseRoundTrip), -r * Math.sin(phaseRoundTrip));
  const A2 = 1 + r;
  expect(await displayedNumber(page, 'Amplitude incidente à M1')).toBe(1);
  expect(await displayedNumber(page, 'Amplitude totale à M1')).toBeCloseTo(A1, 6);
  expect(await displayedNumber(page, 'Amplitude totale à M2')).toBeCloseTo(A2, 6);
  expect(await displayedNumber(page, 'Rapport de pression A₂/A₁')).toBeCloseTo(100 * A2 / A1, 2);
  expect(A2 / A1).toBeGreaterThan(1);
  await expect(metricValue(page, 'Réflexion de pression')).toHaveText(coefficientBefore!);
  expect(await displayedNumber(page, 'Intensité réfléchie') + await displayedNumber(page, 'Intensité transmise')).toBeCloseTo(100, 3);
  expect(await displayedNumber(page, 'Intensité transmise')).toBeLessThan(1);
  await expect(metric(page, 'Rapport de pression A₂/A₁')).toContainText('ce n’est pas un rapport d’énergie');
  await expect(metric(page, 'Perte d’amplitude')).toHaveCount(0);
  const envelope = page.getByTestId('amplitude-envelope');
  expect(Number(await envelope.getAttribute('data-ratio'))).toBeCloseTo(A2 / A1, 10);
  const coordinates = (await envelope.locator('.dp-envelope-path').getAttribute('d'))!;
  const yCoordinates = [...coordinates.matchAll(/[ML][\d.]+,([\d.]+)/g)].map(match => Number(match[1]));
  expect(new Set(yCoordinates).size).toBeGreaterThan(5);
});

test('interface : oscilloscope et cercles utilisent la phase totale de M1 et les vrais maxima correspondants', async ({ page }) => {
  await mediumButtons(page).getByRole('button', { name: 'Air → Eau', exact: true }).click();
  await page.getByRole('combobox', { name: 'Base de temps', exact: true }).selectOption('1');
  const omega = 2 * Math.PI * 1000, r = (998 * 1480 - 408) / (998 * 1480 + 408);
  const reflected = r * Math.exp(-2 * .2 * .4), roundTrip = 2 * omega * .4 / 340;
  const phi1 = Math.atan2(-reflected * Math.sin(roundTrip), 1 + reflected * Math.cos(roundTrip));
  const A1 = Math.hypot(1 + reflected * Math.cos(roundTrip), -reflected * Math.sin(roundTrip));
  const travel = .4 / 340 + .2 / 1480, phi2 = -omega * travel;
  const A2 = (1 + r) * Math.exp(-.2 * .4 - .05 * .2);
  const signalDelay = (phi1 - phi2) / omega;
  const scope = page.getByTestId('oscilloscope');
  expect(Number(await scope.getAttribute('data-phase1'))).toBeCloseTo(phi1, 10);
  expect(Math.abs(phi1)).toBeGreaterThan(.1);
  expect(Number(await scope.getAttribute('data-phase2'))).toBeCloseTo(phi2, 10);
  const start = Number(await scope.getAttribute('data-window-start'));
  expect(Math.sin(omega * start + phi1)).toBeCloseTo(0, 10);
  expect(Math.cos(omega * start + phi1)).toBeGreaterThan(.99);
  const background = scope.locator('.dp-scope-background');
  const middle = Number(await background.getAttribute('y')) + Number(await background.getAttribute('height')) / 2;
  const firstOrdinate = Number((await page.getByTestId('trace-ch1').getAttribute('d'))!.match(/^M[\d.]+,([\d.-]+)/)![1]);
  expect(firstOrdinate).toBeCloseTo(middle, 1);
  await page.getByRole('button', { name: 'Avancer d’un pas' }).click();
  const t = .001 / 24, y1 = A1 * Math.sin(omega * t + phi1), y2 = A2 * Math.sin(omega * t + phi2);
  expect(Number(await scope.getAttribute('data-sample-y1'))).toBeCloseTo(y1, 10);
  expect(Number(await scope.getAttribute('data-sample-y2'))).toBeCloseTo(y2, 10);
  const projection = Math.sin(omega * t + phi1).toLocaleString('fr-FR', { maximumFractionDigits: 3 });
  await expect(page.locator('.dp-phase-circles')).toContainText(`sin θ1 = ${projection}`);
  await expect(page.getByTestId('instant-y1')).toHaveText(`y₁ = ${y1.toLocaleString('fr-FR', { maximumFractionDigits: 6 })} V`);
  expect(Number(await scope.getAttribute('data-geometric-delay'))).toBeCloseTo(travel, 12);
  expect(Number(await scope.getAttribute('data-signal-delay'))).toBeCloseTo(signalDelay, 12);
  expect(Math.abs(travel - signalDelay)).toBeGreaterThan(.0001);
  const dimension = page.getByTestId('scope-delay-dimension');
  await expect(dimension).toBeVisible();
  const t1 = Number(await dimension.getAttribute('data-time-m1')), t2 = Number(await dimension.getAttribute('data-time-m2'));
  expect(Math.sin(omega * t1 + phi1)).toBeCloseTo(1, 10);
  expect(Math.sin(omega * t2 + phi2)).toBeCloseTo(1, 10);
  expect(t2 - t1).toBeCloseTo(signalDelay, 12);
  await expect(page.getByTestId('scope-interface-delays')).toContainText('Temps de parcours calculé');
  await expect(page.getByTestId('scope-interface-delays')).toContainText('Décalage des signaux');
});

test('interface : changer fréquence et célérités conserve les positions et remet l’horloge à zéro', async ({ page }) => {
  await mediumButtons(page).getByRole('button', { name: 'Air → Eau', exact: true }).click();
  await page.getByRole('button', { name: 'Avancer d’un pas' }).click();
  await setNumber(page, 'Fréquence du GBF', '2000');
  await expect(page.getByTestId('physical-time')).toHaveText('t = 0 ms');
  await expect(input(page, 'Position de M2')).toHaveValue('60');
  await expect(input(page, 'Position de l’interface')).toHaveValue('40');
  expect(await displayedNumber(page, 'Longueur d’onde · Air')).toBe(17);
  expect(await displayedNumber(page, 'Longueur d’onde · Eau douce')).toBe(74);
  expect(await displayedNumber(page, 'Temps de parcours')).toBeCloseTo((.4 / 340 + .2 / 1480) * 1000, 4);
  await setNumber(page, 'Célérité · Air', '400');
  await setNumber(page, 'Célérité · Eau douce', '1600');
  await expect(input(page, 'Position de M2')).toHaveValue('60');
  await expect(input(page, 'Position de l’interface')).toHaveValue('40');
  expect(await displayedNumber(page, 'Longueur d’onde · Air')).toBe(20);
  expect(await displayedNumber(page, 'Longueur d’onde · Eau douce')).toBe(80);
  expect(await displayedNumber(page, 'Temps de parcours')).toBeCloseTo((.4 / 400 + .2 / 1600) * 1000, 4);
});

test('interface : la pression totale reste continue lorsque M2 franchit la frontière', async ({ page }) => {
  await mediumButtons(page).getByRole('button', { name: 'Air → Eau', exact: true }).click();
  await setNumber(page, 'Position de M2', '39,999');
  await expect(page.getByRole('slider', { name: 'Position longitudinale du microphone M2', exact: true })).toBeVisible();
  const beforeAmplitude = await displayedNumber(page, 'Amplitude totale à M2');
  const beforePressure = Number(await page.getByTestId('oscilloscope').getAttribute('data-sample-y2'));
  await setNumber(page, 'Position de M2', '40,001');
  await expect(page.getByRole('slider', { name: 'Position longitudinale de l’hydrophone M2', exact: true })).toBeVisible();
  const afterAmplitude = await displayedNumber(page, 'Amplitude totale à M2');
  const afterPressure = Number(await page.getByTestId('oscilloscope').getAttribute('data-sample-y2'));
  expect(Math.abs(afterAmplitude - beforeAmplitude)).toBeLessThan(.0001);
  expect(Math.abs(afterPressure - beforePressure)).toBeLessThan(.0001);
});

test('interface conservée en phase libre : deux amplitudes idéales et aucun calcul de réflexion appliqué aux signaux', async ({ page }) => {
  await mediumButtons(page).getByRole('button', { name: 'Air → Eau', exact: true }).click();
  await page.getByRole('combobox', { name: 'Modèle', exact: true }).selectOption('free');
  await setNumber(page, 'Retard de phase libre', '450');
  await expect(metricValue(page, 'Retard de phase total')).toContainText('5π/2');
  expect(await displayedNumber(page, 'Amplitude de référence')).toBe(1);
  expect(await displayedNumber(page, 'Amplitude reçue')).toBe(1);
  expect(await displayedNumber(page, 'Décalage temporel mathématique')).toBe(1.25);
  await expect(page.getByRole('heading', { name: 'Réflexion et transmission à l’interface', exact: true })).toHaveCount(0);
  await expect(page.getByTestId('amplitude-envelope')).toHaveCount(0);
  await expect(page.locator('.dp-apparatus')).toHaveAttribute('data-configuration', 'air-water');
  await expect(input(page, 'Position de l’interface')).toHaveValue('40');
  await expect(input(page, 'Déplacer M2')).toHaveValue('60');
  expect(Number(await page.getByTestId('oscilloscope').getAttribute('data-sample-y2'))).toBeCloseTo(-1, 10);
  await page.getByRole('combobox', { name: 'Modèle', exact: true }).selectOption('microphones');
  await expect(page.getByRole('heading', { name: 'Réflexion et transmission à l’interface', exact: true })).toBeVisible();
  await expect(input(page, 'Position de M2')).toHaveValue('60');
});

for (const width of [320, 390, 768]) test(`interface mobile ${width}px : quatre choix de milieu, deux sens et thèmes sans débordement`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const choices = mediumButtons(page).getByRole('button');
  await expect(choices).toHaveCount(4);
  for (const direction of ['Air → Eau', 'Eau → Air']) {
    await mediumButtons(page).getByRole('button', { name: direction, exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Les capteurs et l’interface air–eau', exact: true })).toBeVisible();
    for (const choice of await choices.all()) await expect(choice).toBeVisible();
    const toolbar = await mediumButtons(page).boundingBox();
    expect(toolbar!.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const positionBefore = await input(page, 'Position de M2').inputValue();
    await setNumber(page, 'Déplacer l’interface', '45');
    await expect(input(page, 'Position de l’interface')).toHaveValue('45');
    await expect(input(page, 'Position de M2')).toHaveValue(positionBefore);
  }
  await page.getByRole('button', { name: 'Activer le thème sombre' }).click();
  await expect(page.locator('.dephasage-lab')).toHaveAttribute('data-lab-theme', 'dark');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Activer le thème clair' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('interface Eau → Air : examiner la voie faible agrandit sa trace réelle sans normaliser sa tension', async ({ page }) => {
  await mediumButtons(page).getByRole('button', { name: 'Eau → Air', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'CH1 / M1', exact: true })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'CH2 / M2', exact: true })).toBeChecked();
  const scope = page.getByTestId('oscilloscope'), trace = page.getByTestId('trace-ch2');
  const beforeTrace = (await trace.getAttribute('d'))!;
  const beforeSample = await scope.getAttribute('data-sample-y2');
  const beforeAmplitude = await metricValue(page, 'Amplitude totale à M2').textContent();
  const transmitted = 2 * 408 / (998 * 1480 + 408);
  const amplitude = transmitted * Math.exp(-.05 * .4 - .2 * .2);
  const travel = .4 / 1480 + .2 / 340;
  expect(Number(beforeSample)).toBeCloseTo(amplitude * Math.sin(-2 * Math.PI * 1000 * travel), 12);
  const sensitivity = page.getByRole('combobox', { name: 'Sensibilité commune', exact: true });
  await expect(sensitivity).toHaveValue('0.5');
  await page.getByRole('button', { name: 'Examiner la voie faible', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'CH1 / M1', exact: true })).not.toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'CH2 / M2', exact: true })).toBeChecked();
  await expect(page.getByTestId('trace-ch1')).toHaveCount(0);
  await expect(trace).toBeVisible();
  await expect(sensitivity).toHaveValue('0.0002');
  await expect(scope).toHaveAttribute('data-sample-y2', beforeSample!);
  await expect(metricValue(page, 'Amplitude totale à M2')).toHaveText(beforeAmplitude!);
  await expect(page.getByTestId('weak-channel-inspection')).toContainText('CH1 est masquée');
  await expect(page.getByTestId('weak-channel-inspection')).toContainText('aucune voie n’est normalisée séparément');
  const afterTrace = (await trace.getAttribute('d'))!;
  expect(afterTrace).not.toBe(beforeTrace);
  const ys = [...afterTrace.matchAll(/[ML][\d.]+,([\d.-]+)/g)].map(match => Number(match[1]));
  const extent = Math.max(...ys) - Math.min(...ys);
  const plotHeight = Number(await scope.locator('.dp-scope-background').getAttribute('height'));
  // La hauteur est celle de la tension réelle divisée par la seule gamme V/div,
  // et non celle d’une voie ramenée artificiellement à une amplitude de 1 V.
  expect(extent).toBeCloseTo(2 * amplitude / .0002 * plotHeight / 8, 1);
  expect(extent).toBeGreaterThan(100);
  expect(extent).toBeLessThan(plotHeight);
  await page.getByRole('button', { name: 'Réafficher les deux voies', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'CH1 / M1', exact: true })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'CH2 / M2', exact: true })).toBeChecked();
  await expect(sensitivity).toHaveValue('0.5');
  await expect(page.getByTestId('trace-ch1')).toBeVisible();
  await expect(trace).toHaveAttribute('d', beforeTrace);
  await expect(scope).toHaveAttribute('data-sample-y2', beforeSample!);
});
