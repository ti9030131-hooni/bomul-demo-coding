"""SVG 지도(out/*.svg) → client/public/img/route-<코스>.jpg (Chromium, 2400×1680)
   python3 tools/route-maps/render.py [코스id ...]"""
import sys, pathlib, io
from playwright.sync_api import sync_playwright
from PIL import Image
HERE = pathlib.Path(__file__).resolve().parent
IMG = HERE.parents[1] / "client/public/img"
only = sys.argv[1:]
files = sorted(p for p in (HERE / "out").glob("route-*.svg") if not only or p.stem[6:] in only)
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1600, "height": 1120}, device_scale_factor=1.5)
    for f in files:
        pg.set_content(f'<html><body style="margin:0;background:#000">{f.read_text(encoding="utf-8")}</body></html>')
        pg.wait_for_timeout(150)
        png = pg.screenshot(clip={"x": 0, "y": 0, "width": 1600, "height": 1120})
        Image.open(io.BytesIO(png)).convert("RGB").save(IMG / f"{f.stem}.jpg", quality=86, optimize=True, progressive=True)
        print(f.stem)
    b.close()
