# Phase Lab — Le son, une question de phase

Laboratoire pédagogique interactif en français, pour la deuxième année du baccalauréat Sciences Mathématiques au Maroc. Deux microphones, un oscilloscope à deux voies et deux cercles de phase partagent **un moteur scientifique et une seule horloge**. Application statique React 19 + TypeScript + Vite, sans serveur applicatif ni clé API.

## Démarrer

Node.js 24 et npm sont recommandés (`.nvmrc`). Dans le checkout du projet :

```sh
npm ci
npm run dev
```

Ouvrir l’adresse indiquée par Vite. Utiliser le checkout existant dans l’environnement cloud ; il est déjà isolé, sans besoin de créer un worktree.

```sh
npm run build    # vérification TypeScript, puis production dans dist/
npm run preview  # servir la version construite
npm test         # vérifications numériques du moteur
```

## Expérimenter

- Valeurs initiales : **f = 1 000 Hz**, **c = 340 m/s**, **Δx = 13,3 cm**, **λ = 34 cm**, **A₁ = 1 V** ; milieu **air**, atténuation **activée** par défaut.
- M1 fixe à x₀ = 20 cm du haut-parleur ; M2 se déplace de 0 à 200 cm par rapport à M1. Règle, projections et double flèche montrent les positions longitudinales. Les rails sont décalés pour rendre les dessins distincts ; le modèle est sur un même axe.
- Déplacer M2 par glissement souris/tactile, curseur, saisie avec virgule ou point, ou au clavier sur la poignée : flèches ±0,1 cm, Maj + flèche ±1 cm, Début à 0, Fin à 200 cm. Une saisie est validée au flou ou avec Entrée ; les entrées invalides sont restaurées et les bornes respectées.
- Expériences à 0, λ/4, λ/2, 3λ/4, λ, 3λ/2, 2λ et 3λ. Les positions hors de la course sont désactivées avec leur distance et une explication. Elles sont recalculées quand f ou c change, **sans déplacer M2** tant qu’un bouton n’est pas activé.
- Vues **Microphones**, **Cercles** et **Vue synchronisée** ; acquisition stabilisée ou libre, base de temps en ms/div, sensibilité commune en V/div et visibilité de chaque voie.
- Lecture, pause, réinitialisation et pas de **T/24** (en pause). La fenêtre et les curseurs sont indépendants des paramètres physiques. Les deux curseurs gris mesurent un intervalle libre ; le curseur d’instant commun met à jour toutes les représentations.
- **Phase libre** règle directement le retard de phase δ entre 0 et 2 160°. Il s’agit de deux tensions idéales d’amplitudes égales, pas d’une distance acoustique inférée. La position du montage est conservée et les commandes de déplacement sont désactivées.
- Thèmes clair/sombre, mode présentation et panneaux responsive. Dans l’eau, la vue Microphones devient Hydrophones. Les réglages passent après les graphiques sur téléphone, conformément au kit de diffraction ; le réglage de M2 reste aussi accessible directement sous le montage.
- Les microphones et l’oscilloscope représentent des **tensions de sortie en volts**, proportionnelles à la pression acoustique avec une sensibilité identique. Aucun déplacement mécanique en centimètres n’est utilisé comme amplitude du signal.

## Choisir l’air ou l’eau

Le sélecteur **Milieu de propagation** et les boutons **Air / Eau douce** du montage sont synchronisés. Changer de milieu conserve la fréquence, l’amplitude de référence et la position physique de M2 ; il remet le temps à zéro, rétablit les paramètres proposés ci-dessous et active l’atténuation. Les réglages de célérité et d’absorption restent personnalisables.

| Milieu | Célérité de référence approchée | Absorption proposée, **illustrative** |
| --- | --- | --- |
| Air | 340 m/s | α = 0,20 m⁻¹ |
| Eau douce | 1 480 m/s | α = 0,05 m⁻¹ |

Les célérités sont des valeurs usuelles approchées vers la température ambiante. Les coefficients α proposés servent à rendre visible une expérience pédagogique : **ce ne sont pas des mesures ni des constantes physiques des matériaux**. Ils ne permettent pas de conclure à l’absorption réelle de l’air ou de l’eau, qui dépend notamment de la fréquence, de la température et de la composition du milieu.

À 1 000 Hz, λ passe de 34 cm dans l’air à 148 cm dans l’eau douce. Pour la même distance, le retard et le déphasage diminuent dans l’eau. Pour Δx = 148 cm dans l’eau, Δt = 1 ms = T et les signaux sont en phase. Les expériences hors des 200 cm de course sont désactivées : 2λ et 3λ ne sont donc pas accessibles dans l’eau à cette fréquence.

Le montage aquatique montre un **émetteur acoustique immergé** et deux **hydrophones** ; le GBF reste à l’extérieur de l’eau. Le modèle suppose que l’émetteur et les capteurs sont adaptés au milieu et que A₁ est étalonnée à M1. L’expérience se déroule entièrement dans le milieu choisi : aucune traversée d’interface air–eau, transmission ou réflexion à cette interface n’est simulée.

L’**amortissement spatial** est visible sur l’enveloppe d’amplitude en fonction de la distance et sur la tension CH2. La divergence géométrique (répartition de l’énergie) et l’absorption (dissipation dans le milieu) sont aussi affichées séparément ; leurs facteurs d’amplitude se multiplient. Avec le GBF continu, il n’y a pas d’extinction temporelle à position fixe : l’énergie est fournie en permanence. Le mode idéal reste disponible en désactivant l’atténuation.

## Convention scientifique

Les unités internes sont le mètre, la seconde, le hertz, le radian et le volt :

```text
T = 1/f
λ = c/f
Δt = Δx/c
δ = 2πΔx/λ = 2πfΔt ≥ 0
Δφ = φ₂ − φ₁ = −δ

y₁(t) = A₁ sin(2πft + φ₀)
y₂(t) = A₂ sin(2πft + φ₀ − δ)
```

L’origine de phase est définie à M1 (φ₀ = 0 dans cette interface) ; le trajet entre le haut-parleur et M1 est déjà compris dans cette origine. Pour Δx > 0, M2 est en retard sur M1. Le retard total est conservé, même après plusieurs tours. δ équivalent est affiché dans `[0, 2π[` et Δφ réduit dans `[−π, π[`. À π, le représentant signé vaut donc −π.

**À Δx = λ : Δt = T et signaux en phase. À Δx = 3λ : Δt = 3T, toujours en phase.** Deux sinusoïdes seules ne permettent pas de déterminer le nombre entier de périodes de retard ; le total affiché est calculé à partir de la distance. Les flèches de l’oscilloscope relient des maxima correspondants **du modèle**, et non deux maxima arbitraires.

Les cercles sont normalisés, de même rayon : leur projection verticale est `sin θᵢ`. La tension vaut `Aᵢ × sin θᵢ` ; la différence d’amplitude reste visible sur l’oscilloscope. Les points tournants sont une représentation mathématique des phases et ne représentent pas le mouvement réel de l’air ou des microphones.

## Atténuation

Deux modèles :

```text
Idéal : A₂ = A₁
Divergence sphérique avec absorption :
A₂/A₁ = x₀ / (x₀ + Δx) × exp(−αΔx)
```

x₀ et Δx sont en mètres ; α ≥ 0 est en m⁻¹. L’interface propose α de 0 à 3 m⁻¹. Les coefficients proposés pour les deux milieux sont illustratifs, non mesurés. La valeur A₁ est l’amplitude de référence **au niveau de M1**. La divergence et l’absorption modélisent le trajet supplémentaire vers M2. Une amplitude restante de 30 % correspond à une perte d’amplitude de 70 %, pas à une intensité de 30 %.

À position fixe, l’amplitude reste constante dans le temps avec le GBF continu. Cette approximation pédagogique en champ libre ne modélise ni la directivité réelle du haut-parleur, ni son champ proche, ni des réflexions. Le son est sinusoïdal et établi, le milieu homogène et non dispersif ; pas de front de démarrage.

## Horloge, déclenchement et rendu

Une seule boucle `requestAnimationFrame` pilote le temps physique. Le ralentissement fixe est de **1 000** : à vitesse 1×, 1 seconde réelle représente 1 milliseconde physique. Les vitesses 0,25×, 0,5×, 1× et 2× modifient uniquement ce débit ; f, T et λ restent inchangés. La limite d’avancement par image évite un grand saut après un blocage du navigateur. Les paramètres réinitialisent t à zéro ; la position Δx reste fixe lorsque f ou c change.

L’acquisition stabilisée démarre au dernier zéro montant de CH1 ; les courbes sont fixes en phase, le curseur montre l’instant commun par rapport au déclenchement. Une base très courte peut ne pas contenir l’instant ou les deux maxima : un message et un ajustement de base de temps sont proposés. Les deux voies utilisent la même échelle V/div, sans normalisation individuelle ; une saturation d’affichage est signalée.

Tracés SVG adaptatifs (au moins 48 points par période, minimum 400 points), nets à haute résolution. Une fenêtre dense est signalée pour permettre de distinguer les oscillations. Les élongations du dessin des microphones sont des tensions annotées, pas un déplacement des microphones. Le rendu responsive est adapté au mobile et ne capture pas la molette.

La préférence « réduire les animations » démarre en pause. L’onglet du navigateur masqué suspend l’horloge. `active={false}` annule la boucle et déconnecte les ressources ; le démontage annule la boucle et retire les écouteurs et observateurs. Le temps caché n’est pas ajouté à la reprise. Aucun moteur ne démarre au simple import du module.

## Réutiliser dans un futur site

```tsx
import { DephasageLaboratory } from './laboratories/dephasage/DephasageLaboratory';

<DephasageLaboratory active={true} theme="dark" />
```

Le composant est aussi exporté par défaut et ne contient ni routeur, ni navigation générale. Le site hôte possède le bandeau, le thème, l’ouverture et la fermeture (`src/App.tsx`). Pour conserver un onglet monté mais caché, passer `active={false}` ; masquer le CSS ne remplace pas ce contrat. Les thèmes s’appliquent localement à chaque racine `.lab-kit`, pas à `html`.

- `src/physics/model.ts` : équations pures, validation et échantillonnage.
- `src/laboratories/dephasage/` : expérience, horloge, dessins, oscilloscope et styles préfixés `.dephasage-lab`.
- `src/shared/lab-ui/` : **véritables sources et CSS du kit de diffraction**, importés par l’interface et conservés sans modification.
- `src/host.css` : reset du seul site autonome ; ne pas l’importer dans le laboratoire intégré.
- `docs/design-kit/` : copie du kit et de sa documentation, références et exemple d’intégration.

Kit récupéré de `adammouatacime1/diffraction-lab-3d`, branche `livraison-diffraction-lab-3d`, révision **`b11607e208d996535705630ee71d9bcd30e64857`**. Voir [la provenance](docs/design-kit/REVISION.md), [DESIGN-SYSTEM.md](docs/design-kit/DESIGN-SYSTEM.md) et [INTEGRATION.md](docs/design-kit/INTEGRATION.md). Le reset et la scène de démonstration du kit ne sont pas copiés dans le composant du laboratoire.

## Vérification

```sh
npm test
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
```

Si Chromium est déjà présent :

```sh
CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e
TEST_PRODUCTION=1 CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e
```

Les tests de production servent `dist/` sous `/dephasage-lab/`, pour vérifier les chemins en sous-dossier. Le script `scripts/visual-check.mjs` capture les thèmes et écrans ordinateur/téléphone lorsque `npm run dev -- --port 5173` tourne. Les captures sont dans `artifacts/visual-review/`, ignoré par Git.

Tests physiques : passage air/eau, conservation de la position, cas initial λ = 148 cm dans l’eau à 1 000 Hz, atténuation dans les deux milieux, cas initiaux, zéro, quarts de tour, opposition, λ et 3λ, fréquence doublée, retard total, atténuation spatiale, phase libre et égalité des projections. Tests navigateur : interactions, claviers, saisies, synchronisation, thèmes, mobile, et arrêt de la boucle à la désactivation/fermeture. Les vérifications numériques ne constituent pas une validation scientifique externe.

## GitHub Pages

`vite.config.ts` utilise **`base: './'`**, sans nom de dépôt inscrit dans les composants. Les ressources sont relatives et le laboratoire peut être publié à la racine ou dans un sous-dossier.

1. Dans **Settings → Pages**, choisir **Build and deployment → Source → GitHub Actions**.
2. Pousser sur `main`. Le workflow `.github/workflows/pages.yml` effectue les tests physiques, le build et les tests navigateur avant de publier `dist/`.
3. Attendre le job **GitHub Pages** vert ; si besoin, utiliser **Actions → Vérifier et publier Phase Lab → Run workflow**.
4. Vérifier le lien annoncé par le déploiement. Si GitHub demande une approbation de l’environnement, celle-ci doit être donnée dans GitHub.

Adresse du dépôt : https://github.com/adammouatacime1/dephasage-lab
Adresse Pages attendue après un déploiement réussi : https://adammouatacime1.github.io/dephasage-lab/

Une configuration de workflow ne prouve pas une publication : il faut vérifier son succès et la réponse du site. Une future intégration multi-laboratoires reste à faire dans le site hôte.
