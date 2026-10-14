/* =========================================================
   Nivara — 3D particle morph
   One cloud of points that morphs through the PHA story:
   0 cell · 1 waste feedstock · 2 microbes + PHA granules ·
   3 pellets · 4 bottle · 5 seedling (back to nature)

   main.js drives it by writing to window.VScene.target.
   ========================================================= */
(function () {
  'use strict';

  var THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.min.js';

  var canvas = document.querySelector('.webgl');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var touch = window.matchMedia('(hover: none), (pointer: coarse)').matches;

  // Targets written by main.js; the scene eases toward them every frame.
  var target = { morph: 0, opacity: 0, x: 0.42, y: 0, scale: 0.75 };
  var resolveReady;
  var api = {
    target: target,
    failed: false,
    ready: new Promise(function (res) { resolveReady = res; })
  };
  window.VScene = api;

  function fail(reason) {
    api.failed = true;
    if (reason) console.warn('[Nivara] 3D scene disabled:', reason);
    resolveReady(false);
  }

  if (!canvas) return fail('no canvas');
  try {
    var probe = document.createElement('canvas');
    if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) return fail('WebGL not supported');
  } catch (e) { return fail(e); }

  import(THREE_URL).then(init).catch(fail);

  /* ---------------------------------------------------------
     Helpers
     --------------------------------------------------------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  var rand = mulberry32(20261014);
  var range = function (a, b) { return a + (b - a) * rand(); };
  function onSphere(r) {
    var u = rand() * 2 - 1, t = rand() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    return [r * s * Math.cos(t), r * u, r * s * Math.sin(t)];
  }
  function inSphere(r) {
    var p = onSphere(1), k = r * Math.cbrt(rand());
    return [p[0] * k, p[1] * k, p[2] * k];
  }
  function mixC(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function mulC(a, k) { return [a[0] * k, a[1] * k, a[2] * k]; }
  function pickWeighted(weights) {
    var sum = 0, i;
    for (i = 0; i < weights.length; i++) sum += weights[i];
    var r = rand() * sum;
    for (i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) return i; }
    return weights.length - 1;
  }

  // brand palette (display-space RGB)
  var LIME = [0.78, 0.95, 0.42];
  var LIME_DEEP = [0.52, 0.78, 0.22];
  var AMBER = [0.94, 0.70, 0.36];
  var BONE = [0.95, 0.92, 0.84];
  var SEA = [0.48, 0.82, 0.76];
  var SOIL = [0.50, 0.34, 0.18];

  /* ---------------------------------------------------------
     Init
     --------------------------------------------------------- */
  function init(THREE) {
    var N = window.innerWidth < 900 ? 9000 : 16000;

    var V = THREE.Vector3, Q = THREE.Quaternion;
    var UP = new V(0, 1, 0);
    var tmp = new V();

    function makeShape(fill) {
      var pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
      for (var i = 0; i < N; i++) {
        var o = fill(i);
        pos[i * 3] = o.p[0]; pos[i * 3 + 1] = o.p[1]; pos[i * 3 + 2] = o.p[2];
        col[i * 3] = o.c[0]; col[i * 3 + 1] = o.c[1]; col[i * 3 + 2] = o.c[2];
      }
      return { pos: pos, col: col };
    }

    /* 0 — living cell (hero) */
    var granules0 = [];
    for (var g = 0; g < 9; g++) granules0.push({ c: inSphere(1.15), r: range(0.22, 0.42) });
    var granuleW = granules0.map(function (x) { return x.r * x.r; });
    var cell = makeShape(function () {
      var r = rand();
      if (r < 0.6) {
        var p = onSphere(2.05 * (1 + (rand() - 0.5) * 0.05));
        return { p: p, c: mixC(LIME, SEA, (p[1] + 2) / 4 * 0.8) };
      }
      if (r < 0.9) {
        var gr = granules0[pickWeighted(granuleW)];
        var q = onSphere(gr.r * range(0.8, 1));
        return { p: [gr.c[0] + q[0], gr.c[1] + q[1], gr.c[2] + q[2]], c: mixC(AMBER, BONE, rand() * 0.35) };
      }
      return { p: inSphere(1.9), c: mulC(LIME_DEEP, 0.45) };
    });

    /* 1 — waste feedstock: oil droplets & plant residue */
    var drops = [];
    for (var d = 0; d < 17; d++) {
      drops.push({
        c: [range(-1.85, 1.85), range(-1.5, 1.5), range(-1.1, 1.1)],
        r: d < 3 ? range(0.52, 0.68) : range(0.15, 0.45),
        oil: rand() < 0.68
      });
    }
    var dropW = drops.map(function (x) { return x.r * x.r; });
    var feed = makeShape(function () {
      if (rand() < 0.07) return { p: inSphere(2.4), c: mulC(AMBER, 0.35) };
      var dr = drops[pickWeighted(dropW)];
      var q = rand() < 0.88 ? onSphere(dr.r) : inSphere(dr.r * 0.9);
      var base = dr.oil ? mixC(AMBER, BONE, rand() * 0.3) : mixC(LIME_DEEP, LIME, rand());
      return { p: [dr.c[0] + q[0], dr.c[1] + q[1], dr.c[2] + q[2]], c: base };
    });

    /* 2 — microbes (rod-shaped cells) with glowing PHA granules */
    var bugs = [];
    var tries = 0;
    while (bugs.length < 7 && tries++ < 500) {
      var c = [range(-1.75, 1.75), range(-1.45, 1.45), range(-0.9, 0.9)];
      var ok = bugs.every(function (b) {
        return Math.hypot(b.c[0] - c[0], b.c[1] - c[1], b.c[2] - c[2]) > 1.3;
      });
      if (!ok) continue;
      var axis = new V(range(-1, 1), range(-1, 1), range(-0.6, 0.6)).normalize();
      var h = range(0.5, 0.78), R = range(0.3, 0.38);
      var grs = [], ng = 3 + Math.floor(rand() * 2);
      for (var k = 0; k < ng; k++) grs.push({ t: (k / (ng - 1) - 0.5) * 2 * h * 0.85, r: range(0.1, 0.17) });
      bugs.push({ c: c, q: new Q().setFromUnitVectors(UP, axis), h: h, R: R, grs: grs, flip: rand() < 0.5 ? 1 : -1 });
    }
    function bugPoint(b, local) {
      tmp.set(local[0], local[1], local[2]).applyQuaternion(b.q);
      return [tmp.x + b.c[0], tmp.y + b.c[1], tmp.z + b.c[2]];
    }
    var microbes = makeShape(function () {
      var b = bugs[Math.floor(rand() * bugs.length)];
      var r = rand();
      if (r < 0.58) { // membrane (capsule surface)
        var cylA = 2 * Math.PI * b.R * 2 * b.h, capA = 4 * Math.PI * b.R * b.R;
        var local;
        if (rand() < cylA / (cylA + capA)) {
          var th = rand() * Math.PI * 2;
          local = [b.R * Math.cos(th), range(-b.h, b.h), b.R * Math.sin(th)];
        } else {
          local = onSphere(b.R);
          local[1] += local[1] >= 0 ? b.h : -b.h;
        }
        return { p: bugPoint(b, local), c: mixC(LIME, SEA, rand() * 0.6) };
      }
      if (r < 0.9) { // PHA granules
        var gg = b.grs[Math.floor(rand() * b.grs.length)];
        var s = onSphere(gg.r * range(0.6, 1));
        return { p: bugPoint(b, [s[0], s[1] + gg.t, s[2]]), c: mixC(AMBER, BONE, rand() * 0.4) };
      }
      // flagellum trailing from one end
      var u = rand();
      var y = (b.h + b.R + u * 1.1) * b.flip;
      var wav = Math.sin(u * 9) * 0.14 * u;
      return { p: bugPoint(b, [wav, y, Math.cos(u * 7) * 0.06 * u]), c: mulC(LIME_DEEP, 0.75) };
    });

    /* 3 — harvested & compounded pellets */
    var pel = [];
    for (var pI = 0; pI < 90; pI++) {
      var falling = pI < 14;
      var pr = falling ? 0 : 2.3 * Math.sqrt(rand());
      var pa = rand() * Math.PI * 2;
      var top = -1.45 + 2.1 * (1 - pr / 2.4);
      var pc = falling
        ? [range(-0.25, 0.25), range(0.9, 2.5), range(-0.25, 0.25)]
        : [pr * Math.cos(pa), -1.45 + (top + 1.45) * Math.pow(rand(), 0.45), pr * Math.sin(pa) * 0.8];
      var rq = new Q().setFromUnitVectors(UP, new V(range(-1, 1), range(-1, 1), range(-1, 1)).normalize());
      pel.push({ c: pc, q: rq, tint: rand() });
    }
    var pellets = makeShape(function () {
      var p = pel[Math.floor(rand() * pel.length)];
      var R = 0.17, H = 0.1, local;
      if (rand() < 0.55) {
        var th = rand() * Math.PI * 2;
        local = [R * Math.cos(th), range(-H, H), R * Math.sin(th)];
      } else {
        var rr = R * Math.sqrt(rand()), aa = rand() * Math.PI * 2;
        local = [rr * Math.cos(aa), rand() < 0.5 ? H : -H, rr * Math.sin(aa)];
      }
      tmp.set(local[0], local[1], local[2]).applyQuaternion(p.q);
      var col = p.tint < 0.75 ? mixC(BONE, AMBER, p.tint * 0.6) : mixC(LIME, BONE, 0.3);
      return { p: [tmp.x + p.c[0], tmp.y + p.c[1] - 0.2, tmp.z + p.c[2]], c: col };
    });

    /* 4 — moulded bottle */
    function bottleR(y) {
      if (y < -1.78) { var b = (-1.78 - y) / 0.14; return 0.88 * Math.sqrt(Math.max(0, 1 - b * b) * 0.25 + 0.75); }
      if (y < 0.45) return 0.88;
      if (y < 1.3) { var t = (y - 0.45) / 0.85; t = t * t * (3 - 2 * t); return 0.88 - 0.54 * t; }
      if (y < 1.7) return 0.34;
      if (y < 2.15) return 0.41;
      return 0;
    }
    var bottle = makeShape(function () {
      var r = rand(), y, rad, th = rand() * Math.PI * 2;
      if (r < 0.06) { // base disc
        rad = 0.85 * Math.sqrt(rand());
        return { p: [rad * Math.cos(th), -1.92, rad * Math.sin(th)], c: mulC(AMBER, 0.7) };
      }
      if (r < 0.1) { // cap top
        rad = 0.41 * Math.sqrt(rand());
        return { p: [rad * Math.cos(th), 2.15, rad * Math.sin(th)], c: LIME_DEEP };
      }
      if (r < 0.15) { // faint inner volume (translucency)
        y = range(-1.8, 0.4); rad = 0.8 * Math.sqrt(rand());
        return { p: [rad * Math.cos(th), y, rad * Math.sin(th)], c: mulC(AMBER, 0.28) };
      }
      do { y = range(-1.92, 2.15); rad = bottleR(y); } while (rand() > rad / 0.88);
      var col;
      if (y > 1.7) col = mixC(LIME_DEEP, LIME, rand());
      else if (y > -0.95 && y < 0.15) col = mixC(LIME, BONE, 0.15 + rand() * 0.2);
      else col = mixC(AMBER, BONE, 0.25 + rand() * 0.35);
      return { p: [rad * Math.cos(th), y, rad * Math.sin(th)], c: col };
    });
    for (var bi = 1; bi < N * 3; bi += 3) bottle.pos[bi] -= 0.1; // centre it

    /* 5 — seedling growing from soil */
    var leafMats = [
      new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.35, Math.PI + 0.25, 0.55)),
      new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-0.3, -0.2, 0.5)),
      new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.2, Math.PI * 0.55, 0.9))
    ];
    var leafDims = [
      { L: 1.65, W: 0.56, o: [0.06, 0.75, 0] },
      { L: 1.55, W: 0.52, o: [0.1, 0.95, 0] },
      { L: 0.95, W: 0.32, o: [0.02, 0.05, 0] }
    ];
    var stemPt = function (t) { return [0.12 * Math.sin(t * 2.4), -1.55 + 2.55 * t, 0.06 * Math.sin(t * 3.1)]; };
    var seedling = makeShape(function () {
      var r = rand();
      if (r < 0.46) { // soil mound
        var sr = 2.15 * Math.sqrt(rand()), sa = rand() * Math.PI * 2;
        var hgt = 0.42 * Math.max(0, 1 - Math.pow(sr / 2.15, 2));
        var y = -1.75 + hgt * Math.pow(rand(), 0.35);
        var sc = rand() < 0.12 ? mulC(LIME_DEEP, 0.6) : mixC(SOIL, AMBER, rand() * 0.45);
        return { p: [sr * Math.cos(sa), y, sr * Math.sin(sa) * 0.75], c: sc };
      }
      if (r < 0.53) { // stem
        var t = rand(), sp = stemPt(t), j = onSphere(0.05);
        return { p: [sp[0] + j[0], sp[1] + j[1], sp[2] + j[2]], c: mixC(LIME_DEEP, LIME, t) };
      }
      if (r < 0.9) { // leaves
        var li = pickWeighted([1, 1, 0.35]), L = leafDims[li];
        var u = rand(), v, e = rand();
        if (e < 0.18) v = range(-0.06, 0.06);         // midrib
        else if (e < 0.42) v = rand() < 0.5 ? -1 : 1; // crisp outline
        else v = range(-1, 1);
        var w = L.W * Math.pow(Math.sin(Math.PI * Math.min(u, 0.999)), 0.85) * (1 - 0.25 * u);
        var lx = u * L.L, lz = v * w, ly = 0.28 * v * v * w + 0.22 * u * u;
        tmp.set(lx, ly, lz).applyMatrix4(leafMats[li]);
        var lc = Math.abs(v) < 0.1 ? mixC(LIME, BONE, 0.45) : mixC(LIME_DEEP, LIME, 0.35 + u * 0.65);
        return { p: [tmp.x + L.o[0], tmp.y + L.o[1], tmp.z + L.o[2]], c: lc };
      }
      // spores / nutrients drifting up
      var f = inSphere(2.3);
      return { p: [f[0], Math.abs(f[1]) - 1.2, f[2]], c: mulC(rand() < 0.5 ? LIME : SEA, 0.5) };
    });

    var SHAPES = [cell, feed, microbes, pellets, bottle, seedling];

    /* ---------------------------------------------------------
       Geometry & material
       --------------------------------------------------------- */
    var geo = new THREE.BufferGeometry();
    var aFrom = new THREE.BufferAttribute(new Float32Array(N * 3), 3);
    var aTo = new THREE.BufferAttribute(new Float32Array(N * 3), 3);
    var cFrom = new THREE.BufferAttribute(new Float32Array(N * 3), 3);
    var cTo = new THREE.BufferAttribute(new Float32Array(N * 3), 3);
    [aFrom, aTo, cFrom, cTo].forEach(function (a) { a.setUsage(THREE.DynamicDrawUsage); });
    var aRand = new Float32Array(N), aSize = new Float32Array(N);
    for (var i = 0; i < N; i++) { aRand[i] = rand(); aSize[i] = 0.55 + Math.pow(rand(), 3) * 1.4; }
    geo.setAttribute('position', aFrom); // three needs it; the real position is computed in the shader
    geo.setAttribute('aFrom', aFrom);
    geo.setAttribute('aTo', aTo);
    geo.setAttribute('aColFrom', cFrom);
    geo.setAttribute('aColTo', cTo);
    geo.setAttribute('aRand', new THREE.BufferAttribute(aRand, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1));
    geo.boundingSphere = new THREE.Sphere(new V(), 8);

    // Ashima 3D simplex noise
    var NOISE = [
      'vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}',
      'vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}',
      'vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}',
      'vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-.85373472095314*r;}',
      'float snoise(vec3 v){',
      ' const vec2 C=vec2(1./6.,1./3.);const vec4 D=vec4(0.,.5,1.,2.);',
      ' vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);',
      ' vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);',
      ' vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;',
      ' i=mod289(i);',
      ' vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));',
      ' float n_=.142857142857;vec3 ns=n_*D.wyz-D.xzx;',
      ' vec4 j=p-49.*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.*x_);',
      ' vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.-abs(x)-abs(y);',
      ' vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);',
      ' vec4 s0=floor(b0)*2.+1.;vec4 s1=floor(b1)*2.+1.;vec4 sh=-step(h,vec4(0.));',
      ' vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;',
      ' vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);',
      ' vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));',
      ' p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;',
      ' vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);m=m*m;',
      ' return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));',
      '}'
    ].join('\n');

    var uniforms = {
      uTime: { value: 0 },
      uMix: { value: 0 },
      uSize: { value: 30 },
      uPR: { value: 1 },
      uWobble: { value: 0.16 },
      uSwirl: { value: reduced ? 0.25 : 0.95 },
      uMouse: { value: new V(99, 99, 0) },
      uRepel: { value: touch ? 0 : 1 },
      uOpacity: { value: 0 }
    };

    var mat = new THREE.ShaderMaterial({
      uniforms: uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: [
        'uniform float uTime, uMix, uSize, uPR, uWobble, uSwirl, uRepel;',
        'uniform vec3 uMouse;',
        'attribute vec3 aFrom, aTo, aColFrom, aColTo;',
        'attribute float aRand, aSize;',
        'varying vec3 vColor; varying float vAlpha;',
        NOISE,
        'void main(){',
        '  float t = clamp((uMix - aRand * .4) / .6, 0., 1.);',
        '  t = t * t * (3. - 2. * t);',
        '  vec3 p = mix(aFrom, aTo, t);',
        '  float mid = sin(t * 3.14159265);',
        '  float tt = uTime * .22;',
        '  vec3 q = p * .55;',
        '  vec3 n = vec3(snoise(q + vec3(0., tt, 0.)), snoise(q + vec3(31.4, tt, 7.1)), snoise(q + vec3(-12.7, tt, 19.3)));',
        '  p += n * (.035 + mid * uSwirl);',
        '  float w = snoise(p * .7 + vec3(tt * 1.7));',
        '  p += normalize(p + 1e-4) * w * uWobble;',
        '  vec4 world = modelMatrix * vec4(p, 1.);',
        '  vec3 dm = world.xyz - uMouse;',
        '  float f = smoothstep(1.4, 0., length(dm.xy)) * uRepel;',
        '  world.xyz += normalize(dm + vec3(0., 0., .001)) * f * .55;',
        '  vec4 mv = viewMatrix * world;',
        '  gl_Position = projectionMatrix * mv;',
        '  gl_PointSize = uSize * aSize * uPR / -mv.z;',
        '  vColor = mix(aColFrom, aColTo, t);',
        '  float tw = .72 + .28 * sin(uTime * 1.8 + aRand * 40.);',
        '  vAlpha = tw * clamp(1.25 - (-mv.z - 8.) / 6., .3, 1.);',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform float uOpacity;',
        'varying vec3 vColor; varying float vAlpha;',
        'void main(){',
        '  float d = length(gl_PointCoord - .5);',
        '  if (d > .5) discard;',
        '  float a = smoothstep(.5, .06, d);',
        '  float core = smoothstep(.2, 0., d);',
        '  gl_FragColor = vec4(vColor + core * .22, a * vAlpha * uOpacity * .8);',
        '}'
      ].join('\n')
    });

    var points = new THREE.Points(geo, mat);
    points.frustumCulled = false;

    /* ambient dust for depth */
    var DN = window.innerWidth < 900 ? 350 : 800;
    var dGeo = new THREE.BufferGeometry();
    var dPos = new Float32Array(DN * 3), dCol = new Float32Array(DN * 3), dR = new Float32Array(DN);
    for (var di = 0; di < DN; di++) {
      dPos[di * 3] = range(-11, 11); dPos[di * 3 + 1] = range(-7, 7); dPos[di * 3 + 2] = range(-8, 3);
      var dc = rand() < 0.7 ? LIME : AMBER;
      dCol[di * 3] = dc[0]; dCol[di * 3 + 1] = dc[1]; dCol[di * 3 + 2] = dc[2];
      dR[di] = rand();
    }
    dGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
    dGeo.setAttribute('aCol', new THREE.BufferAttribute(dCol, 3));
    dGeo.setAttribute('aRand', new THREE.BufferAttribute(dR, 1));
    var dMat = new THREE.ShaderMaterial({
      uniforms: { uTime: uniforms.uTime, uPR: uniforms.uPR, uOpacity: { value: 0 } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: [
        'uniform float uTime, uPR;',
        'attribute vec3 aCol; attribute float aRand;',
        'varying vec3 vC; varying float vA;',
        'void main(){',
        '  vec3 p = position;',
        '  p.y = mod(p.y + uTime * (.08 + aRand * .18) + 7., 14.) - 7.;',
        '  p.x += sin(uTime * .3 + aRand * 20.) * .3;',
        '  vec4 mv = modelViewMatrix * vec4(p, 1.);',
        '  gl_Position = projectionMatrix * mv;',
        '  gl_PointSize = (10. + aRand * 18.) * uPR / -mv.z;',
        '  vC = aCol;',
        '  vA = .3 + .2 * sin(uTime + aRand * 30.);',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform float uOpacity;',
        'varying vec3 vC; varying float vA;',
        'void main(){',
        '  float d = length(gl_PointCoord - .5);',
        '  if (d > .5) discard;',
        '  gl_FragColor = vec4(vC, smoothstep(.5, 0., d) * vA * uOpacity);',
        '}'
      ].join('\n')
    });
    var dust = new THREE.Points(dGeo, dMat);
    dust.frustumCulled = false;

    /* ---------------------------------------------------------
       Renderer / scene
       --------------------------------------------------------- */
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: false, powerPreference: 'high-performance' });
    renderer.setClearColor(0x000000, 0);
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0, 10);
    var group = new THREE.Group();
    group.add(points);
    scene.add(group, dust);

    var halfH = 1, halfW = 1;
    function resize() {
      var w = window.innerWidth, h = window.innerHeight;
      var pr = Math.min(window.devicePixelRatio || 1, 2);
      renderer.setPixelRatio(pr);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      uniforms.uPR.value = pr;
      uniforms.uSize.value = (w < 900 ? 26 : 30) * Math.min(1.25, Math.max(0.8, h / 900));
      halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
      halfW = halfH * camera.aspect;
    }
    resize();
    window.addEventListener('resize', resize);

    /* morph segment management: only two shapes live on the GPU at a time */
    var seg = -1;
    function setSegment(i) {
      if (i === seg) return;
      seg = i;
      aFrom.array.set(SHAPES[i].pos); aTo.array.set(SHAPES[i + 1].pos);
      cFrom.array.set(SHAPES[i].col); cTo.array.set(SHAPES[i + 1].col);
      aFrom.needsUpdate = aTo.needsUpdate = cFrom.needsUpdate = cTo.needsUpdate = true;
    }
    setSegment(0);

    /* pointer */
    var mouse = { x: 0, y: 0, sx: 0, sy: 0, active: false };
    window.addEventListener('pointermove', function (e) {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
      mouse.active = e.pointerType === 'mouse';
    }, { passive: true });
    document.documentElement.addEventListener('pointerleave', function () { mouse.active = false; });

    /* loop */
    var cur = { morph: target.morph, opacity: 0, x: target.x, y: target.y, scale: target.scale };
    var clock = new THREE.Clock();
    var spin = 0;
    function damp(a, b, lambda, dt) { return a + (b - a) * (1 - Math.exp(-lambda * dt)); }

    function tick() {
      var dt = Math.min(clock.getDelta(), 0.05);
      var t = clock.elapsedTime;

      cur.morph = damp(cur.morph, target.morph, 4.5, dt);
      cur.opacity = damp(cur.opacity, target.opacity, 3.5, dt);
      cur.x = damp(cur.x, target.x, 3, dt);
      cur.y = damp(cur.y, target.y, 3, dt);
      cur.scale = damp(cur.scale, target.scale, 3, dt);
      mouse.sx = damp(mouse.sx, mouse.x, 4, dt);
      mouse.sy = damp(mouse.sy, mouse.y, 4, dt);

      var m = Math.max(0, Math.min(5, cur.morph));
      var i = Math.min(4, Math.floor(m));
      setSegment(i);
      uniforms.uMix.value = m - i;
      uniforms.uTime.value = reduced ? t * 0.3 : t;
      uniforms.uWobble.value = 0.17 * Math.max(0, 1 - m / 0.6);
      uniforms.uOpacity.value = cur.opacity;
      uniforms.uMouse.value.set(mouse.active ? mouse.sx * halfW : 99, mouse.active ? mouse.sy * halfH : 99, 0);
      dMat.uniforms.uOpacity.value = Math.min(1, cur.opacity * 1.2) * 0.8;

      spin += dt * (reduced ? 0.03 : 0.14);
      group.rotation.y = spin + mouse.sx * 0.45;
      group.rotation.x = -mouse.sy * 0.22 + Math.sin(t * 0.3) * 0.05;
      group.position.set(cur.x * halfW, cur.y * halfH, 0);
      group.scale.setScalar(cur.scale);
      dust.rotation.y = mouse.sx * 0.08;

      points.visible = dust.visible = cur.opacity > 0.003;
      renderer.render(scene, camera);
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    resolveReady(true);
  }
})();
