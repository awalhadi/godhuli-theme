// Color science helpers shared by build and check. Zero dependencies.
// sRGB <-> CIELAB/LCh (D65), alpha compositing, APCA (SAPC 0.0.98G-4g), Machado CVD simulation.

const HEX_RE = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i;

export function isHex(value) {
  return HEX_RE.test(value);
}

export function parseHex(hex) {
  const m = HEX_RE.exec(hex);
  if (!m) throw new Error(`Invalid hex color: ${hex}`);
  const n = parseInt(m[1], 16);
  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255,
    a: m[2] ? parseInt(m[2], 16) / 255 : 1,
  };
}

const to2 = (v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0');

export function toHex({ r, g, b }, alpha) {
  const base = `#${to2(r)}${to2(g)}${to2(b)}`.toUpperCase();
  return alpha === undefined ? base : base + alpha.toUpperCase();
}

// Composite a (possibly translucent) color over an opaque background.
export function composite(fgHex, bgHex) {
  const f = parseHex(fgHex);
  const b = parseHex(bgHex);
  const mix = (x, y) => x * f.a + y * (1 - f.a);
  return toHex({ r: mix(f.r, b.r), g: mix(f.g, b.g), b: mix(f.b, b.b) });
}

// ---- CIELAB / LCh --------------------------------------------------------

const linear = (c) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const gamma = (v) => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

const WHITE = [0.95047, 1, 1.08883];
const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
const fInv = (t) => (t ** 3 > 216 / 24389 ? t ** 3 : (116 * t - 16) / (24389 / 27));

function rgbToXyz({ r, g, b }) {
  const [R, G, B] = [linear(r), linear(g), linear(b)];
  return [
    0.4124564 * R + 0.3575761 * G + 0.1804375 * B,
    0.2126729 * R + 0.7151522 * G + 0.072175 * B,
    0.0193339 * R + 0.119192 * G + 0.9503041 * B,
  ];
}

function xyzToRgb([X, Y, Z]) {
  return {
    r: gamma(3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z),
    g: gamma(-0.969266 * X + 1.8760108 * Y + 0.041556 * Z),
    b: gamma(0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z),
  };
}

export function hexToLab(hex) {
  const [x, y, z] = rgbToXyz(parseHex(hex)).map((v, i) => f(v / WHITE[i]));
  return { L: 116 * y - 16, a: 500 * (x - y), b: 200 * (y - z) };
}

export function hexToLch(hex) {
  const { L, a, b } = hexToLab(hex);
  const h = (Math.atan2(b, a) * 180) / Math.PI;
  return { L, C: Math.hypot(a, b), h: (h + 360) % 360 };
}

export function lchToHex({ L, C, h }) {
  const rad = (h * Math.PI) / 180;
  const a = C * Math.cos(rad);
  const b = C * Math.sin(rad);
  const y = (L + 16) / 116;
  const xyz = [fInv(y + a / 500), fInv(y), fInv(y - b / 200)].map((v, i) => v * WHITE[i]);
  return toHex(xyzToRgb(xyz));
}

// Scale chroma, keep lightness and hue. Used to derive low-chroma flavors.
export function scaleChroma(hex, factor) {
  const { a } = parseHex(hex);
  const lch = hexToLch(hex);
  const out = lchToHex({ ...lch, C: lch.C * factor });
  return a === 1 ? out : out + to2(a * 255).toUpperCase();
}

// ---- APCA (SAPC 0.0.98G-4g constants) ------------------------------------

function apcaY(hex) {
  const { r, g, b } = parseHex(hex);
  const c = (v) => (v / 255) ** 2.4;
  return 0.2126729 * c(r) + 0.7151522 * c(g) + 0.072175 * c(b);
}

export function apca(textHex, bgHex) {
  const clamp = (y) => (y > 0.022 ? y : y + (0.022 - y) ** 1.414);
  const txt = clamp(apcaY(textHex));
  const bg = clamp(apcaY(bgHex));
  if (Math.abs(bg - txt) < 0.0005) return 0;
  let out;
  if (bg > txt) {
    const sapc = (bg ** 0.56 - txt ** 0.57) * 1.14;
    out = sapc < 0.1 ? 0 : sapc - 0.027;
  } else {
    const sapc = (bg ** 0.65 - txt ** 0.62) * 1.14;
    out = sapc > -0.1 ? 0 : sapc + 0.027;
  }
  return out * 100;
}

// ---- Color vision deficiency (Machado et al. 2009, severity 1.0) ----------

const CVD = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
};

export const CVD_TYPES = Object.keys(CVD);

export function simulateCvd(hex, type) {
  const { r, g, b } = parseHex(hex);
  const lin = [linear(r), linear(g), linear(b)];
  const [R, G, B] = CVD[type].map((row) => Math.min(1, Math.max(0, row[0] * lin[0] + row[1] * lin[1] + row[2] * lin[2])));
  return toHex({ r: gamma(R), g: gamma(G), b: gamma(B) });
}

export function deltaE(hexA, hexB) {
  const a = hexToLab(hexA);
  const b = hexToLab(hexB);
  return Math.hypot(a.L - b.L, a.a - b.a, a.b - b.b);
}
