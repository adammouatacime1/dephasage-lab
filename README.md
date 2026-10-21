# Phase Lab — Explorer le déphasage

Site pédagogique interactif en français, réalisé par Adam pour la 2ᵉ année du baccalauréat Sciences Mathématiques. Application statique TypeScript / Vite / SVG, sans serveur, police distante, compte utilisateur ni clé API.

## Développer

Node.js 24 et npm sont recommandés (`.nvmrc`). Dans le dépôt :

```sh
npm ci
npm run dev
```

Vite affiche l’adresse locale avec le chemin `/dephasage-lab/`. L’environnement cloud utilise le checkout existant, sans worktree supplémentaire.

```sh
npm test             # 12 tests du modèle physique
npm run build        # vérification TypeScript et production dans dist/
npm run preview      # servir le build pour une vérification locale
```

Les dépendances sont verrouillées par `package-lock.json`. Aucun fichier `.env` nécessaire.

## Tests navigateur

```sh
npx playwright install --with-deps chromium
npm run test:e2e
```

Si Chromium est déjà installé, éviter son téléchargement :

```sh
CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e
```

Les tests couvrent les expériences, les projections, les changements de paramètres, les curseurs, les glissements de B, lecture/pause/pas à pas, le clavier, le mode présentation et l’absence de débordement à 320, 390, 768 et 1440 pixels. Le navigateur démarre le serveur de test automatiquement. Les captures de contrôle locales peuvent être produites avec `node tests/visual-check.mjs` (serveur de développement sur le port 5173, Chromium installé). Elles sont enregistrées dans `artifacts/visual-review/` (ignoré par Git) et ne sont pas des références externes de validation.

## GitHub Pages

La configuration Vite utilise `base: '/dephasage-lab/'`, y compris pour l’icône et les assets. Dans le dépôt GitHub :

1. Ouvrir **Settings → Pages**.
2. Sous **Build and deployment → Source**, sélectionner **GitHub Actions**.
3. Le workflow `.github/workflows/pages.yml` vérifie le modèle, TypeScript et les interactions navigateur, puis publie `dist/` lors d’un push sur `main`. Les pull requests sont testées sans publication.
4. Si nécessaire, ouvrir **Actions → Vérification et publication de Phase Lab → Run workflow**, choisir `main`, puis lancer.
5. Attendre le succès du job **GitHub Pages**, ouvrir le lien du déploiement et vérifier les expériences. Si une protection de l’environnement `github-pages` exige une approbation, un administrateur doit l’accorder dans GitHub.

Adresse attendue après un déploiement réussi : `https://adammouatacime1.github.io/dephasage-lab/`. Cette adresse n’est pas une preuve que le site a été publié. Le statut réel du déploiement doit être contrôlé dans Actions et sur le site.

## Utilisation

- **Déphasage réglable** : Δφ entre −720° et +720°, fréquence et amplitude communes aux deux voies. λ est celle de l’onde progressive associée ; aucune distance AB n’est imposée.
- **Deux points d’une même onde** : A à x = 0, B à x = d ≥ 0. Le déphasage est calculé. Changer f ou v conserve d en mètres. Le curseur exprime d en multiples de λ et s’étend si nécessaire ; la saisie accepte de 0 à 1000 m.
- Quatre onglets, avec une vue synchronisée regroupant les deux cercles, l’oscilloscope et le profil spatial lorsqu’il est défini.
- Lecture/pause, remise à zéro, pas de T/24 et vitesse d’animation indépendante des paramètres physiques. Une seule horloge, animée avec `requestAnimationFrame`.
- Les modifications par les paramètres et les expériences remettent le temps à zéro. Les glissements graphiques conservent l’instant observé. En pause, glisser B sur son cercle modifie le déphasage sur le tour le plus proche ; près des quarts de tour, le point s’aimante sur l’angle exact.
- Glisser B sur le profil modifie d (avec aimantation près des multiples de λ/4). Les points matériels restent fixes en x.
- En pause, glisser le triangle turquoise sous l’oscilloscope change l’instant commun. Un curseur natif équivalent fonctionne au clavier. Les deux curseurs gris et leurs saisies en pourcentage mesurent un intervalle quelconque, distinct du retard calculé.
- Réglages de base de temps, nombre de périodes, échelle verticale, visibilité des voies. La durée affichée est `nombre de périodes × base de temps × T`.
- Présentation : graphiques plus grands, textes agrandis, commandes secondaires masquées, expériences accessibles ; plein écran lorsque le navigateur l’autorise. Échap pour quitter.
- Sur mobile, panneau de paramètres repliable ; au clavier, flèches pour les onglets et contrôles natifs. Une préférence de mouvement réduit démarre l’animation en pause.

## Modèle physique et convention

Dans `src/model.ts`, un modèle partagé calcule toutes les grandeurs :

```text
sA(t) = A cos(ωt)
sB(t) = A cos(ωt + Δφ)
Δφ = φB − φA
ω = 2πf ; T = 1/f ; λ = v/f
τ = −Δφ/ω ; sB(t) = sA(t − τ)
```

Une phase réduite entre 0 et π correspond à une avance de B ; entre −π et 0, à un retard de B. À 0 modulo 2π, les signaux sont en phase ; à π modulo 2π, ils sont opposés. La valeur réduite affichée est dans `[−π, π[`, donc +π est affiché comme −π réduit. Le retard total est toujours calculé à partir de la phase totale.

Le retard signé τ positif signifie un retard de B ; τ négatif signifie une avance. Les angles totaux et réduits sont affichés séparément. Les arcs de comparaison utilisent une origine commune ; les projections des cercles sont horizontales, car les signaux utilisent le cosinus.

Pour l’onde progressive vers les x croissants :

```text
y(x,t) = A cos(ωt − kx)
k = 2π/λ
xA = 0 ; xB = d
Δφ = −kd = −2πd/λ
τ = d/v
```

L’amplitude et les élongations sont affichées en centimètres ; positions, longueur d’onde et distances en mètres ; temps en secondes. Les calculs comparent toujours des élongations dans la même unité. La célérité est en m/s et la fréquence en Hz. La vitesse de lecture ne change que l’écoulement du temps simulé.

## Limites et interprétation

Onde sinusoïdale établie, de fréquence et amplitude communes, sans front de démarrage, amortissement ni dispersion. Les paramètres restent constants entre deux réglages. Une pause d’onglet ne fait pas avancer l’expérience en arrière-plan ; un ralentissement du navigateur limite l’avancement par image pour éviter un saut brutal.

Un retard non nul peut donner des oscillations en phase : pour d = λ, τ = T et Δφ = −2π. Deux sinusoïdes seules ne révèlent pas le nombre entier de périodes de retard. Le décalage graphique entre maxima correspond au retard **réduit modulo T** ; le retard total figure séparément dans les cartes. La mesure par les curseurs est un intervalle choisi librement, pas une détermination automatique du retard total.

Avec une fenêtre trop courte, la flèche de période ou de décalage n’est dessinée que si ses deux extrémités sont visibles. Les valeurs calculées restent affichées. Pour une distance dépassant environ 33 longueurs d’onde, le profil global devient trop dense : la courbe est masquée avec une explication plutôt que de dessiner une oscillation sous-échantillonnée. Les marqueurs et les valeurs physiques restent exacts.

Les scénarios remarquables sont vérifiés par tests numériques ; ils ne constituent pas une certification scientifique externe. L’inspection visuelle a été faite dans Chromium ; les autres moteurs et un véritable projecteur de classe restent à vérifier.
