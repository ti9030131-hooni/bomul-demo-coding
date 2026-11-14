"""
보물 여행 — 실사풍 3D 보물 상자(GLB) 생성
    python tools/ar-models/chest.py
- 노드 'body'(몸통) 와 'lid'(뚜껑, 경첩 위치에 원점)로 나뉘어 있어 뚜껑을 실제로 열 수 있습니다.
- 나뭇결 텍스처를 GLB 안에 함께 넣습니다.
- 'coin_glow', 'seam_glow' 재질은 웹에서 빛의 세기를 조절합니다.
"""
import io, json, os, struct
import numpy as np
from PIL import Image, ImageFilter
from make_models import (mat, srgb, Part, merge, lathe, lathe_hard, sphere, flatten,
                         T_translate, T_rot, T_scale, chain, OUT)

rng = np.random.default_rng(7)
W, D, H = 1.0, 0.62, 0.50
R = D / 2

# ── 재질 ──
WOOD   = {"name": "wood", "doubleSided": True,
          "pbrMetallicRoughness": {"baseColorFactor": [1, 1, 1, 1], "baseColorTexture": {"index": 0},
                                   "metallicFactor": 0.0, "roughnessFactor": 0.62}}
WOOD_IN = mat("wood_inside", "#2A140B", 0.0, 0.85)
VELVET = mat("velvet", "#7A1420", 0.0, 0.95)
GOLD   = mat("gold", "#F1C15A", 1.0, 0.22)
GOLD_D = mat("gold_old", "#C8963F", 1.0, 0.38)
IRON   = mat("iron_dark", "#1A1512", 0.6, 0.5)
COIN   = mat("coin", "#FFD36B", 1.0, 0.18)
GLOW   = mat("coin_glow", "#F5B940", 1.0, 0.3, emissive="#FFB43A")
SEAM   = mat("seam_glow", "#FFE3A0", 0.0, 0.5, emissive="#FFD88A")
GEM_R  = mat("gem_ruby", "#D81E3C", 0.1, 0.06, emissive="#3A0410")
GEM_G  = mat("gem_emerald", "#18A866", 0.1, 0.06, emissive="#04301A")
GEM_B  = mat("gem_sapphire", "#2350E0", 0.1, 0.06, emissive="#061440")

# ── 나뭇결 텍스처 ──
def wood_texture(size=512, planks=4):
    v = np.linspace(0, 1, size, endpoint=False)[:, None]
    u = np.linspace(0, 1, size, endpoint=False)[None, :]
    plank = np.floor(v * planks).astype(int)
    off = (rng.random(planks + 1) * 10)[plank]
    def stretched(cols, blur):
        n = (rng.random((size, cols)) * 255).astype(np.uint8)
        im = Image.fromarray(n).resize((size, size), Image.BICUBIC).filter(ImageFilter.GaussianBlur(blur))
        return np.array(im) / 255.0
    streak = stretched(6, 1.0)
    streak2 = stretched(24, 0.6)
    grain = np.sin(2 * np.pi * (v * planks * 9 + 1.6 * streak + 0.35 * np.sin(2 * np.pi * u * 1.4 + off)))
    t = 0.62 + 0.12 * grain + 0.22 * (streak - .5) + 0.12 * (streak2 - .5)
    tone = (0.82 + 0.32 * rng.random(planks + 1))[plank]
    base = np.array([0.40, 0.20, 0.10])
    img = base[None, None, :] * (t * tone)[..., None] * 1.2
    fv = (v * planks) % 1
    gap = np.minimum(fv, 1 - fv) * size / planks
    img = img * np.clip(0.3 + gap / 4, 0.3, 1)[..., None]
    img = np.clip(img, 0, 1)
    im = Image.fromarray((img * 255).astype(np.uint8), "RGB")
    b = io.BytesIO(); im.save(b, "PNG", optimize=True); return b.getvalue()

# ── 도형 ──
class UVPart(Part):
    def __init__(self, pos, nrm, idx, material, uv=None):
        super().__init__(pos, nrm, idx, material); self.uv = None if uv is None else np.asarray(uv, np.float32)
    def transform(self, T):
        p = super().transform(T); return UVPart(p.pos, p.nrm, p.idx, p.mat, self.uv)

def box(w, h, d, material, at=(0, 0, 0), tile=0.5, uv=False):
    x, y, z = w / 2, h / 2, d / 2
    F = [((1, 0, 0), [(x, -y, -z), (x, y, -z), (x, y, z), (x, -y, z)], (2, 1)),
         ((-1, 0, 0), [(-x, -y, z), (-x, y, z), (-x, y, -z), (-x, -y, -z)], (2, 1)),
         ((0, 1, 0), [(-x, y, -z), (-x, y, z), (x, y, z), (x, y, -z)], (0, 2)),
         ((0, -1, 0), [(-x, -y, z), (-x, -y, -z), (x, -y, -z), (x, -y, z)], (0, 2)),
         ((0, 0, 1), [(x, -y, z), (x, y, z), (-x, y, z), (-x, -y, z)], (0, 1)),
         ((0, 0, -1), [(-x, -y, -z), (-x, y, -z), (x, y, -z), (x, -y, -z)], (0, 1))]
    pos, nrm, idx, uvs = [], [], [], []
    for k, (n, q, (a, b)) in enumerate(F):
        pos += q; nrm += [n] * 4; o = k * 4; idx += [o, o + 1, o + 2, o, o + 2, o + 3]
        uvs += [((p[a] + at[a]) / tile, (p[b] + at[b]) / tile) for p in q]
    return UVPart(np.asarray(pos) + at, nrm, idx, material, uvs if uv else None)

def half_cyl(r, x0, x1, material, seg=40, inward=False, uv=False, tile=0.5, cz=R):
    a = np.linspace(0, np.pi, seg + 1); xs = np.array([x0, x1])
    pos, nrm, uvs = [], [], []
    for xx in xs:
        for t in a:
            pos.append((xx, r * np.sin(t), cz - r * np.cos(t)))
            n = np.array([0, np.sin(t), -np.cos(t)]); nrm.append(-n if inward else n)
            uvs.append((xx / tile, t * r / tile))
    idx = []; Wn = seg + 1
    for j in range(seg):
        a0, a1, b0, b1 = j, j + 1, Wn + j, Wn + j + 1
        idx += [a0, b0, a1, a1, b0, b1]
    return UVPart(pos, nrm, idx, material, uvs if uv else None)

def half_disc(r, x, sign, material, seg=40, uv=False, tile=0.5, cz=R):
    a = np.linspace(0, np.pi, seg + 1)
    pos = [(x, 0, cz)] + [(x, r * np.sin(t), cz - r * np.cos(t)) for t in a]
    nrm = [(sign, 0, 0)] * len(pos)
    idx = []
    for j in range(seg): idx += [0, j + 1, j + 2]
    uvs = [(p[2] / tile, p[1] / tile) for p in pos]
    return UVPart(pos, nrm, idx, material, uvs if uv else None)

def coin(at, tilt):
    c = lathe_hard([[(0, -0.004), (0.034, -0.004)], [(0.034, -0.004), (0.034, 0.004)], [(0.034, 0.004), (0, 0.004)]], COIN, 18)
    return c.transform(chain(T_translate(*at), T_rot("y", tilt[2]), T_rot("x", tilt[0]), T_rot("z", tilt[1])))

def gem(r, at, m):
    g = sphere(r, m, 8, 4)
    return flatten(g).transform(chain(T_translate(*at), T_rot("y", rng.random() * 90), T_scale(1, 1.25, 1)))

# ── 몸통 ──
def body_parts():
    t = 0.045
    P = []
    P += [box(W, H, t, WOOD, (0, H / 2, D / 2 - t / 2), uv=True), box(W, H, t, WOOD, (0, H / 2, -D / 2 + t / 2), uv=True),
          box(t, H, D, WOOD, (W / 2 - t / 2, H / 2, 0), uv=True), box(t, H, D, WOOD, (-W / 2 + t / 2, H / 2, 0), uv=True),
          box(W, t, D, WOOD, (0, t / 2, 0), uv=True)]
    P += [box(W - 2 * t, 0.01, D - 2 * t, WOOD_IN, (0, 0.30, 0))]
    # 금속 띠·모서리
    for bx in (-0.29, 0.29):
        for sz in (-1, 1):
            P.append(box(0.075, H + 0.004, 0.012, GOLD_D, (bx, H / 2, sz * (D / 2 + 0.004))))
        P.append(box(0.075, 0.012, D + 0.02, GOLD_D, (bx, -0.004, 0)))
    for sx in (-1, 1):
        for sz in (-1, 1):
            P.append(box(0.07, H + 0.006, 0.07, GOLD, (sx * (W / 2 - 0.03), H / 2, sz * (D / 2 - 0.03))))
    P += [box(W + 0.02, 0.05, D + 0.02, GOLD_D, (0, 0.025, 0)),
          box(W + 0.016, 0.03, 0.03, GOLD, (0, H - 0.015, D / 2 + 0.002)), box(W + 0.016, 0.03, 0.03, GOLD, (0, H - 0.015, -D / 2 - 0.002)),
          box(0.03, 0.03, D + 0.016, GOLD, (W / 2 + 0.002, H - 0.015, 0)), box(0.03, 0.03, D + 0.016, GOLD, (-W / 2 - 0.002, H - 0.015, 0))]
    # 징(리벳)
    for bx in (-0.29, 0.29):
        for yy in np.linspace(0.1, 0.42, 4):
            P.append(sphere(0.013, GOLD, 12, 8).transform(T_translate(bx, yy, D / 2 + 0.008)))
    # 자물쇠 판
    P += [box(0.17, 0.2, 0.022, GOLD, (0, 0.33, D / 2 + 0.012)),
          box(0.13, 0.16, 0.026, GOLD_D, (0, 0.33, D / 2 + 0.013)),
          sphere(0.017, IRON, 14, 8).transform(chain(T_translate(0, 0.35, D / 2 + 0.026), T_scale(1, 1, 0.3))),
          box(0.014, 0.04, 0.01, IRON, (0, 0.315, D / 2 + 0.027))]
    # 다리
    for sx in (-1, 1):
        for sz in (-1, 1):
            P.append(sphere(0.04, GOLD_D, 16, 10).transform(chain(T_translate(sx * (W / 2 - 0.05), 0.0, sz * (D / 2 - 0.05)), T_scale(1, 0.7, 1))))
    # 안쪽의 금화 더미
    a = np.linspace(0, np.pi / 2, 14)
    mound = lathe([(np.cos(t), np.sin(t)) for t in a[::-1]][::-1], GLOW, 40)
    P.append(mound.transform(chain(T_translate(0, 0.38, 0), T_scale(0.44, 0.15, 0.25))))
    for _ in range(90):
        while True:
            x, z = rng.uniform(-0.42, 0.42), rng.uniform(-0.24, 0.24)
            q = 1 - (x / 0.44) ** 2 - (z / 0.25) ** 2
            if q > 0.02: break
        y = 0.38 + 0.15 * np.sqrt(q) + 0.006
        P.append(coin((x, y, z), (rng.normal(0, 18) - 30 * x, rng.normal(0, 18) + 25 * z / 0.25, rng.random() * 360)))
    for m, (x, z) in zip([GEM_R, GEM_G, GEM_B, GEM_R, GEM_B], [(-0.2, 0.05), (0.12, -0.06), (0.25, 0.08), (0.02, 0.14), (-0.08, -0.12)]):
        q = max(0.05, 1 - (x / 0.44) ** 2 - (z / 0.25) ** 2)
        P.append(gem(0.035 + rng.random() * 0.012, (x, 0.38 + 0.15 * np.sqrt(q) + 0.03, z), m))
    return P

# ── 뚜껑(원점 = 뒤쪽 경첩) ──
def lid_parts():
    P = [half_cyl(R, -W / 2, W / 2, WOOD, 48, uv=True),
         half_cyl(R - 0.035, -W / 2 + 0.035, W / 2 - 0.035, VELVET, 48, inward=True),
         half_disc(R, W / 2, 1, WOOD, 48, uv=True), half_disc(R, -W / 2, -1, WOOD, 48, uv=True)]
    for bx in (-0.29, 0.29):
        P.append(half_cyl(R + 0.012, bx - 0.0375, bx + 0.0375, GOLD_D, 48))
    for ex in (-W / 2 + 0.03, W / 2 - 0.03):
        P.append(half_cyl(R + 0.014, ex - 0.035, ex + 0.035, GOLD, 48))
    P += [box(W + 0.016, 0.035, 0.03, GOLD, (0, 0.0175, D + 0.002)),
          box(W + 0.016, 0.035, 0.03, GOLD, (0, 0.0175, -0.002)),
          box(W - 0.06, 0.008, 0.006, SEAM, (0, 0.002, D + 0.018))]
    for bx in (-0.29, 0.29):
        for t in np.linspace(0.35, 2.8, 5):
            P.append(sphere(0.013, GOLD, 12, 8).transform(T_translate(bx, (R + 0.016) * np.sin(t), R - (R + 0.016) * np.cos(t))))
    # 걸쇠
    P += [box(0.1, 0.12, 0.02, GOLD, (0, -0.02, D + 0.03)), box(0.06, 0.05, 0.024, GOLD_D, (0, -0.055, D + 0.031))]
    # 뚜껑 꼭대기 장식 원판
    P.append(lathe_hard([[(0, 0), (0.08, 0)], [(0.08, 0), (0.07, 0.015)], [(0.07, 0.015), (0, 0.02)]], GOLD, 32)
             .transform(chain(T_translate(0, R + 0.012, R), T_rot("x", 0))))
    return P

# ── GLB 쓰기(노드 2개 + 텍스처) ──
def write(path, nodes, texture_png):
    blob = bytearray(); views, accs, mats, meshes = [], [], [], []
    mat_index = {}
    def add(arr, target, comp, typ, minmax=False):
        while len(blob) % 4: blob.append(0)
        off = len(blob); blob.extend(arr.tobytes())
        v = {"buffer": 0, "byteOffset": off, "byteLength": arr.nbytes}
        if target: v["target"] = target
        views.append(v)
        a = {"bufferView": len(views) - 1, "componentType": comp, "count": int(len(arr)), "type": typ}
        if minmax: a["min"] = arr.min(0).tolist(); a["max"] = arr.max(0).tolist()
        accs.append(a); return len(accs) - 1
    for name, parts, tr in nodes:
        groups = {}
        for p in parts: groups.setdefault(p.mat["name"], (p.mat, []))[1].append(p)
        prims = []
        for mname, (m, ps) in groups.items():
            if mname not in mat_index: mat_index[mname] = len(mats); mats.append(m)
            pos = np.concatenate([p.pos for p in ps]); nrm = np.concatenate([p.nrm for p in ps])
            idx, off = [], 0
            for p in ps: idx.append(p.idx + off); off += len(p.pos)
            idx = np.concatenate(idx); idx = idx.astype(np.uint16 if len(pos) < 65535 else np.uint32)
            attrs = {"POSITION": add(pos.astype(np.float32), 34962, 5126, "VEC3", True),
                     "NORMAL": add(nrm.astype(np.float32), 34962, 5126, "VEC3")}
            if all(getattr(p, "uv", None) is not None for p in ps):
                attrs["TEXCOORD_0"] = add(np.concatenate([p.uv for p in ps]).astype(np.float32), 34962, 5126, "VEC2")
            prims.append({"attributes": attrs, "indices": add(idx, 34963, 5123 if idx.dtype == np.uint16 else 5125, "SCALAR"),
                          "material": mat_index[mname], "mode": 4})
        meshes.append({"name": name, "primitives": prims})
    while len(blob) % 4: blob.append(0)
    img_off = len(blob); blob.extend(texture_png)
    views.append({"buffer": 0, "byteOffset": img_off, "byteLength": len(texture_png)})
    while len(blob) % 4: blob.append(0)
    gltf = {"asset": {"version": "2.0", "generator": "bomul-ar chest.py"},
            "scene": 0, "scenes": [{"nodes": [0]}],
            "nodes": [{"name": "chest", "children": list(range(1, len(nodes) + 1))}] +
                     [{"name": n, "mesh": i, "translation": list(tr)} for i, (n, _, tr) in enumerate(nodes)],
            "meshes": meshes, "materials": mats, "accessors": accs, "bufferViews": views,
            "images": [{"bufferView": len(views) - 1, "mimeType": "image/png"}],
            "samplers": [{"magFilter": 9729, "minFilter": 9987, "wrapS": 10497, "wrapT": 10497}],
            "textures": [{"sampler": 0, "source": 0}],
            "buffers": [{"byteLength": len(blob)}]}
    js = json.dumps(gltf, ensure_ascii=False, separators=(",", ":")).encode(); js += b" " * ((4 - len(js) % 4) % 4)
    with open(path, "wb") as f:
        f.write(struct.pack("<4sII", b"glTF", 2, 12 + 8 + len(js) + 8 + len(blob)))
        f.write(struct.pack("<II", len(js), 0x4E4F534A)); f.write(js)
        f.write(struct.pack("<II", len(blob), 0x004E4942)); f.write(bytes(blob))
    return os.path.getsize(path)

if __name__ == "__main__":
    tex = wood_texture()
    size = write(os.path.join(OUT, "treasure-chest.glb"),
                 [("body", body_parts(), (0, 0, 0)), ("lid", lid_parts(), (0, H, -D / 2))], tex)
    print(f"treasure-chest.glb {size/1024:.0f} KB")
    Image.open(io.BytesIO(tex)).save("/tmp/wood.png")
