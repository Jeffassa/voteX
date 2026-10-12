# Logo SmartVote

Le « V » ardoise aux faces cuivrées, redessiné en vectoriel d'après la maquette
du logo : droites et courbes de Bézier, sans tracé automatique.

| Fichier | Usage |
| --- | --- |
| `logo.svg` | Fonds clairs. Passe en version claire si le système est en thème sombre. |
| `logo-inverse.svg` | Fonds marine ou sombres. |
| `logo-mono.svg` | Une couleur (tampon, gravure, impression au trait). |

Couleurs : ardoise `#42464A`, cuivre `#C9967A` ; en version claire, papier
`#F3EEE3` et cuivre `#D9A283`. Dans l'application, ce sont les variables
`--logo-slate` et `--logo-copper` (`frontend/src/index.css`).

Le composant React (`frontend/src/components/Brand.tsx`) lit sa géométrie dans
`logoGeometry.ts`. Les icônes et l'image de partage se régénèrent depuis
`frontend/public/favicon.svg` :

```bash
cd frontend && node scripts/generate-assets.mjs && python scripts/compress-images.py
```

## Système d'interface « Ardoise »

Tout part du logo, pour que l'interface ne ressemble à aucun gabarit :

- **Couleurs** : ardoise (`--ink-950`, panneaux `--panel`) et un seul accent,
  le cuivre (`--copper-500` en aplat, `--copper-700` pour du texte). Pas de
  dégradé ni de verre dépoli. Les candidats ont des teintes sourdes
  (`lib/palette.ts`), pas les couleurs vives par défaut de Tailwind.
- **Typographie** : Mona Sans seule, à largeur variable. Le texte courant est
  en largeur normale, les titres élargis (`--display-stretch`, 116 à 118 %) et
  serrés. Geist Mono sert aux empreintes, matricules et numéros.
- **Motifs** : l'angle des bras du V (pente de 0,53) donne les chevrons
  emboîtés des panneaux sombres (`BrandEcho`) et le petit ruban incliné des
  surtitres (`.sv-kicker`), des repères de navigation et des numéros d'étape.
- **Thème sombre** : il suit le réglage du système, sans rien mémoriser sur
  le poste ; l'attribut `data-theme` sur `<html>` permet de forcer un thème.

L'image fixe de l'urne 3D (`src/assets/hero-urne-*.webp`) est la première image
de la scène : à refaire si la scène, la caméra ou ses couleurs changent.
