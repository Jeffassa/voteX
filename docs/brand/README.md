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
