"""Fetch the site's images from lendmaxcapital.ca and write size-optimised copies.

    python3 images.py <manifest.json> <release-dir>

For each photo: AVIF, WebP and progressive JPEG at every width in the
manifest (never upscaled). For each logo: WebP and PNG at the display height
and at 2x. Output goes to <release-dir>/assets/img/<id>-<size>.<ext>, the
names the page templates reference. Sources are cached in
/var/cache/lmcmic-img so a deploy still succeeds if lendmaxcapital.ca is
briefly unreachable. Runs on the server (needs Pillow with WebP/AVIF).
"""
import hashlib
import io
import json
import pathlib
import sys
import urllib.request

from PIL import Image

CACHE = pathlib.Path("/var/cache/lmcmic-img")


def fetch(url):
    CACHE.mkdir(parents=True, exist_ok=True)
    cached = CACHE / hashlib.sha1(url.encode()).hexdigest()
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "lmcmic-image-build/1.0"})
        with urllib.request.urlopen(req, timeout=20) as r:
            data = r.read()
        cached.write_bytes(data)
    except Exception as e:  # noqa: BLE001
        if not cached.exists():
            raise SystemExit(f"cannot fetch {url} and no cached copy: {e}")
        print(f"  using cached copy of {url} ({e})")
        data = cached.read_bytes()
    return Image.open(io.BytesIO(data))


def save(im, path, fmt, **kw):
    im.save(path, fmt, **kw)
    return path.stat().st_size


def main(manifest_path, release):
    m = json.loads(pathlib.Path(manifest_path).read_text())
    out = pathlib.Path(release) / "assets/img"
    out.mkdir(parents=True, exist_ok=True)
    total = 0
    for name, spec in m["photos"].items():
        src = fetch(spec["src"]).convert("RGB")
        for w in spec["widths"]:
            w = min(w, src.width)
            im = src.resize((w, round(src.height * w / src.width)), Image.LANCZOS) if w < src.width else src
            total += save(im, out / f"{name}-{w}.avif", "AVIF", quality=55)
            total += save(im, out / f"{name}-{w}.webp", "WEBP", quality=78, method=6)
            total += save(im, out / f"{name}-{w}.jpg", "JPEG", quality=80, optimize=True, progressive=True)
        print(f"  {name}: {spec['widths']}")
    h = m["logo_height"]
    for name, spec in m["logos"].items():
        src = fetch(spec["src"]).convert("RGBA")
        for scale in (1, 2):
            hh = h * scale
            im = src.resize((round(src.width * hh / src.height), hh), Image.LANCZOS)
            total += save(im, out / f"{name}-{hh}.webp", "WEBP", quality=90, method=6)
            total += save(im, out / f"{name}-{hh}.png", "PNG", optimize=True)
        print(f"  {name}: {h}px, {h * 2}px")
    print(f"images written to {out} ({total / 1024:.0f} KB total)")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
