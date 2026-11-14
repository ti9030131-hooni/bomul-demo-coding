/*
 * 보물 여행 AR — 3D 보물 뷰어
 *
 * 1순위: three.js + GLTFLoader (CDN, 버전 고정). 디자이너가 만든 텍스처·애니메이션 포함 GLB도 그대로 표시됩니다.
 * 2순위: three.js를 불러올 수 없을 때(오프라인·CDN 차단) 쓰는 내장 WebGL 렌더러.
 *        색·금속감만 표현하는 간이 버전이라 텍스처는 그리지 않습니다.
 *
 * 사용법
 *   const v = await Treasure3D.create(canvas);
 *   await v.load("models/haechi-horn.glb");
 *   v.render(spinRadians, tiltRadians);   // 매 프레임 호출
 *   v.setNode("lid", -1.8);                // 이름 붙은 노드를 X축으로 회전(뚜껑 열기 등)
 *   v.setGlow(2.5);                        // 이름에 'glow'가 들어간 재질의 빛 세기
 *   v.dispose();
 *   load(url, { scale, offset:[x,y,z], light:[x,y,z] }) 로 화면 속 크기·위치와 내부 조명을 정할 수 있습니다.
 */
(function () {
  "use strict";

  const THREE_VER = "0.160.0";
  const CDN = `https://cdn.jsdelivr.net/npm/three@${THREE_VER}`;
  let threeLibs = null;      // Promise<{THREE, GLTFLoader, RoomEnvironment} | null>

  function withTimeout(p, ms) {
    return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
  }

  function loadThree() {
    if (threeLibs) return threeLibs;
    if (window.BOMUL_FORCE_LITE_3D) return (threeLibs = Promise.resolve(null));
    threeLibs = withTimeout(Promise.all([
      import(`${CDN}/build/three.module.js`),
      import(`${CDN}/examples/jsm/loaders/GLTFLoader.js`),
      import(`${CDN}/examples/jsm/environments/RoomEnvironment.js`),
    ]), 8000).then(([THREE, g, r]) => ({ THREE, GLTFLoader: g.GLTFLoader, RoomEnvironment: r.RoomEnvironment }))
      .catch((e) => { console.warn("[보물3D] three.js를 불러오지 못해 내장 렌더러를 씁니다.", e); return null; });
    return threeLibs;
  }

  // 단일 HTML로 배포할 때 window.BOMUL_EMBED[url] 에 base64로 넣어 둔 모델을 씁니다.
  function embedded(url) {
    const b64 = window.BOMUL_EMBED && window.BOMUL_EMBED[url];
    if (!b64) return null;
    const bin = atob(b64), out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out.buffer;
  }

  /* ───────────────────── three.js 뷰어 ───────────────────── */
  function createThreeViewer(canvas, L) {
    const { THREE, GLTFLoader, RoomEnvironment } = L;

    // 보안 정책(CSP) 때문에 GLB 안의 텍스처가 안 읽힌 경우, 이미지 바이트를 직접 풀어 다시 붙입니다.
    async function repairTextures(gltf, buf) {
      const json = gltf.parser && gltf.parser.json;
      if (!json || !json.images || !json.images.length) return;
      const dv = new DataView(buf); let off = 12, bin = null;
      while (off < buf.byteLength) {
        const len = dv.getUint32(off, true), type = dv.getUint32(off + 4, true);
        if (type === 0x004E4942) bin = buf.slice(off + 8, off + 8 + len);
        off += 8 + len;
      }
      if (!bin) return;
      const cache = {};
      const jobs = [];
      gltf.scene.traverse((n) => {
        if (!n.isMesh) return;
        [].concat(n.material).forEach((m) => {
          if (m.map) return;
          const as = gltf.parser.associations.get(m);
          const md = as && as.materials != null ? json.materials[as.materials] : null;
          const ti = md && md.pbrMetallicRoughness && md.pbrMetallicRoughness.baseColorTexture;
          if (!ti) return;
          const src = json.textures[ti.index].source, im = json.images[src];
          if (!im || im.bufferView == null) return;
          if (!cache[src]) {
            const v = json.bufferViews[im.bufferView];
            cache[src] = createImageBitmap(new Blob([new Uint8Array(bin, v.byteOffset || 0, v.byteLength)], { type: im.mimeType }))
              .then((bmp) => { const t = new THREE.Texture(bmp); t.flipY = false; t.colorSpace = THREE.SRGBColorSpace;
                t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; t.needsUpdate = true; return t; })
              .catch(() => null);
          }
          jobs.push(cache[src].then((t) => { if (t) { m.map = t; m.needsUpdate = true; } }));
        });
      });
      await Promise.all(jobs);
    }
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    scene.add(new THREE.HemisphereLight(0xfff2dc, 0x2a2420, 0.7));
    const key = new THREE.DirectionalLight(0xffffff, 1.8);
    key.position.set(2, 3, 2.5);
    scene.add(key);

    const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 50);
    cam.position.set(0, 0.32, 2.7);
    cam.lookAt(0, 0, 0);
    const pivot = new THREE.Group();
    scene.add(pivot);
    const loader = new GLTFLoader();
    let mixer = null, clock = new THREE.Clock(), root = null, glowMats = [], inner = null;

    return {
      kind: "three",
      async load(url, opts) {
        let buf = embedded(url);
        if (!buf) {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`${url} 을(를) 불러오지 못했습니다 (${res.status})`);
          buf = await res.arrayBuffer();
        }
        const gltf = await loader.parseAsync(buf, url.slice(0, url.lastIndexOf("/") + 1));
        await repairTextures(gltf, buf);
        while (pivot.children.length) pivot.remove(pivot.children[0]);
        const obj = gltf.scene;
        const box = new THREE.Box3().setFromObject(obj);
        const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
        obj.position.sub(center);
        const o = opts || {}, off = o.offset || [0, 0, 0];
        pivot.scale.setScalar((o.scale || 1) / Math.max(size.x, size.y, size.z, 1e-6));
        pivot.position.set(off[0], off[1], off[2]);
        pivot.add(obj);
        root = obj; glowMats = []; inner = null;
        obj.traverse((n) => {
          if (n.isMesh) [].concat(n.material).forEach((m) => { if (/glow/i.test(m.name || "")) { m.userData.baseEI = m.emissiveIntensity || 1; glowMats.push(m); } });
        });
        if (o.light) {
          inner = new THREE.PointLight(0xffc266, 0, 3, 1.5);
          inner.position.set(o.light[0], o.light[1], o.light[2]);
          obj.add(inner);
        }
        mixer = null;
        if (gltf.animations && gltf.animations.length) {
          mixer = new THREE.AnimationMixer(obj);
          gltf.animations.forEach((a) => mixer.clipAction(a).play());
        }
      },
      render(spin, tilt) {
        const w = canvas.clientWidth || canvas.width, h = canvas.clientHeight || canvas.height;
        if (canvas.width !== Math.round(w * renderer.getPixelRatio()) || canvas.height !== Math.round(h * renderer.getPixelRatio())) {
          renderer.setSize(w, h, false);
          cam.aspect = w / h;
          cam.updateProjectionMatrix();
        }
        if (mixer) mixer.update(clock.getDelta());
        pivot.rotation.set(tilt || 0, spin || 0, 0);
        renderer.render(scene, cam);
      },
      setNode(name, rx) { const n = root && root.getObjectByName(name); if (n) n.rotation.x = rx; },
      setGlow(v) {
        glowMats.forEach((m) => { m.emissiveIntensity = m.userData.baseEI * v; });
        if (inner) inner.intensity = Math.max(0, v - 0.6) * 2.2;
      },
      dispose() {
        envTex.dispose(); pmrem.dispose(); renderer.dispose();
        if (renderer.forceContextLoss) renderer.forceContextLoss();
      },
    };
  }

  /* ───────────────────── 내장(간이) 뷰어 ───────────────────── */
  const M4 = {
    mul(a, b) {
      const o = new Float32Array(16);
      for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
        let s = 0;
        for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
        o[c * 4 + r] = s;
      }
      return o;
    },
    persp(fovy, asp, n, f) {
      const t = 1 / Math.tan(fovy / 2), o = new Float32Array(16);
      o[0] = t / asp; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = 2 * f * n / (n - f);
      return o;
    },
    rotY(a) { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]); },
    rotX(a) { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]); },
    trans(x, y, z) { const o = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]); return o; },
    scale(s) { return new Float32Array([s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, 0, 0, 0, 1]); },
    fromTRS(t, q, s) {
      t = t || [0, 0, 0]; q = q || [0, 0, 0, 1]; s = s || [1, 1, 1];
      const [x, y, z, w] = q;
      return new Float32Array([
        (1 - 2 * (y * y + z * z)) * s[0], 2 * (x * y + z * w) * s[0], 2 * (x * z - y * w) * s[0], 0,
        2 * (x * y - z * w) * s[1], (1 - 2 * (x * x + z * z)) * s[1], 2 * (y * z + x * w) * s[1], 0,
        2 * (x * z + y * w) * s[2], 2 * (y * z - x * w) * s[2], (1 - 2 * (x * x + y * y)) * s[2], 0,
        t[0], t[1], t[2], 1]);
    },
  };

  function parseGLB(buf) {
    const dv = new DataView(buf);
    if (dv.getUint32(0, true) !== 0x46546C67) throw new Error("GLB 파일이 아닙니다");
    let off = 12, json = null, bin = null;
    while (off < buf.byteLength) {
      const len = dv.getUint32(off, true), type = dv.getUint32(off + 4, true);
      const chunk = buf.slice(off + 8, off + 8 + len);
      if (type === 0x4E4F534A) json = JSON.parse(new TextDecoder().decode(chunk));
      if (type === 0x004E4942) bin = chunk;
      off += 8 + len;
    }
    const COMP = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
    const NUM = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
    function acc(i) {
      const a = json.accessors[i], v = json.bufferViews[a.bufferView], T = COMP[a.componentType], n = NUM[a.type];
      const start = (v.byteOffset || 0) + (a.byteOffset || 0), stride = v.byteStride || 0, el = T.BYTES_PER_ELEMENT;
      if (!stride || stride === n * el) return new T(bin, start, a.count * n);
      const out = new T(a.count * n), src = new DataView(bin);
      const get = { 5126: "getFloat32", 5123: "getUint16", 5125: "getUint32", 5121: "getUint8" }[a.componentType];
      for (let i2 = 0; i2 < a.count; i2++) for (let k = 0; k < n; k++) out[i2 * n + k] = src[get](start + i2 * stride + k * el, true);
      return out;
    }
    const draws = [];
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    const images = (json.images || []).map((im) => {
      if (im.bufferView == null) return null;
      const v = json.bufferViews[im.bufferView];
      return new Blob([new Uint8Array(bin, v.byteOffset || 0, v.byteLength)], { type: im.mimeType || "image/png" });
    });
    function visit(ni, parent, group) {
      const node = json.nodes[ni];
      const local = node.matrix ? new Float32Array(node.matrix) : M4.fromTRS(node.translation, node.rotation, node.scale);
      const m = M4.mul(parent, local);
      if (node.name && node.mesh != null && group == null) group = { name: node.name, pivot: [m[12], m[13], m[14]] };
      if (node.mesh != null) {
        json.meshes[node.mesh].primitives.forEach((p) => {
          if (p.mode != null && p.mode !== 4) return;
          const src = acc(p.attributes.POSITION), nrmSrc = p.attributes.NORMAL != null ? acc(p.attributes.NORMAL) : null;
          const pos = new Float32Array(src.length), nrm = new Float32Array(src.length);
          for (let i = 0; i < src.length; i += 3) {
            const x = src[i], y = src[i + 1], z = src[i + 2];
            for (let r = 0; r < 3; r++) {
              const v = m[r] * x + m[4 + r] * y + m[8 + r] * z + m[12 + r];
              pos[i + r] = v; lo[r] = Math.min(lo[r], v); hi[r] = Math.max(hi[r], v);
            }
            if (nrmSrc) {
              const a = nrmSrc[i], b = nrmSrc[i + 1], c = nrmSrc[i + 2];
              let nx = m[0] * a + m[4] * b + m[8] * c, ny = m[1] * a + m[5] * b + m[9] * c, nz = m[2] * a + m[6] * b + m[10] * c;
              const l = Math.hypot(nx, ny, nz) || 1;
              nrm[i] = nx / l; nrm[i + 1] = ny / l; nrm[i + 2] = nz / l;
            } else { nrm[i + 1] = 1; }
          }
          const mat = (p.material != null && json.materials[p.material]) || {};
          const pbr = mat.pbrMetallicRoughness || {};
          const texInfo = pbr.baseColorTexture;
          const tex = texInfo && json.textures && json.textures[texInfo.index];
          draws.push({
            pos, nrm, idx: p.indices != null ? acc(p.indices) : null,
            uv: p.attributes.TEXCOORD_0 != null ? acc(p.attributes.TEXCOORD_0) : null,
            image: tex && tex.source != null ? images[tex.source] : null,
            name: mat.name || "", group,
            base: pbr.baseColorFactor || [0.8, 0.8, 0.8, 1],
            metal: pbr.metallicFactor != null ? pbr.metallicFactor : 1,
            rough: pbr.roughnessFactor != null ? pbr.roughnessFactor : 1,
            emis: mat.emissiveFactor || [0, 0, 0],
          });
        });
      }
      (node.children || []).forEach((c) => visit(c, m, group));
    }
    const scene = json.scenes[json.scene || 0];
    scene.nodes.forEach((n) => visit(n, M4.scale(1), null));
    return { draws, center: [0, 1, 2].map((k) => (lo[k] + hi[k]) / 2), size: Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) };
  }

  const VS = `attribute vec3 p;attribute vec3 n;attribute vec2 t;uniform mat4 model;uniform mat4 vp;varying vec3 vn;varying vec3 vw;varying vec2 vt;
  void main(){vec4 w=model*vec4(p,1.);vw=w.xyz;vn=mat3(model)*n;vt=t;gl_Position=vp*w;}`;
  const FS = `precision mediump float;varying vec3 vn;varying vec3 vw;varying vec2 vt;uniform sampler2D tex;uniform vec4 base;uniform float metal;uniform float rough;uniform vec3 emis;uniform vec3 eye;
  void main(){vec3 N=normalize(vn);vec3 V=normalize(eye-vw);if(dot(N,V)<0.)N=-N;
  vec3 L=normalize(vec3(.55,.8,.6));float dif=max(dot(N,L),0.);
  vec3 hemi=mix(vec3(.22,.19,.17),vec3(1.,.96,.88),N.y*.5+.5);
  vec3 R=reflect(-V,N);vec3 env=mix(vec3(.12,.1,.09),vec3(1.05,.98,.86),smoothstep(-.3,.7,R.y))+.7*pow(max(dot(R,L),0.),6.);
  float sh=mix(140.,8.,rough);float spec=pow(max(dot(R,L),0.),sh)*(1.-rough)*1.6;
  vec3 tc=texture2D(tex,vt).rgb;vec3 b=base.rgb*pow(tc,vec3(2.2));vec3 c=b*(hemi*.55+dif*.8)*(1.-metal)+b*env*metal*(1.-rough*.5)+spec*mix(vec3(.04),b,metal)+emis;
  c=c/(c+vec3(.85))*1.6;gl_FragColor=vec4(pow(c,vec3(1./2.2)),base.a);}`;

  function createLiteViewer(canvas) {
    const gl = canvas.getContext("webgl2", { alpha: true, antialias: true, premultipliedAlpha: false }) ||
               canvas.getContext("webgl", { alpha: true, antialias: true, premultipliedAlpha: false });
    if (!gl) throw new Error("WebGL을 쓸 수 없습니다");
    const isGL2 = typeof WebGL2RenderingContext !== "undefined" && gl instanceof WebGL2RenderingContext;
    const u32 = isGL2 || gl.getExtension("OES_element_index_uint");
    function sh(type, src) {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    }
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
    const loc = (n) => gl.getUniformLocation(prog, n);
    const U = { model: loc("model"), vp: loc("vp"), base: loc("base"), metal: loc("metal"), rough: loc("rough"), emis: loc("emis"), eye: loc("eye"), tex: loc("tex") };
    const aP = gl.getAttribLocation(prog, "p"), aN = gl.getAttribLocation(prog, "n"), aT = gl.getAttribLocation(prog, "t");
    let meshes = [], fit = M4.scale(1), nodeRot = {}, glow = 1;
    const white = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, white);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
    const texCache = new Map(), textures = [];
    async function uploadImage(blob) {
      if (texCache.has(blob)) return texCache.get(blob);
      let img;
      try { img = await createImageBitmap(blob); } catch (e) { return white; }
      const tx = gl.createTexture(); textures.push(tx);
      gl.bindTexture(gl.TEXTURE_2D, tx);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      const pow2 = (n) => (n & (n - 1)) === 0;
      if (pow2(img.width) && pow2(img.height)) {
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      } else {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      }
      texCache.set(blob, tx); return tx;
    }
    const bufs = [];

    return {
      kind: "lite",
      async load(url, opts) {
        let buf = embedded(url);
        if (!buf) {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`${url} 을(를) 불러오지 못했습니다 (${res.status})`);
          buf = await res.arrayBuffer();
        }
        const g = parseGLB(buf);
        bufs.forEach((b) => gl.deleteBuffer(b)); bufs.length = 0;
        const texs = await Promise.all(g.draws.map((d) => (d.image && d.uv ? uploadImage(d.image) : Promise.resolve(white))));
        meshes = g.draws.map((d, di) => {
          const pb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, pb); gl.bufferData(gl.ARRAY_BUFFER, d.pos, gl.STATIC_DRAW);
          let tb = null;
          if (d.uv) { tb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, tb); gl.bufferData(gl.ARRAY_BUFFER, d.uv, gl.STATIC_DRAW); bufs.push(tb); }
          const nb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, nb); gl.bufferData(gl.ARRAY_BUFFER, d.nrm, gl.STATIC_DRAW);
          bufs.push(pb, nb);
          let ib = null, count = d.pos.length / 3, type = 0;
          if (d.idx) {
            let idx = d.idx;
            if (idx instanceof Uint32Array && !u32) idx = new Uint16Array(idx);
            if (idx instanceof Uint8Array) idx = new Uint16Array(idx);
            ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
            bufs.push(ib); count = idx.length; type = idx instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
          }
          return { pb, nb, tb, ib, count, type, d, tex: texs[di] };
        });
        const o = opts || {}, off = o.offset || [0, 0, 0];
        const s = (o.scale || 1) / Math.max(g.size, 1e-6);
        fit = M4.mul(M4.trans(off[0], off[1], off[2]), M4.mul(M4.scale(s), M4.trans(-g.center[0], -g.center[1], -g.center[2])));
      },
      render(spin, tilt) {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const w = Math.round((canvas.clientWidth || canvas.width) * dpr), h = Math.round((canvas.clientHeight || canvas.height) * dpr);
        if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
        gl.useProgram(prog);
        const eye = [0, 0.32, 2.7];
        const view = M4.mul(M4.rotX(Math.atan2(eye[1], eye[2])), M4.trans(-eye[0], -eye[1], -eye[2]));
        const vp = M4.mul(M4.persp(30 * Math.PI / 180, canvas.width / canvas.height, 0.01, 50), view);
        const model = M4.mul(M4.mul(M4.rotX(tilt || 0), M4.rotY(spin || 0)), fit);
        gl.uniformMatrix4fv(U.vp, false, vp); gl.uniformMatrix4fv(U.model, false, model); gl.uniform3fv(U.eye, eye);
        meshes.forEach((m) => {
          let mm = model;
          const gr = m.d.group, a = gr && nodeRot[gr.name];
          if (a) { const pv = gr.pivot; mm = M4.mul(model, M4.mul(M4.trans(pv[0], pv[1], pv[2]), M4.mul(M4.rotX(a), M4.trans(-pv[0], -pv[1], -pv[2])))); }
          gl.uniformMatrix4fv(U.model, false, mm);
          gl.bindBuffer(gl.ARRAY_BUFFER, m.pb); gl.enableVertexAttribArray(aP); gl.vertexAttribPointer(aP, 3, gl.FLOAT, false, 0, 0);
          gl.bindBuffer(gl.ARRAY_BUFFER, m.nb); gl.enableVertexAttribArray(aN); gl.vertexAttribPointer(aN, 3, gl.FLOAT, false, 0, 0);
          if (m.tb) { gl.bindBuffer(gl.ARRAY_BUFFER, m.tb); gl.enableVertexAttribArray(aT); gl.vertexAttribPointer(aT, 2, gl.FLOAT, false, 0, 0); }
          else { gl.disableVertexAttribArray(aT); gl.vertexAttrib2f(aT, 0.5, 0.5); }
          gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, m.tex || white); gl.uniform1i(U.tex, 0);
          const e = /glow/i.test(m.d.name) ? glow : 1;
          gl.uniform4fv(U.base, m.d.base); gl.uniform1f(U.metal, m.d.metal); gl.uniform1f(U.rough, m.d.rough);
          gl.uniform3fv(U.emis, [m.d.emis[0] * e, m.d.emis[1] * e, m.d.emis[2] * e]);
          if (m.ib) { gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.ib); gl.drawElements(gl.TRIANGLES, m.count, m.type, 0); }
          else gl.drawArrays(gl.TRIANGLES, 0, m.count);
        });
      },
      setNode(name, rx) { nodeRot[name] = rx; },
      setGlow(v) { glow = v; },
      dispose() {
        bufs.forEach((b) => gl.deleteBuffer(b)); textures.forEach((t) => gl.deleteTexture(t)); gl.deleteProgram(prog);
        const ext = gl.getExtension("WEBGL_lose_context"); if (ext) ext.loseContext();
      },
    };
  }

  window.Treasure3D = {
    /** three.js를 미리 불러 둡니다(선택). */
    preload: loadThree,
    async create(canvas) {
      const L = await loadThree();
      if (L) {
        try { const v = createThreeViewer(canvas, L); console.info("[보물3D] three.js 렌더러 사용"); return v; }
        catch (e) { console.warn("[보물3D] three.js 뷰어 생성 실패, 내장 렌더러로 전환", e); }
      }
      console.info("[보물3D] 내장 간이 렌더러 사용");
      return createLiteViewer(canvas);
    },
  };
})();
