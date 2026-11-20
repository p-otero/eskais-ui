# Usage: python tooling/demo-photo-mask.py test/fixtures/model/character/photo-body.png test/fixtures/model/character/photo-body-mask.png
# Makes the demo photo's person mask: the synthetic render's background is a vertical gradient, so a pixel is the
# person when it is far from its row's background colour. Cleaned with a close/open, then scaled to 256 px tall with
# soft edges, as an engine's 0-255 confidence would be.
import sys
from PIL import Image, ImageFilter
import numpy as np
src, out = sys.argv[1], sys.argv[2]
im = np.asarray(Image.open(src).convert("RGB")).astype(np.float32)
h, w, _ = im.shape
edge = np.concatenate([im[:, :6], im[:, -6:]], axis=1)  # left and right borders per row
rows = np.median(edge, axis=1)
# The hands reach the borders on a few rows; the gradient is smooth, so a wide running median drops them.
pad = 40
padded = np.pad(rows, ((pad, pad), (0, 0)), mode="edge")
bg = np.stack([np.median(padded[y : y + 2 * pad + 1], axis=0) for y in range(h)])[:, None, :]
d = np.sqrt(((im - bg) ** 2).sum(axis=2))
m = Image.fromarray(((d > 26) * 255).astype(np.uint8))
m = m.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5))  # close small holes
m = m.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))  # drop specks
th = 256; tw = round(w * th / h)
m = m.resize((tw, th), Image.LANCZOS).filter(ImageFilter.GaussianBlur(0.6))
m.save(out, optimize=True)
print(out, m.size, "alpha range", np.asarray(Image.open(src))[..., 3].min())
