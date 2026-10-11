"""Compresse les images de public/ et produit favicon.ico.

    python scripts/compress-images.py

- PNG : quantifiés en palette 256 couleurs (sans perte visible sur des aplats
  et des dégradés doux), puis optimisés. Divise le poids par 3 à 5.
- Image de partage : convertie en JPEG progressif. Ses dégradés supportent
  mal la réduction de palette (aplats gris visibles), le JPEG les garde.
- favicon.ico multi-tailles (16, 32, 48) pour les navigateurs qui ignorent le SVG,
  depuis favicon-source.png (écrit par generate-assets.mjs, supprimé ensuite).

Requiert Pillow (pip install pillow). Ne réécrit un fichier que s'il y gagne.
"""

from pathlib import Path

from PIL import Image

PUBLIC = Path(__file__).resolve().parent.parent / "public"


def compress_png(path: Path) -> None:
    before = path.stat().st_size
    img = Image.open(path).convert("RGBA")  # noqa: palette → RGBA avant quantification
    quantized = img.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    tmp = path.with_suffix(".tmp.png")
    quantized.save(tmp, optimize=True)
    after = tmp.stat().st_size
    if after < before:
        tmp.replace(path)
    else:
        tmp.unlink()
        after = before
    print(f"{path.relative_to(PUBLIC)} : {before / 1024:.1f} Ko -> {after / 1024:.1f} Ko")


def main() -> None:
    og = PUBLIC / "og-image.png"
    if og.exists():
        jpg = PUBLIC / "og-image.jpg"
        before = og.stat().st_size
        Image.open(og).convert("RGB").save(jpg, quality=82, optimize=True, progressive=True)
        og.unlink()
        print(f"og-image.png {before / 1024:.1f} Ko -> og-image.jpg {jpg.stat().st_size / 1024:.1f} Ko")

    # Le favicon.ico part du logo seul, sur fond transparent (pas de la tuile
    # des icônes d'application), avant toute réduction de palette.
    source = PUBLIC / "favicon-source.png"
    if source.exists():
        Image.open(source).convert("RGBA").save(
            PUBLIC / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)]
        )
        source.unlink()
        print(f"favicon.ico : {(PUBLIC / 'favicon.ico').stat().st_size / 1024:.1f} Ko")

    for png in sorted(PUBLIC.rglob("*.png")):
        compress_png(png)


if __name__ == "__main__":
    main()
