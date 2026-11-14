"""
보물 여행 AR — 임시 3D 보물 모델(GLB) 생성 스크립트

numpy만 있으면 실행됩니다.
    python tools/ar-models/make_models.py
결과물은 client/public/ar/models/*.glb 에 저장됩니다.

디자이너가 만든 정식 모델로 바꿀 때는 같은 파일 이름으로 덮어쓰거나,
client/public/ar/data/gyeongbok.js 의 model 경로만 바꾸면 됩니다.
"""
import json, os, struct
import numpy as np

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "client", "public", "ar", "models")

# ───────────────────────── 재질 ─────────────────────────
def srgb(h):
    h = h.lstrip("#")
    c = np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)])
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4).tolist()

def mat(name, color, metal=0.0, rough=0.6, emissive=None):
    m = {"name": name, "doubleSided": True,
         "pbrMetallicRoughness": {"baseColorFactor": srgb(color) + [1.0],
                                  "metallicFactor": metal, "roughnessFactor": rough}}
    if emissive:
        m["emissiveFactor"] = srgb(emissive)
    return m

GOLD   = mat("gold", "#E8B65A", 1.0, 0.28)
GOLD_D = mat("gold_dark", "#B98A3A", 1.0, 0.4)
BRONZE = mat("bronze", "#5E6B57", 0.85, 0.45)
WOOD   = mat("lacquer_wood", "#4A2418", 0.0, 0.45)
SILK   = mat("red_silk", "#9E2B22", 0.0, 0.7)
MIRROR = mat("water_mirror", "#1B2A38", 1.0, 0.06)
PEARL  = mat("pearl", "#FFF3D6", 0.2, 0.15, emissive="#3A2A10")
FLAME  = mat("flame", "#FF9A2E", 0.0, 0.5, emissive="#FF7A1A")
FLAME2 = mat("flame_core", "#FFE7A0", 0.0, 0.4, emissive="#FFD27A")
BRICK  = mat("brick", "#9B3D2C", 0.0, 0.85)
STONE  = mat("stone", "#CFC8BA", 0.0, 0.9)
TILE   = mat("roof_tile", "#3B3F45", 0.2, 0.6)
SMOKE  = mat("smoke", "#E9E6DF", 0.0, 1.0)
IRON   = mat("iron", "#2E2A27", 0.8, 0.5)
SEAL   = mat("seal_red", "#B3372A", 0.1, 0.35)

# ───────────────────────── 형상 도구 ─────────────────────────
class Part:
    def __init__(self, pos, nrm, idx, material):
        self.pos = np.asarray(pos, np.float32)
        self.nrm = np.asarray(nrm, np.float32)
        self.idx = np.asarray(idx, np.uint32)
        self.mat = material

    def transform(self, T):
        p = np.c_[self.pos, np.ones(len(self.pos))] @ T.T
        n = self.nrm @ T[:3, :3].T
        n /= np.linalg.norm(n, axis=1, keepdims=True) + 1e-9
        return Part(p[:, :3], n, self.idx, self.mat)

def T_translate(x, y, z):
    T = np.eye(4); T[:3, 3] = (x, y, z); return T

def T_scale(sx, sy=None, sz=None):
    sy = sx if sy is None else sy; sz = sx if sz is None else sz
    return np.diag([sx, sy, sz, 1.0])

def T_rot(axis, deg):
    a = np.radians(deg); c, s = np.cos(a), np.sin(a); T = np.eye(4)
    if axis == "x": T[1:3, 1:3] = [[c, -s], [s, c]]
    if axis == "y": T[0, 0], T[0, 2], T[2, 0], T[2, 2] = c, s, -s, c
    if axis == "z": T[:2, :2] = [[c, -s], [s, c]]
    return T

def chain(*Ts):
    M = np.eye(4)
    for T in Ts: M = M @ T
    return M

def lathe(profile, material, seg=48, flat=False, start=0.0):
    """profile: (r, y) 목록. 바닥 중심 → 바깥 → 위 → 안쪽 순서로 주면 법선이 바깥을 향합니다."""
    P = np.asarray(profile, float); n = len(P)
    t = np.zeros_like(P)
    t[1:-1] = P[2:] - P[:-2]; t[0] = P[1] - P[0]; t[-1] = P[-1] - P[-2]
    n2 = np.c_[t[:, 1], -t[:, 0]]; n2 /= np.linalg.norm(n2, axis=1, keepdims=True) + 1e-9
    th = start + np.linspace(0, 2 * np.pi, seg + 1)
    c, s = np.cos(th), np.sin(th)
    pos = np.stack([P[:, 0:1] * c, np.repeat(P[:, 1:2], seg + 1, 1), P[:, 0:1] * s], -1).reshape(-1, 3)
    nrm = np.stack([n2[:, 0:1] * c, np.repeat(n2[:, 1:2], seg + 1, 1), n2[:, 0:1] * s], -1).reshape(-1, 3)
    idx = []
    W = seg + 1
    for i in range(n - 1):
        for j in range(seg):
            a, b, cc, d = i * W + j, (i + 1) * W + j, i * W + j + 1, (i + 1) * W + j + 1
            idx += [a, b, cc, b, d, cc]
    part = Part(pos, nrm, idx, material)
    return flatten(part) if flat else part

def lathe_hard(polys, material, seg=48, flat=False, start=0.0):
    """모서리가 날카로운 회전체: 면마다 따로 lathe 한 뒤 합칩니다."""
    return merge([lathe(p, material, seg, flat, start) for p in polys])

def flatten(part):
    tri = part.pos[part.idx.reshape(-1, 3)]
    fn = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
    ln = np.linalg.norm(fn, axis=1, keepdims=True)
    keep = ln[:, 0] > 1e-12
    tri, fn = tri[keep], fn[keep] / ln[keep]
    pos = tri.reshape(-1, 3)
    nrm = np.repeat(fn, 3, 0)
    return Part(pos, nrm, np.arange(len(pos)), part.mat)

def merge(parts):
    pos, nrm, idx, off = [], [], [], 0
    for p in parts:
        pos.append(p.pos); nrm.append(p.nrm); idx.append(p.idx + off); off += len(p.pos)
    return Part(np.concatenate(pos), np.concatenate(nrm), np.concatenate(idx), parts[0].mat)

def sphere(r, material, seg=40, rings=24, squash=1.0):
    a = np.linspace(-np.pi / 2, np.pi / 2, rings + 1)
    return lathe([(r * np.cos(x), r * np.sin(x) * squash) for x in a], material, seg)

def tube(path, radii, material, seg=20, closed=False, caps=True):
    P = np.asarray(path, float); R = np.broadcast_to(np.asarray(radii, float), (len(P),)).copy()
    N = len(P)
    T = np.gradient(P, axis=0)
    if closed:
        T[0] = P[1] - P[-2]; T[-1] = T[0]
    T /= np.linalg.norm(T, axis=1, keepdims=True)
    ref = np.array([0, 0, 1.0]) if abs(T[0, 2]) < 0.9 else np.array([1.0, 0, 0])
    Nm = np.cross(T[0], ref); Nm /= np.linalg.norm(Nm)
    frames = []
    for i in range(N):
        if i:
            Nm = Nm - T[i] * np.dot(Nm, T[i]); Nm /= np.linalg.norm(Nm)
        B = np.cross(T[i], Nm)
        frames.append((Nm.copy(), B))
    th = np.linspace(0, 2 * np.pi, seg + 1)
    pos, nrm = [], []
    for i in range(N):
        Nm_i, B = frames[i]
        d = np.outer(np.cos(th), Nm_i) + np.outer(np.sin(th), B)
        pos.append(P[i] + d * R[i]); nrm.append(d)
    pos = np.concatenate(pos); nrm = np.concatenate(nrm)
    W = seg + 1; idx = []
    for i in range(N - 1):
        for j in range(seg):
            a, b, c, d = i * W + j, (i + 1) * W + j, i * W + j + 1, (i + 1) * W + j + 1
            idx += [a, c, b, b, c, d]
    parts = [Part(pos, nrm, idx, material)]
    if caps and not closed:
        for k, sgn in ((0, -1), (N - 1, 1)):
            if R[k] < 1e-4: continue
            ring = pos[k * W:(k + 1) * W]
            cpos = np.vstack([P[k], ring]); cn = np.repeat((T[k] * sgn)[None], len(cpos), 0)
            cidx = []
            for j in range(seg): cidx += [0, j + 1, j + 2]
            parts.append(Part(cpos, cn, cidx, material))
    return merge(parts)

def torus(R, r, material, seg=64, tseg=16):
    a = np.linspace(0, 2 * np.pi, seg + 1)
    path = np.c_[R * np.cos(a), np.zeros_like(a), R * np.sin(a)]
    return tube(path, r, material, tseg, closed=True)

def box(w, h, d, material):
    x, y, z = w / 2, h / 2, d / 2
    faces = [((1, 0, 0), [(x, -y, -z), (x, y, -z), (x, y, z), (x, -y, z)]),
             ((-1, 0, 0), [(-x, -y, z), (-x, y, z), (-x, y, -z), (-x, -y, -z)]),
             ((0, 1, 0), [(-x, y, -z), (-x, y, z), (x, y, z), (x, y, -z)]),
             ((0, -1, 0), [(-x, -y, z), (-x, -y, -z), (x, -y, -z), (x, -y, z)]),
             ((0, 0, 1), [(x, -y, z), (x, y, z), (-x, y, z), (-x, -y, z)]),
             ((0, 0, -1), [(-x, -y, -z), (-x, y, -z), (x, y, -z), (x, -y, -z)])]
    pos, nrm, idx = [], [], []
    for k, (n, q) in enumerate(faces):
        pos += q; nrm += [n] * 4; o = k * 4; idx += [o, o + 1, o + 2, o, o + 2, o + 3]
    return Part(pos, nrm, idx, material)

# ───────────────────────── 공통 받침 ─────────────────────────
def pedestal():
    base = lathe_hard([[(0, 0), (0.5, 0)], [(0.5, 0), (0.5, 0.07)], [(0.5, 0.07), (0.43, 0.1)],
                       [(0.43, 0.1), (0.43, 0.15)], [(0.43, 0.15), (0, 0.15)]], WOOD, seg=8, flat=True, start=np.pi / 8)
    trim = torus(0.47, 0.012, GOLD_D, seg=8).transform(chain(T_translate(0, 0.085, 0), T_rot("y", 22.5)))
    a = np.linspace(-np.pi / 2, np.pi / 2, 18)
    cushion = lathe([(0.37 * np.cos(x) ** 0.6, 0.05 * np.sin(x)) for x in a], SILK, 48).transform(T_translate(0, 0.2, 0))
    return [base, trim, cushion]

# ───────────────────────── 보물 ─────────────────────────
def haechi_horn():
    a = np.linspace(0, np.radians(115), 40)
    R0 = 0.42
    path = np.c_[R0 - R0 * np.cos(a), R0 * np.sin(a) * 1.25, np.zeros_like(a)]
    radii = 0.12 * (1 - a / a[-1]) ** 0.9 + 0.004
    horn = tube(path, radii, GOLD, seg=28).transform(chain(T_translate(-0.16, 0.22, 0)))
    rings = [torus(radii[k] + 0.006, 0.011, GOLD_D, seg=28).transform(
        chain(T_translate(*(path[k] + [-0.16, 0.22, 0])), T_rot("z", -np.degrees(np.arctan2(path[k + 1][0] - path[k][0], path[k + 1][1] - path[k][1])))))
        for k in (2, 9, 16)]
    return pedestal() + [horn] + rings

def deume():
    body = lathe([(0, 0), (0.2, 0), (0.22, 0.03), (0.19, 0.05), (0.26, 0.07), (0.38, 0.13), (0.45, 0.22),
                  (0.48, 0.32), (0.5, 0.34), (0.5, 0.37), (0.46, 0.37), (0.44, 0.3), (0.38, 0.2), (0.2, 0.14), (0, 0.13)], BRONZE, 64)
    water = lathe([(0.445, 0.31), (0, 0.31)], MIRROR, 64)
    handles = [torus(0.07, 0.016, BRONZE, 32, 12).transform(chain(T_translate(sx * 0.5, 0.27, 0), T_rot("x", 90), T_rot("z", 90 if sx > 0 else -90)))
               for sx in (1, -1)]
    bowl = [p.transform(T_translate(0, 0.25, 0)) for p in [body, water] + handles]
    return pedestal() + bowl

def dragon_pearl():
    pearl = sphere(0.19, PEARL, 48, 32).transform(T_translate(0, 0.46, 0))
    flames = []
    for k in range(7):
        ang = k / 7 * 2 * np.pi
        t = np.linspace(0, 1, 28)
        elev = np.radians(-35 + 115 * t)
        rad = 0.205 + 0.07 * np.sin(np.pi * t) * (0.8 + 0.2 * (k % 2))
        tw = ang + 0.7 * t
        path = np.c_[rad * np.cos(elev) * np.cos(tw), 0.46 + rad * np.sin(elev), rad * np.cos(elev) * np.sin(tw)]
        flames.append(tube(path, 0.055 * (1 - t) ** 0.7 + 0.004, FLAME if k % 2 else GOLD, 14))
    cup = lathe([(0, 0.22), (0.12, 0.22), (0.2, 0.27), (0.25, 0.33), (0.22, 0.35), (0.12, 0.3), (0, 0.29)], GOLD_D, 48)
    return pedestal() + [cup, pearl] + flames

def chimney():
    base = lathe_hard([[(0, 0.2), (0.2, 0.2)], [(0.2, 0.2), (0.2, 0.3)], [(0.2, 0.3), (0.17, 0.3)]], STONE, 6, True)
    body = lathe_hard([[(0.17, 0.3), (0.15, 0.72)], [(0.15, 0.72), (0, 0.72)]], BRICK, 6, True)
    bands = [lathe_hard([[(0.162, y), (0.162, y + 0.025)]], STONE, 6, True) for y in (0.42, 0.6)]
    roof = lathe_hard([[(0, 0.72), (0.25, 0.73)], [(0.25, 0.73), (0.22, 0.76)], [(0.22, 0.76), (0.07, 0.86)], [(0.07, 0.86), (0, 0.88)]], TILE, 6, True)
    smoke = [sphere(r, SMOKE, 24, 16).transform(T_translate(x, y, z)) for r, x, y, z in
             ((0.07, 0.0, 0.95, 0.0), (0.09, 0.06, 1.06, 0.02), (0.11, -0.02, 1.2, -0.03), (0.08, 0.1, 1.3, 0.04))]
    return pedestal() + [base, body, roof] + bands + smoke

def ember_lantern():
    bottom = lathe_hard([[(0, 0.22), (0.2, 0.22)], [(0.2, 0.22), (0.2, 0.26)], [(0.2, 0.26), (0, 0.26)]], IRON, 6, True)
    top = lathe_hard([[(0, 0.7), (0.24, 0.7)], [(0.24, 0.7), (0.06, 0.82)], [(0.06, 0.82), (0, 0.84)]], IRON, 6, True)
    knob = sphere(0.035, GOLD, 16, 10).transform(T_translate(0, 0.86, 0))
    posts = []
    for k in range(6):
        a = np.pi / 6 + k * np.pi / 3
        posts.append(box(0.025, 0.44, 0.025, IRON).transform(T_translate(0.18 * np.cos(a), 0.48, 0.18 * np.sin(a))))
    a = np.linspace(-np.pi / 2, np.pi / 2, 20)
    flame = lathe([(0.075 * np.cos(x) * (1 - 0.6 * (x + np.pi / 2) / np.pi), 0.42 + 0.1 * (np.sin(x) + 1)) for x in a], FLAME, 32)
    core = sphere(0.035, FLAME2, 20, 12, squash=1.6).transform(T_translate(0, 0.45, 0))
    wick = lathe_hard([[(0, 0.26), (0.06, 0.26)], [(0.06, 0.26), (0.05, 0.36)], [(0.05, 0.36), (0, 0.36)]], GOLD_D, 24)
    return pedestal() + [bottom, top, knob, flame, core, wick] + posts

def jinhwabu():
    disc = lathe_hard([[(0, -0.04), (0.5, -0.04)], [(0.5, -0.04), (0.5, 0.04)], [(0.5, 0.04), (0, 0.04)]], SEAL, 72)
    rim = torus(0.5, 0.03, GOLD, 72, 14)
    hub = lathe_hard([[(0, 0.04), (0.16, 0.04)], [(0.16, 0.04), (0.16, 0.08)], [(0.16, 0.08), (0, 0.08)]], GOLD, 48)
    hub_ring = torus(0.16, 0.012, GOLD_D, 48, 10).transform(T_translate(0, 0.08, 0))
    spokes, beads = [], []
    for k in range(5):
        ang = 90 + k * 72
        spokes.append(box(0.27, 0.03, 0.025, GOLD_D).transform(chain(T_rot("y", ang + 36), T_translate(0.31, 0.055, 0))))
        a = np.radians(ang)
        beads.append(sphere(0.055, GOLD, 24, 14).transform(T_translate(0.33 * np.cos(a), 0.06, -0.33 * np.sin(a))))
    parts = [disc, rim, hub, hub_ring] + spokes + beads
    # 세워서 보이도록 회전(앞면이 +Z를 향함)
    return [p.transform(T_rot("x", 90)) for p in parts]

# ───────────────────────── GLB 쓰기 ─────────────────────────
def write_glb(path, name, parts):
    groups = {}
    for p in parts:
        groups.setdefault(p.mat["name"], (p.mat, []))[1].append(p)
    blob = bytearray(); views, accs, mats, prims = [], [], [], []

    def add(arr, target, comp, typ, minmax=False):
        while len(blob) % 4: blob.append(0)
        off = len(blob); blob.extend(arr.tobytes())
        views.append({"buffer": 0, "byteOffset": off, "byteLength": arr.nbytes, "target": target})
        a = {"bufferView": len(views) - 1, "componentType": comp, "count": int(len(arr)), "type": typ}
        if minmax:
            a["min"] = arr.min(0).tolist(); a["max"] = arr.max(0).tolist()
        accs.append(a); return len(accs) - 1

    for mname, (m, ps) in groups.items():
        g = merge(ps)
        mats.append(m)
        idx = g.idx.astype(np.uint16) if len(g.pos) < 65535 else g.idx.astype(np.uint32)
        prims.append({"attributes": {"POSITION": add(g.pos.astype(np.float32), 34962, 5126, "VEC3", True),
                                     "NORMAL": add(g.nrm.astype(np.float32), 34962, 5126, "VEC3")},
                      "indices": add(idx, 34963, 5123 if idx.dtype == np.uint16 else 5125, "SCALAR"),
                      "material": len(mats) - 1, "mode": 4})
    while len(blob) % 4: blob.append(0)
    gltf = {"asset": {"version": "2.0", "generator": "bomul-ar make_models.py (임시 모델)"},
            "scene": 0, "scenes": [{"nodes": [0]}], "nodes": [{"mesh": 0, "name": name}],
            "meshes": [{"name": name, "primitives": prims}], "materials": mats,
            "accessors": accs, "bufferViews": views, "buffers": [{"byteLength": len(blob)}]}
    js = json.dumps(gltf, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    js += b" " * ((4 - len(js) % 4) % 4)
    total = 12 + 8 + len(js) + 8 + len(blob)
    with open(path, "wb") as f:
        f.write(struct.pack("<4sII", b"glTF", 2, total))
        f.write(struct.pack("<II", len(js), 0x4E4F534A)); f.write(js)
        f.write(struct.pack("<II", len(blob), 0x004E4942)); f.write(bytes(blob))
    return total

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for fname, fn in [("haechi-horn", haechi_horn), ("deume-mirror", deume), ("dragon-pearl", dragon_pearl),
                      ("amisan-chimney", chimney), ("mulbul-ember", ember_lantern), ("jinhwabu", jinhwabu)]:
        size = write_glb(os.path.join(OUT, fname + ".glb"), fname, fn())
        print(f"{fname}.glb  {size/1024:.0f} KB")
