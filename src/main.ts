import './style.css';
import { initial, physics, sample, waveAt, number as fmt, radians, reduced, TAU, type Parameters } from './model';

let p: Parameters = { ...initial }, time = 0, playing = true, speed = 0.5;
let view = 'sync', periods = 2, timeBase = 1, vertical = 1, showA = true, showB = true;
let measure1 = 0.3, measure2 = 0.65, presentation = false;
const playbackIcon = (paused: boolean) => paused ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4l14 8-14 8z" fill="currentColor"/></svg>' : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5v14M17 5v14" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>';
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const app = $('app');
const icon = `<svg viewBox="0 0 36 36" aria-hidden="true"><path d="M2 18c6-18 10-18 16 0s10 18 16 0"/><path d="M2 26c6-18 10-18 16 0s10 18 16 0"/></svg>`;
app.innerHTML = `
<header class="topbar"><a class="brand" href="#" aria-label="Phase Lab, accueil"><span class="brand-icon">${icon}</span>Phase Lab<span class="brand-separator"></span><span class="brand-tag">LE LABORATOIRE DES ONDES</span></a><div class="top-actions"><a href="#comprendre" class="understand-link">Comprendre <span>→</span></a><button id="presentation" class="outline"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5"/></svg><span>Mode présentation</span></button></div></header>
<main><section class="intro"><div><div class="eyebrow"><span class="tiny-dot"></span> PHYSIQUE INTERACTIVE · 2ᵉ BAC</div><h1>Explorer le déphasage<span>.</span></h1><p>Manipulez. Observez. Comprenez.</p></div><div class="live-label"><span class="tiny-dot"></span> Un modèle, une seule horloge</div></section>
<div class="lab-layout"><aside class="card settings"><details id="parameters" open><summary><span><span class="section-number">01</span> Les paramètres</span><span class="fold">⌄</span></summary><div class="settings-content">
<label class="label" for="mode">MODÈLE PHYSIQUE</label><select id="mode"><option value="phase">Déphasage réglable</option><option value="wave">Deux points d’une même onde</option></select><p class="small" id="mode-description"></p>
<div class="control"><div class="control-heading"><label for="frequency">Fréquence <i>f</i></label><div><output id="frequency-output"></output> <span>Hz</span></div></div><input id="frequency" type="range" min="0.1" max="5" step="0.1" value="1"><div class="range-labels"><span>0,1 Hz</span><span>5 Hz</span></div></div>
<div class="control"><div class="control-heading"><label for="velocity">Célérité <i>v</i></label><div><output id="velocity-output"></output> <span>m/s</span></div></div><input id="velocity" type="range" min="0.1" max="10" step="0.1" value="2"><div class="range-labels"><span>0,1 m/s</span><span>10 m/s</span></div></div>
<div class="control"><div class="control-heading"><label for="amplitude">Amplitude <i>A</i></label><div><output id="amplitude-output"></output> <span>cm</span></div></div><input id="amplitude" type="range" min="0.1" max="5" step="0.1" value="2"><div class="range-labels"><span>0,1 cm</span><span>5 cm</span></div></div>
<div class="control" id="phase-control"><div class="control-heading"><label for="phase">Déphasage <i>Δφ</i></label><div class="numeric"><input id="phase-number" aria-label="Déphasage en degrés" type="number" min="-720" max="720" step="any" value="90"><span>°</span></div></div><input id="phase" type="range" min="-720" max="720" step="1" value="90"><div class="range-labels"><span>−720°</span><span>+720°</span></div></div>
<div class="control" id="distance-control" hidden><div class="control-heading"><label for="distance">Distance <i>AB</i></label><div class="numeric"><input id="distance-number" aria-label="Distance AB en mètres" type="number" min="0" max="1000" step="any" value="0.5"><span>m</span></div></div><input id="distance" aria-label="Distance en multiples de longueur d’onde" type="range" min="0" max="4" step="0.01" value="0.25"><div class="range-labels"><span>0 λ</span><span id="distance-ratio"></span><span id="distance-max">4 λ</span></div></div>
<div class="preset-section"><div class="label">EXPÉRIENCES À EXPLORER</div><div id="presets" class="presets"></div></div><button id="restore" class="text-button">↺ Restaurer les paramètres initiaux</button>
<div class="convention"><span class="label">NOTRE CONVENTION</span><strong>Δφ = φ<sub>B</sub> − φ<sub>A</sub></strong><p>Une phase positive : B en avance.<br>Une phase négative : B en retard.<br><span class="small">Sens interprété sur la phase réduite ; à π, les signaux sont opposés.</span></p></div>
</div></details></aside>
<div class="workspace"><nav class="tabs" aria-label="Visualisations" role="tablist"><button role="tab" id="tab-sync" aria-controls="visuals" data-view="sync" aria-selected="true">Vue synchronisée</button><button role="tab" id="tab-scope" aria-controls="visuals" data-view="scope" aria-selected="false" tabindex="-1">Oscilloscope</button><button role="tab" id="tab-circles" aria-controls="visuals" data-view="circles" aria-selected="false" tabindex="-1">Cercles de phase</button><button role="tab" id="tab-wave" aria-controls="visuals" data-view="wave" aria-selected="false" tabindex="-1">Onde progressive</button></nav>
<div class="visuals" id="visuals" role="tabpanel" aria-labelledby="tab-sync"><section class="card graph-card circles-panel" id="circles-panel"><div class="card-heading"><div><span class="eyebrow">LE MOUVEMENT CIRCULAIRE</span><h2>Deux phases, un même rythme</h2></div><span class="badge" id="status"></span></div><div id="circles" class="svg-holder"></div><div class="graph-foot"><span><span class="dot a"></span> A · référence</span><span><span class="dot b"></span> B · déphasé</span><span class="small">Projection horizontale : s/A = cos(θ)</span></div><p class="interaction-hint" id="circle-hint"></p></section>
<section class="card graph-card scope-panel" id="scope-panel"><div class="card-heading"><div><span class="eyebrow">L’ÉVOLUTION DANS LE TEMPS</span><h2>Oscilloscope à deux voies</h2></div><div class="legend"><label><input type="checkbox" id="show-a" checked><span class="dot a"></span> Voie A</label><label><input type="checkbox" id="show-b" checked><span class="dot b"></span> Voie B</label></div></div><div class="scope-tools secondary"><label>Périodes <select id="periods"><option>1</option><option selected>2</option><option>3</option></select></label><label>Base de temps <select id="time-base"><option value="0.5">0,5×</option><option value="1" selected>1×</option><option value="2">2×</option></select></label><label>Échelle verticale <select id="vertical"><option value="0.5">0,5×</option><option value="1" selected>1×</option><option value="2">2×</option></select></label></div><div id="scope" class="svg-holder"></div><div class="scope-readout"><span id="measurement"></span><span>Δφ = −2π τ/T</span></div><p class="interaction-hint">En pause, glissez le curseur turquoise pour déplacer l’instant commun. Les deux curseurs gris mesurent un intervalle.</p></section>
<section class="card graph-card wave-panel" id="wave-panel"><div class="card-heading"><div><span class="eyebrow">LE PROFIL DANS L’ESPACE</span><h2>Une onde, deux points d’observation</h2></div><span class="propagation">Propagation +x →</span></div><div id="wave" class="svg-holder"></div><p class="interaction-hint" id="wave-hint"></p></section></div>
<section class="card transport"><div class="playback"><button id="play" class="play" aria-label="Mettre en pause">Ⅱ</button><button id="reset-time" class="icon-button" aria-label="Réinitialiser le temps" title="Réinitialiser le temps">↺</button><button id="step" class="icon-button" aria-label="Avancer de T/24" title="Avancer de T/24">▸|</button><div class="time-display"><span class="label">TEMPS SIMULÉ</span><strong id="time-output"></strong></div></div><div class="speed-control"><label for="speed">Vitesse</label><select id="speed"><option value="0.1">0,1×</option><option value="0.25">0,25×</option><option value="0.5" selected>0,5×</option><option value="1">1×</option><option value="2">2×</option></select><span class="playing-status" id="playing-status"></span></div></section>
<section class="metrics" aria-label="Valeurs physiques" id="metrics"></section>
<section class="explanation card"><span class="insight-icon">↔</span><div><div class="eyebrow">CE QUE VOUS OBSERVEZ</div><h2 id="explanation-title"></h2><p id="explanation-text"></p><p class="small" id="ambiguity"></p></div></section>
</div></div>
<section class="understanding" id="comprendre"><div class="understanding-title"><span class="eyebrow">DU GESTE À L’IDÉE</span><h2>Comprendre le déphasage.</h2><p>Une même oscillation, observée à deux phases différentes.</p></div><div class="lesson-grid"><article class="card lesson"><span class="lesson-number">01 / LA PHASE</span><h3>Où en est l’oscillation ?</h3><p>La phase θ repère l’avancement dans un cycle. Un tour vaut 2π rad, soit 360°. Le déphasage Δφ compare les phases de B et de A au même instant.</p><div class="formula">s<sub>A</sub>(t) = A cos(ωt)<br>s<sub>B</sub>(t) = A cos(ωt + Δφ)</div></article><article class="card lesson"><span class="lesson-number">02 / LE TEMPS ET L’ESPACE</span><h3>Deux façons de mesurer un cycle.</h3><p>La période T est la durée d’une oscillation en un point. La longueur d’onde λ est la distance entre deux crêtes au même instant. La célérité v relie ces mesures.</p><div class="formula">T = 1/f · ω = 2πf<br>λ = v/f = vT</div></article><article class="card lesson"><span class="lesson-number">03 / LE RETARD</span><h3>Décaler le signal dans le temps.</h3><p>Le retard signé τ vérifie s<sub>B</sub>(t) = s<sub>A</sub>(t − τ). Si τ &gt; 0, B est en retard ; si τ &lt; 0, B est en avance. Le décalage montré entre maxima est réduit, le retard total est affiché séparément.</p><div class="formula">τ = −Δφ/ω<br>Δφ = −2π τ/T</div></article><article class="card lesson"><span class="lesson-number">04 / L’ONDE PROGRESSIVE</span><h3>Un mouvement qui se transmet.</h3><p>Pour une propagation vers +x, B, situé à d ≥ 0, reproduit le mouvement de A avec le retard d/v. Les points oscillent sur place ; les crêtes se déplacent.</p><div class="formula">y(x,t) = A cos(ωt − kx)<br>k = 2π/λ · Δφ = −2πd/λ</div></article></div><div class="cycle-note"><strong>Un retard d’une période… et pourtant en phase.</strong><p>Pour d = λ, τ = T et Δφ = −2π : les élongations sont identiques à chaque instant. Deux sinusoïdes seules ne révèlent pas le nombre entier de périodes de retard. Le modèle décrit une onde sinusoïdale établie, sans front de démarrage, sans amortissement et sans dispersion.</p></div></section>
<footer><a class="brand" href="#">${icon} Phase Lab</a><span>Réalisé par Adam — 2ᵉ Bac Sciences Mathématiques</span><span>La physique, en mouvement.</span></footer></main>`;

function presets() {
  const items = p.mode === 'phase' ? [['En phase', 0, '0'], ['Quadrature', 90, 'π/2'], ['Opposition', 180, 'π'], ['B en retard', -90, '−π/2'], ['Un tour complet', 360, '2π']] : [['Un quart d’onde', 0.25, 'λ/4'], ['Une demi-onde', 0.5, 'λ/2'], ['Une onde', 1, 'λ'], ['Deux ondes', 2, '2λ']];
  $('presets').innerHTML = items.map(([name, value, symbol]) => `<button data-preset="${value}"><span>${name}</span><span>${symbol}</span></button>`).join('');
}
function change() { time = 0; syncControls(); render(); }
function syncControls() {
  const m = physics(p);
  for (const key of ['frequency', 'velocity', 'amplitude'] as const) { $(key + '-output').textContent = fmt(p[key]); ($<HTMLInputElement>(key)).value = String(p[key]); }
  $<HTMLSelectElement>('mode').value = p.mode;
  $<HTMLInputElement>('phase').value = String(p.phaseDegrees);
  if (document.activeElement !== $('phase-number')) $<HTMLInputElement>('phase-number').value = String(p.phaseDegrees);
  if (document.activeElement !== $('distance-number')) $<HTMLInputElement>('distance-number').value = String(Math.round(p.distance * 1e6) / 1e6);
  const max = Math.max(4, Math.ceil(p.distance / m.wavelength));
  $<HTMLInputElement>('distance').max = String(max);
  $<HTMLInputElement>('distance').value = String(p.distance / m.wavelength);
  $('distance-ratio').textContent = fmt(p.distance / m.wavelength) + ' λ';
  $('distance-max').textContent = `${max} λ`;
  $('phase-control').hidden = p.mode !== 'phase'; $('distance-control').hidden = p.mode !== 'wave';
  $('mode-description').textContent = p.mode === 'phase' ? 'Deux oscillations de même fréquence. Choisissez librement leur déphasage.' : 'Une onde vers +x. A est à l’origine ; B est à la distance d. Le déphasage est calculé.';
  const active = p.mode === 'phase' ? p.phaseDegrees : p.distance / m.wavelength;
  document.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach(b => { const selected = Math.abs(Number(b.dataset.preset) - active) < 1e-6; b.classList.toggle('selected', selected); b.setAttribute('aria-pressed', String(selected)); });
}
function svg(content: string, w: number, h: number, label: string) { return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}" xmlns="http://www.w3.org/2000/svg">${content}</svg>`; }
const text = (x: number, y: number, value: string, cls = '', anchor = 'middle') => `<text x="${x}" y="${y}" class="${cls}" text-anchor="${anchor}">${value}</text>`;
const line = (x1: number, y1: number, x2: number, y2: number, cls: string) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${cls}"/>`;
function path(fn: (x: number) => [number, number], steps = 400) { return Array.from({ length: steps + 1 }, (_, i) => { const [x, y] = fn(i / steps); return `${i ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`; }).join(' '); }
function drawCircles() {
  const s = sample(p, time), m = physics(p), r = 76, cy = 119, compact = matchMedia('(max-width: 760px)').matches;
  let out = '';
  (compact ? [151, 449] : [157, 452]).forEach((cx, i) => {
    const theta = i ? s.thetaB : s.thetaA, x = cx + r * Math.cos(theta), y = cy - r * Math.sin(theta), color = i ? 'b' : 'a';
    out += `<circle cx="${cx}" cy="${cy}" r="${r}" class="circle-grid"/>`;
    out += line(cx - 90, cy, cx + 90, cy, 'axis') + line(cx, cy - 90, cx, cy + 90, 'axis');
    out += `<path d="M${cx - 30},${cy - 90}q-30,10 -38,34l-2,-10m2,10 9,-4" class="rotation"/>`;
    out += text(cx + 96, cy + 5, '0', 'tick') + text(cx, cy - 98, 'π/2', 'tick') + text(cx - 99, cy + 5, 'π', 'tick') + text(cx, cy + 101, '3π/2', 'tick');
    out += line(cx, cy, x, y, `ray ${color}-stroke`) + line(x, y, x, cy, `projection ${color}-stroke`);
    out += `<circle cx="${cx}" cy="${cy}" r="3" fill="#708396"/><circle cx="${x}" cy="${cy}" r="4" class="${color}-fill" opacity=".5"/><circle cx="${x}" cy="${y}" r="8" class="${color}-fill"/>`;
    if (i) out += `<circle cx="${x}" cy="${y}" r="20" class="drag-target" data-drag="phase"/>`;
    out += text(cx, 257, `${i ? 'B' : 'A'} · θ = ${fmt(((theta % TAU + TAU) % TAU) * 180 / Math.PI, 1)}°`, `point-label ${color}-text`);
    out += text(cx, 280, `s${i ? 'B' : 'A'} = ${fmt(i ? s.b : s.a)} cm`, 'elongation');
  });
  const cx = compact ? 305 : 741, cr = 45, theta = s.thetaA, phi = m.phaseReduced;
  out += compact ? '<g transform="translate(0,290)">' : '<g>';
  out += `<rect x="${cx - 112}" y="30" width="224" height="249" rx="18" class="comparison-bg"/>` + text(cx, 58, 'COMPARER LES PHASES', 'mini-label');
  out += `<circle cx="${cx}" cy="139" r="${cr}" class="circle-grid"/>`;
  [theta, theta + phi].forEach((angle, i) => { out += line(cx, 139, cx + cr * Math.cos(angle), 139 - cr * Math.sin(angle), `ray ${i ? 'b' : 'a'}-stroke`); });
  const arc = path(u => [cx + 28 * Math.cos(theta + phi * u), 139 - 28 * Math.sin(theta + phi * u)], 40);
  out += `<path d="${arc}" class="phase-arc"/>` + text(cx, 217, `Δφ réduit = ${fmt(phi * 180 / Math.PI, 1)}°`, 'comparison-value') + text(cx, 243, 'Une origine commune', 'tick');
  out += '</g>';
  $('circles').innerHTML = svg(out, compact ? 600 : 876, compact ? 580 : 300, 'Cercles A et B : rotation antihoraire et projection horizontale du cosinus');
  $('circle-hint').textContent = p.mode === 'wave' ? 'Le déphasage de B est imposé par la distance : Δφ = −2πd/λ.' : playing ? 'Mettez en pause pour déplacer le point B sur son cercle.' : 'Glissez B pour régler sa phase (tour le plus proche, aimantation aux quarts de tour). La saisie permet −720° à +720°.';
}
function scopeWindow() { const m = physics(p), duration = periods * timeBase * m.period, start = Math.floor(time / duration) * duration; return { m, duration, start }; }
function drawScope() {
  const { m, duration, start } = scopeWindow(), left = 66, right = 840, top = 28, bottom = 235, mid = (top + bottom) / 2, scale = (bottom - top) / (2 * p.amplitude * 1.35 * vertical);
  const X = (t: number) => left + (t - start) / duration * (right - left), Y = (a: number) => mid - a * scale;
  let out = `<defs><clipPath id="scope-clip"><rect x="${left}" y="${top}" width="${right - left}" height="${bottom - top}"/></clipPath><marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10" fill="#768b9a"/></marker></defs>`;
  const divisions = matchMedia('(max-width: 760px)').matches ? 4 : 8;
  for (let i = 0; i <= divisions; i++) { const x = left + (right - left) * i / divisions; out += line(x, top, x, bottom, 'grid') + text(x, 258, fmt(start + duration * i / divisions, 3), 'tick'); }
  for (let i = -2; i <= 2; i++) { const value = p.amplitude * vertical * i / 2; out += line(left, Y(value), right, Y(value), i === 0 ? 'axis' : 'grid') + text(53, Y(value) + 4, fmt(value), 'tick', 'end'); }
  out += text(left, 15, 's (cm)', 'tick', 'start') + text(right, 282, 't (s)', 'tick', 'end');
  out += `<g clip-path="url(#scope-clip)">`;
  [showA, showB].forEach((show, i) => { if (show) out += `<path d="${path(u => { const t = start + u * duration; return [X(t), Y(p.amplitude * Math.cos(m.omega * t + (i ? m.phase : 0)))]; })}" class="signal ${i ? 'b' : 'a'}-stroke"/>`; });
  const s = sample(p, time), xNow = X(time);
  out += line(xNow, top, xNow, bottom, 'time-cursor');
  if (showA) out += `<circle cx="${xNow}" cy="${Y(s.a)}" r="6" class="a-fill sample-point"/>`;
  if (showB) out += `<circle cx="${xNow}" cy="${Y(s.b)}" r="6" class="b-fill sample-point"/>`;
  out += '</g>';
  // Corresponding maxima of the reduced shift are shown; whole cycles stay in the numeric total.
  const tA = Math.max(start, start - m.reducedDelay);
  const maxA = Math.ceil(tA / m.period - 1e-9) * m.period, maxB = maxA + m.reducedDelay;
  if (showA && duration >= m.period) {
    const first = Math.ceil(start / m.period - 1e-9) * m.period;
    if (first + m.period <= start + duration + 1e-9) out += line(X(first), 302, X(first + m.period), 302, 'dimension') + text(X(first + m.period / 2), 321, `T = ${fmt(m.period, 3)} s`, 'tick');
  }
  if (showA && showB && maxA <= start + duration && maxB >= start && maxB <= start + duration && Math.abs(m.reducedDelay) > 1e-8) {
    out += line(X(maxA), 28, X(maxA), 54, 'measure-guide') + line(X(maxB), 28, X(maxB), 54, 'measure-guide') + line(X(maxA), 39, X(maxB), 39, 'dimension') + text((X(maxA) + X(maxB)) / 2, 23, `τ réduit = ${fmt(m.reducedDelay, 3)} s`, 'tick');
  }
  [measure1, measure2].forEach((u, i) => { const x = left + u * (right - left); out += line(x, 60, x, bottom, 'measure-cursor') + `<rect x="${x - 8}" y="48" width="16" height="16" rx="4" class="measure-handle"/>` + text(x, 60, `${i + 1}`, 'handle-text') + `<rect x="${x - 13}" y="45" width="26" height="${bottom - 45}" class="drag-target" data-drag="measure${i + 1}"/>`; });
  out += `<path d="M${xNow - 7},${bottom + 6}L${xNow + 7},${bottom + 6}L${xNow},${bottom - 2}Z" class="a-fill"/><rect x="${xNow - 11}" y="${bottom - 5}" width="22" height="30" class="drag-target" data-drag="time"/>`;
  $('scope').innerHTML = svg(out, 876, 335, 'Oscilloscope : élongation en centimètres en fonction du temps en secondes');
  if (document.activeElement !== $('measure1-input')) $<HTMLInputElement>('measure1-input').value = String(Math.round(measure1 * 100));
  if (document.activeElement !== $('measure2-input')) $<HTMLInputElement>('measure2-input').value = String(Math.round(measure2 * 100));
  $<HTMLInputElement>('time-scrub').value = String(Math.round((time - start) / duration * 1000));
  $('measurement').textContent = `Curseurs : Δt = ${fmt(Math.abs(measure2 - measure1) * duration, 3)} s · ${fmt(Math.abs(measure2 - measure1) * duration / m.period)} T`;
}
function waveWindow() { const m = physics(p); return { m, left: 66, right: 840, extent: Math.max(2.2 * m.wavelength, p.distance * 1.2, m.wavelength * 0.5) }; }
function drawWave() {
  if (p.mode === 'phase') {
    if ($('wave').dataset.mode === 'phase') return;
    $('wave').dataset.mode = 'phase';
    $('wave').innerHTML = `<div class="wave-empty"><span class="wave-symbol">∿</span><div><h3>Et si le déphasage venait d’une distance ?</h3><p>Aucune distance physique AB n’est imposée dans le mode réglable. La longueur d’onde λ = v/f est celle de l’onde progressive associée.</p><button id="activate-wave" class="outline">Explorer deux points d’une même onde →</button></div></div>`;
    $('wave-hint').textContent = 'Le profil spatial devient disponible avec le modèle « Deux points d’une même onde ».';
    return;
  }
  $('wave').dataset.mode = 'wave';
  const { m, left, right, extent } = waveWindow(), mid = 100, scale = 51 / p.amplitude;
  const X = (x: number) => left + x / extent * (right - left), Y = (y: number) => mid - y * scale;
  let out = '';
  const divisions = matchMedia('(max-width: 760px)').matches ? 4 : 8;
  for (let i = 0; i <= divisions; i++) { const x = extent * i / divisions; out += line(X(x), 30, X(x), 163, 'grid') + text(X(x), 184, fmt(x), 'tick'); }
  [-1, 0, 1].forEach(i => { const y = Y(i * p.amplitude); out += line(left, y, right, y, i ? 'grid' : 'axis') + text(53, y + 4, fmt(i * p.amplitude), 'tick', 'end'); });
  out += text(left, 17, 'y (cm)', 'tick', 'start') + text(right, 207, 'x (m)', 'tick', 'end');
  if (extent / m.wavelength <= 40) out += `<path d="${path(u => [X(u * extent), Y(waveAt(p, u * extent, time))], Math.min(4000, Math.ceil(extent / m.wavelength * 100)))}" class="wave-path"/>`;
  else out += text((left + right) / 2, 79, 'Profil trop dense : rapprochez B pour distinguer les cycles.', 'tick');
  [0, p.distance].forEach((x, i) => { const px = X(x), py = Y(waveAt(p, x, time)); out += line(px, 30, px, 163, `projection ${i ? 'b' : 'a'}-stroke`) + `<circle cx="${px}" cy="${py}" r="8" class="${i ? 'b' : 'a'}-fill sample-point"/>` + text(px + (p.distance < extent * 0.06 ? (i ? 16 : -16) : 0), 29, i ? 'B' : 'A', `point-label ${i ? 'b' : 'a'}-text`); if (i) out += `<rect x="${px - 18}" y="26" width="36" height="140" class="drag-target" data-drag="distance"/>`; });
  out += line(X(0), 218, X(p.distance), 218, 'dimension') + text((X(0) + X(p.distance)) / 2, 239, `d = ${fmt(p.distance, 3)} m`, 'tick');
  const crest = ((p.velocity * time) % m.wavelength + m.wavelength) % m.wavelength;
  out += line(X(crest), 262, X(crest + m.wavelength), 262, 'dimension') + text(X(crest + m.wavelength / 2), 281, `λ = ${fmt(m.wavelength, 3)} m`, 'tick');
  $('wave').innerHTML = svg(out, 876, 296, 'Onde progressive vers les x croissants. A et B restent à leurs positions horizontales.');
  $('wave-hint').textContent = 'Glissez B horizontalement pour changer la distance. A et B oscillent sur place ; les crêtes se propagent vers la droite. Δφ est calculé, jamais réglé indépendamment.';
}
let readoutKey = '';
function updateReadouts() {
  $('time-output').textContent = `${fmt(time, 3)} s`;
  $('playing-status').textContent = playing ? '● En lecture' : 'En pause';
  $('play').innerHTML = playbackIcon(!playing); $('play').setAttribute('aria-label', playing ? 'Mettre en pause' : 'Reprendre la lecture');
  const next = JSON.stringify(p); if (readoutKey === next) return; readoutKey = next;
  const m = physics(p), deg = m.phase * 180 / Math.PI;
  $('status').textContent = m.status;
  const metrics = [
    ['LONGUEUR D’ONDE', `${fmt(m.wavelength, 3)} <small>m</small>`, 'λ = v/f'],
    ['PÉRIODE', `${fmt(m.period, 3)} <small>s</small>`, 'T = 1/f'],
    ['FRÉQUENCE', `${fmt(p.frequency)} <small>Hz</small>`, `ω = ${fmt(m.omega, 3)} rad/s`],
    ['DÉPHASAGE TOTAL', `${fmt(deg)}<small>°</small>`, `${radians(m.phase)} rad · réduit : ${fmt(m.phaseReduced * 180 / Math.PI)}°`],
    ['DÉCALAGE TOTAL SIGNÉ', `${fmt(m.delay, 4)} <small>s</small>`, m.delay > 1e-8 ? 'τ > 0 · retard de B' : m.delay < -1e-8 ? 'τ < 0 · avance de B' : 'τ = 0'],
    [p.mode === 'wave' ? 'DISTANCE AB' : 'CÉLÉRITÉ ASSOCIÉE', p.mode === 'wave' ? `${fmt(p.distance, 3)} <small>m</small>` : `${fmt(p.velocity)} <small>m/s</small>`, p.mode === 'wave' ? `d/λ = ${fmt(p.distance / m.wavelength, 3)} · v = ${fmt(p.velocity)} m/s` : 'Aucune distance AB imposée'],
  ];
  $('metrics').innerHTML = metrics.map(([name, value, sub]) => `<article class="card metric"><span class="label">${name}</span><strong>${value}</strong><span class="metric-sub">${sub}</span></article>`).join('');
  let title = m.status, description = '';
  if (p.mode === 'wave') {
    title = `À ${fmt(p.distance / m.wavelength)} λ, ${m.status.toLowerCase()}.`;
    description = `Pour d = ${fmt(p.distance, 3)} m, B reproduit le mouvement de A avec un retard τ = ${fmt(m.delay, 4)} s (${fmt(m.delay / m.period)} T). Le déphasage total vaut ${radians(m.phase)} rad. `;
    if (m.status === 'En phase' && p.distance > 0) description += 'Le retard est non nul, mais les oscillations sont identiques : un nombre entier de cycles les sépare.';
    else if (m.status === 'Opposition de phase') description += 'Quand A est à son maximum, B est à son minimum.';
    else description += 'Les marqueurs A et B gardent leur position horizontale.';
  } else {
    if (m.status === 'En phase') description = 'Les signaux se superposent : A et B ont la même élongation au même instant, à un nombre entier de tours près.';
    else if (m.status === 'Opposition de phase') description = 'Les élongations sont opposées à chaque instant : quand A atteint un maximum, B atteint un minimum.';
    else description = `Sur la phase réduite, B est ${m.phaseReduced > 0 ? 'en avance' : 'en retard'} sur A de ${fmt(Math.abs(m.reducedDelay), 4)} s (${fmt(Math.abs(m.reducedDelay) / m.period)} T). Les deux points tournent à la même vitesse angulaire.`;
    description += ` Le décalage total signé vaut τ = ${fmt(m.delay, 4)} s : sB(t) = sA(t − τ).`;
  }
  $('explanation-title').textContent = title; $('explanation-text').textContent = description;
  $('ambiguity').textContent = 'Le graphique compare des maxima avec un décalage réduit modulo T. Deux sinusoïdes seules ne permettent pas de connaître un nombre entier de périodes de retard. La valeur totale provient des paramètres du modèle.';
  $('time-output').textContent = `${fmt(time, 3)} s`;
  $('playing-status').textContent = playing ? '● En lecture' : 'En pause';
  $('play').innerHTML = playbackIcon(!playing); $('play').setAttribute('aria-label', playing ? 'Mettre en pause' : 'Reprendre la lecture');
}
function render() { drawCircles(); drawScope(); drawWave(); updateReadouts(); }
function setView(next: string) {
  view = next;
  ['circles', 'scope', 'wave'].forEach(v => { $(v + '-panel').hidden = !(view === 'sync' || view === v); });
  document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(b => { const selected = b.dataset.view === view; b.setAttribute('aria-selected', String(selected)); b.tabIndex = selected ? 0 : -1; });
  $('visuals').setAttribute('aria-labelledby', `tab-${view}`);
}
for (const key of ['frequency', 'velocity', 'amplitude'] as const) $(key).addEventListener('input', e => { p[key] = Number((e.target as HTMLInputElement).value); change(); });
function numeric(id: string, min: number, max: number, action: (n: number) => void) {
  $(id).addEventListener('input', e => { const input = e.target as HTMLInputElement; if (input.value === '' || !input.validity.valid) return; const value = Number(input.value); if (Number.isFinite(value) && value >= min && value <= max) { action(value); change(); } });
  $(id).addEventListener('change', syncControls);
  $(id).addEventListener('blur', () => { const input = $<HTMLInputElement>(id); if (id === 'phase-number') input.value = String(p.phaseDegrees); if (id === 'distance-number') input.value = String(Math.round(p.distance * 1e6) / 1e6); });
}
numeric('phase', -720, 720, n => p.phaseDegrees = n); numeric('phase-number', -720, 720, n => p.phaseDegrees = n);
numeric('distance', 0, 50000, n => p.distance = n * physics(p).wavelength); numeric('distance-number', 0, 1000, n => p.distance = n);
$('mode').addEventListener('change', e => { p.mode = (e.target as HTMLSelectElement).value as Parameters['mode']; presets(); change(); });
$('presets').addEventListener('click', e => { const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-preset]'); if (!b) return; const value = Number(b.dataset.preset); if (p.mode === 'phase') p.phaseDegrees = value; else p.distance = value * physics(p).wavelength; change(); });
$('restore').addEventListener('click', () => { p = { ...initial }; speed = 0.5; $<HTMLSelectElement>('speed').value = '0.5'; periods = 2; timeBase = vertical = 1; showA = showB = true; measure1 = .3; measure2 = .65; $<HTMLSelectElement>('periods').value = '2'; $<HTMLSelectElement>('time-base').value = $<HTMLSelectElement>('vertical').value = '1'; $<HTMLInputElement>('show-a').checked = $<HTMLInputElement>('show-b').checked = true; presets(); change(); });
$('play').addEventListener('click', () => { playing = !playing; render(); });
$('reset-time').addEventListener('click', () => { time = 0; render(); });
$('step').addEventListener('click', () => { playing = false; time += physics(p).period / 24; render(); });
$('speed').addEventListener('change', e => speed = Number((e.target as HTMLSelectElement).value));
for (const id of ['periods', 'time-base', 'vertical']) $(id).addEventListener('change', e => { const n = Number((e.target as HTMLSelectElement).value); if (id === 'periods') periods = n; else if (id === 'time-base') timeBase = n; else vertical = n; render(); });
for (const id of ['show-a', 'show-b']) $(id).addEventListener('change', e => { if (id === 'show-a') showA = (e.target as HTMLInputElement).checked; else showB = (e.target as HTMLInputElement).checked; render(); });
document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(b => {
  b.addEventListener('click', () => setView(b.dataset.view!));
  b.addEventListener('keydown', e => { const buttons = [...document.querySelectorAll<HTMLButtonElement>('[data-view]')], index = buttons.indexOf(b); let next: number | undefined; if (e.key === 'ArrowRight') next = (index + 1) % buttons.length; if (e.key === 'ArrowLeft') next = (index + buttons.length - 1) % buttons.length; if (e.key === 'Home') next = 0; if (e.key === 'End') next = buttons.length - 1; if (next !== undefined) { e.preventDefault(); buttons[next].focus(); setView(buttons[next].dataset.view!); } });
});
$('wave').addEventListener('click', e => { if ((e.target as HTMLElement).closest('#activate-wave')) { p.mode = 'wave'; presets(); change(); } });
async function setPresentation(next: boolean) {
  presentation = next; document.body.classList.toggle('presentation', next);
  $('presentation').innerHTML = next ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h5V4m6 0v5h5M9 20v-5H4m11 5v-5h5"/></svg><span>Quitter la présentation</span>' : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5"/></svg><span>Mode présentation</span>';
  if (next && !document.fullscreenElement) { try { await document.documentElement.requestFullscreen(); } catch { /* Presentation remains usable when fullscreen is unavailable. */ } }
  else if (!next && document.fullscreenElement) await document.exitFullscreen();
}
$('presentation').addEventListener('click', () => void setPresentation(!presentation));
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && presentation) { presentation = false; document.body.classList.remove('presentation'); $('presentation').innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5"/></svg><span>Mode présentation</span>'; } });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && presentation) void setPresentation(false); });

// Dragging is handled on the stable document, because SVG contents update every frame.
let drag: { type: string; extent?: number; start?: number; duration?: number; phaseStart?: number } | null = null;
function coordinate(e: PointerEvent, element: HTMLElement, width: number, height: number) {
  const bounds = element.querySelector('svg')!.getBoundingClientRect();
  return { x: (e.clientX - bounds.left) / bounds.width * width, y: (e.clientY - bounds.top) / bounds.height * height };
}
document.addEventListener('pointerdown', e => {
  const target = (e.target as Element).closest<SVGElement>('[data-drag]'); if (!target) return;
  const type = target.dataset.drag!;
  if ((type === 'phase' && (playing || p.mode !== 'phase')) || (type === 'time' && playing)) return;
  const win = scopeWindow(); drag = { type, extent: waveWindow().extent, start: win.start, duration: win.duration, phaseStart: physics(p).phase };
  e.preventDefault();
});
document.addEventListener('pointermove', e => {
  if (!drag) return;
  e.preventDefault();
  if (drag.type === 'phase') {
    const compact = matchMedia('(max-width: 760px)').matches;
    const { x, y } = coordinate(e, $('circles'), compact ? 600 : 876, compact ? 580 : 300);
    const angle = Math.atan2(119 - y, x - (compact ? 449 : 452)), raw = angle - physics(p).omega * time;
    const total = raw + TAU * Math.round((drag.phaseStart! - raw) / TAU);
    const degrees = total * 180 / Math.PI, nearest = Math.round(degrees / 90) * 90;
    p.phaseDegrees = Math.max(-720, Math.min(720, Math.abs(degrees - nearest) < 1.5 ? nearest : Math.round(degrees * 10) / 10)); syncControls();
  } else if (drag.type === 'distance') {
    const { x } = coordinate(e, $('wave'), 876, 296); const raw = Math.max(0, Math.min(1000, (x - 66) / 774 * drag.extent!)), wavelength = physics(p).wavelength, quarter = Math.round(raw / wavelength * 4) / 4;
    p.distance = Math.abs(raw / wavelength - quarter) < .01 ? quarter * wavelength : raw; syncControls();
  } else {
    const { x } = coordinate(e, $('scope'), 876, 335), u = Math.max(0, Math.min(1 - 1e-9, (x - 66) / 774));
    if (drag.type === 'time') time = drag.start! + u * drag.duration!;
    else if (drag.type === 'measure1') measure1 = u; else measure2 = u;
  }
  render();
}, { passive: false });
document.addEventListener('pointerup', () => { drag = null; });
window.addEventListener('resize', render);
document.addEventListener('pointercancel', () => { drag = null; });
// SVG drags have keyboard equivalents: phase/distance numeric inputs and the step button.
// Measurement cursors also have explicit accessible numeric controls.
$('measurement').insertAdjacentHTML('afterend', `<label class="cursor-input">C1 (%) <input id="measure1-input" aria-label="Position du curseur de mesure 1 en pourcentage" type="number" min="0" max="100" value="30"></label><label class="cursor-input">C2 (%) <input id="measure2-input" aria-label="Position du curseur de mesure 2 en pourcentage" type="number" min="0" max="100" value="65"></label>`);
for (const i of [1, 2]) $(`measure${i}-input`).addEventListener('input', e => { const v = (e.target as HTMLInputElement).valueAsNumber; if (Number.isFinite(v) && v >= 0 && v <= 100) { if (i === 1) measure1 = v / 100; else measure2 = v / 100; render(); } });
$('scope-panel').insertAdjacentHTML('beforeend', `<div class="time-scrub secondary"><label for="time-scrub">Instant commun (pause)</label><input id="time-scrub" type="range" min="0" max="1000" step="1" value="0" aria-label="Déplacer l’instant commun dans la fenêtre de temps"><span class="small">Glisser ou utiliser les flèches</span></div>`);
$('time-scrub').addEventListener('input', e => { playing = false; const win = scopeWindow(); time = win.start + Number((e.target as HTMLInputElement).value) / 1000 * win.duration * (1 - 1e-9); render(); });
if (matchMedia('(max-width: 760px)').matches) $<HTMLDetailsElement>('parameters').open = false;
if (matchMedia('(prefers-reduced-motion: reduce)').matches) playing = false;
presets(); syncControls(); render();
let previous = performance.now(), lastPaint = 0;
function animate(now: number) {
  const delta = Math.min((now - previous) / 1000, .1); previous = now;
  if (playing && !document.hidden) time += delta * speed;
  if (playing && now - lastPaint >= 1000 / 30) { render(); lastPaint = now; }
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
