// otel-compact/src/adt.js
function variants(name, spec) {
  const tags = Object.freeze(Object.keys(spec));
  for (const t of tags) {
    if (t === "match" || t === "is" || t === "tags" || t === "name") {
      throw new TypeError(`${name}: variant name "${t}" is reserved`);
    }
  }
  const ctors = {};
  for (const tag3 of tags) {
    const fields = spec[tag3];
    if (fields.includes("tag")) throw new TypeError(`${name}.${tag3}: field name "tag" is reserved`);
    if (new Set(fields).size !== fields.length) throw new TypeError(`${name}.${tag3}: duplicate field names`);
    if (fields.length === 0) {
      ctors[tag3] = Object.freeze({ tag: tag3 });
      continue;
    }
    ctors[tag3] = (...args) => {
      if (args.length !== fields.length) {
        throw new TypeError(`${name}.${tag3}: expected ${fields.length} args (${fields.join(", ")}), got ${args.length}`);
      }
      const o = { tag: tag3 };
      for (let i = 0; i < fields.length; i++) o[fields[i]] = args[i];
      return Object.freeze(o);
    };
  }
  const match = (v, cases) => {
    if (!("_" in cases)) {
      for (const t of tags) {
        if (!(t in cases)) throw new TypeError(`${name}.match: missing case ${t}`);
      }
    }
    for (const k in cases) {
      if (k !== "_" && !tags.includes(k)) throw new TypeError(`${name}.match: unknown case ${k}`);
    }
    const f = v !== null && typeof v === "object" && cases[v.tag] || cases._;
    if (!f) throw new TypeError(`${name}.match: not a ${name}: ${JSON.stringify(v)}`);
    return f(v);
  };
  const is = (v) => typeof v === "object" && v !== null && tags.includes(
    /** @type {any} */
    v.tag
  );
  return Object.freeze({ ...ctors, match, is, tags, name });
}
var ok = (value2) => Object.freeze({ tag: "Ok", value: value2 });
var err = (error) => Object.freeze({ tag: "Err", error });
var NONE = Object.freeze({ tag: "None" });

// outline/src/path.js
var Seg = variants("Seg", {
  MoveTo: ["x", "y"],
  LineTo: ["x", "y"],
  QuadTo: ["x1", "y1", "x", "y"],
  CubicTo: ["x1", "y1", "x2", "y2", "x", "y"],
  Close: []
});
var IDENTITY = Object.freeze([1, 0, 0, 1, 0, 0]);

// sfnt/src/bin.js
var freshFault = () => ({ at: -1, need: 0, len: 0, count: 0, reads: 0, why: "" });
var READ_BUDGET = 1 << 24;
var ROOT = freshFault();
var scope = ROOT;
var view = (bytes) => ({ bytes, dv: new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength) });
var EMPTY = view(new Uint8Array(0));
var inRange = (v, o, n) => {
  if (++scope.reads > READ_BUDGET && scope !== ROOT) {
    if (scope.at < 0) {
      scope.at = o;
      scope.need = n;
      scope.len = v.bytes.length;
      scope.why = "read budget";
    }
    scope.count++;
    return false;
  }
  if (o >= 0 && o + n <= v.bytes.length && Number.isInteger(o)) return true;
  if (scope.at < 0) {
    scope.at = o;
    scope.need = n;
    scope.len = v.bytes.length;
    scope.why = "out of range";
  }
  scope.count++;
  return false;
};
var u16 = (v, o) => inRange(v, o, 2) ? v.dv.getUint16(o) : 0;
var i16 = (v, o) => inRange(v, o, 2) ? v.dv.getInt16(o) : 0;
var u32 = (v, o) => inRange(v, o, 4) ? v.dv.getUint32(o) : 0;
var tag = (v, o) => inRange(v, o, 4) ? String.fromCharCode(v.bytes[o], v.bytes[o + 1], v.bytes[o + 2], v.bytes[o + 3]) : "\0\0\0\0";
var slice = (v, o, n) => inRange(v, o, n) ? view(v.bytes.subarray(o, o + n)) : EMPTY;
var fits = (v, o, n) => inRange(v, o, n);
var times = (n, f) => {
  const out = [];
  for (let i = 0; i < n && scope.at < 0; i++) out.push(f(i));
  return out;
};
var guard = (f, onFault) => {
  const outer = scope, mine = freshFault();
  scope = mine;
  let value2;
  try {
    value2 = f();
  } finally {
    scope = outer;
  }
  return mine.at >= 0 ? { tag: "Err", error: onFault(mine) } : { tag: "Ok", value: value2 };
};

// math/src/table.js
var MathError = variants("MathError", {
  Missing: [],
  // the font has no MATH table
  Truncated: ["at", "why"],
  // a read out of range (or past the read budget)
  Version: ["major"],
  Invalid: ["reason"]
});
var CONSTANTS = (
  /** @type {const} */
  [
    "ScriptPercentScaleDown",
    "ScriptScriptPercentScaleDown",
    "DelimitedSubFormulaMinHeight",
    "DisplayOperatorMinHeight",
    "MathLeading",
    "AxisHeight",
    "AccentBaseHeight",
    "FlattenedAccentBaseHeight",
    "SubscriptShiftDown",
    "SubscriptTopMax",
    "SubscriptBaselineDropMin",
    "SuperscriptShiftUp",
    "SuperscriptShiftUpCramped",
    "SuperscriptBottomMin",
    "SuperscriptBaselineDropMax",
    "SubSuperscriptGapMin",
    "SuperscriptBottomMaxWithSubscript",
    "SpaceAfterScript",
    "UpperLimitGapMin",
    "UpperLimitBaselineRiseMin",
    "LowerLimitGapMin",
    "LowerLimitBaselineDropMin",
    "StackTopShiftUp",
    "StackTopDisplayStyleShiftUp",
    "StackBottomShiftDown",
    "StackBottomDisplayStyleShiftDown",
    "StackGapMin",
    "StackDisplayStyleGapMin",
    "StretchStackTopShiftUp",
    "StretchStackBottomShiftDown",
    "StretchStackGapAboveMin",
    "StretchStackGapBelowMin",
    "FractionNumeratorShiftUp",
    "FractionNumeratorDisplayStyleShiftUp",
    "FractionDenominatorShiftDown",
    "FractionDenominatorDisplayStyleShiftDown",
    "FractionNumeratorGapMin",
    "FractionNumDisplayStyleGapMin",
    "FractionRuleThickness",
    "FractionDenominatorGapMin",
    "FractionDenomDisplayStyleGapMin",
    "SkewedFractionHorizontalGap",
    "SkewedFractionVerticalGap",
    "OverbarVerticalGap",
    "OverbarRuleThickness",
    "OverbarExtraAscender",
    "UnderbarVerticalGap",
    "UnderbarRuleThickness",
    "UnderbarExtraDescender",
    "RadicalVerticalGap",
    "RadicalDisplayStyleVerticalGap",
    "RadicalRuleThickness",
    "RadicalExtraAscender",
    "RadicalKernBeforeDegree",
    "RadicalKernAfterDegree",
    "RadicalDegreeBottomRaisePercent"
  ]
);
function coverageGids(v, o, max) {
  const out = [];
  const fmt = u16(v, o), n = u16(v, o + 2);
  if (fmt === 1) {
    if (!fits(v, o + 4, n * 2)) return out;
    for (let i = 0; i < n && out.length < max; i++) out.push(u16(v, o + 4 + i * 2));
  } else if (fmt === 2) {
    if (!fits(v, o + 4, n * 6)) return out;
    for (let i = 0; i < n && out.length < max; i++) {
      const r = o + 4 + i * 6, start = u16(v, r), end = u16(v, r + 2), idx = u16(v, r + 4);
      for (let g = start; g <= end && out.length < max; g++) out[idx + g - start] = g;
      if (out.length > max) out.length = max;
    }
    for (let i = 0; i < out.length; i++) if (typeof out[i] !== "number") out[i] = -1;
  }
  return out;
}
var value = (v, o) => i16(v, o);
function valueMap(v, covAt, count, rec) {
  const m = /* @__PURE__ */ new Map();
  if (!fits(v, rec, count * 4)) return m;
  const gids = coverageGids(v, covAt, count);
  gids.forEach((g, i) => {
    if (g >= 0) m.set(g, value(v, rec + i * 4));
  });
  return m;
}
function mathKern(v, o) {
  const n = u16(v, o);
  if (!fits(v, o + 2, (2 * n + 1) * 4)) return { heights: [], kerns: [] };
  return {
    heights: times(n, (i) => value(v, o + 2 + i * 4)),
    kerns: times(n + 1, (i) => value(v, o + 2 + (n + i) * 4))
  };
}
function construction(v, o) {
  const asmOff = u16(v, o), n = u16(v, o + 2);
  const variants2 = fits(v, o + 4, n * 4) ? times(n, (i) => ({ gid: u16(v, o + 4 + i * 4), advance: u16(v, o + 6 + i * 4) })) : [];
  let assembly = null;
  if (asmOff) {
    const a = o + asmOff, parts = u16(v, a + 4);
    assembly = {
      italic: value(v, a),
      parts: fits(v, a + 6, parts * 10) ? times(parts, (i) => {
        const p = a + 6 + i * 10;
        return { gid: u16(v, p), start: u16(v, p + 2), end: u16(v, p + 4), full: u16(v, p + 6), flags: u16(v, p + 8) };
      }) : []
    };
  }
  return { variants: variants2, assembly };
}
function parseMath(bytes) {
  const v = view(bytes);
  const r = guard(() => {
    const major = u16(v, 0);
    if (major !== 1) return MathError.Version(major);
    const cOff = u16(v, 4), giOff = u16(v, 6), mvOff = u16(v, 8);
    if (!cOff || !giOff || !mvOff) return MathError.Invalid("null MathConstants, MathGlyphInfo or MathVariants offset");
    const constants = (
      /** @type {Constants} */
      {}
    );
    CONSTANTS.forEach((name, i) => {
      constants[name] = i < 4 ? i < 2 ? i16(v, cOff + i * 2) : u16(v, cOff + i * 2) : i < 55 ? value(v, cOff + 8 + (i - 4) * 4) : i16(v, cOff + 8 + 51 * 4);
    });
    const itOff = u16(v, giOff), taOff = u16(v, giOff + 2), exOff = u16(v, giOff + 4), kiOff = u16(v, giOff + 6);
    const italics = itOff ? valueMap(v, giOff + itOff + u16(v, giOff + itOff), u16(v, giOff + itOff + 2), giOff + itOff + 4) : /* @__PURE__ */ new Map();
    const topAccent = taOff ? valueMap(v, giOff + taOff + u16(v, giOff + taOff), u16(v, giOff + taOff + 2), giOff + taOff + 4) : /* @__PURE__ */ new Map();
    const extended = new Set(exOff ? coverageGids(v, giOff + exOff, 65536) : []);
    extended.delete(-1);
    const kerns = /* @__PURE__ */ new Map();
    if (kiOff) {
      const k = giOff + kiOff, n = u16(v, k + 2);
      if (fits(v, k + 4, n * 8)) {
        coverageGids(v, k + u16(v, k), n).forEach((g, i) => {
          if (g < 0) return;
          const rec = k + 4 + i * 8;
          const corner = (j) => {
            const off = u16(v, rec + j * 2);
            return off ? mathKern(v, k + off) : null;
          };
          kerns.set(g, { TopRight: corner(0), TopLeft: corner(1), BottomRight: corner(2), BottomLeft: corner(3) });
        });
      }
    }
    const minConnectorOverlap = u16(v, mvOff);
    const vCov = u16(v, mvOff + 2), hCov = u16(v, mvOff + 4), nV = u16(v, mvOff + 6), nH = u16(v, mvOff + 8);
    const cons = (covOff, n, first) => {
      const m = /* @__PURE__ */ new Map();
      if (!covOff || !fits(v, mvOff + first, n * 2)) return m;
      coverageGids(v, mvOff + covOff, n).forEach((g, i) => {
        const off = u16(v, mvOff + first + i * 2);
        if (g >= 0 && off) m.set(g, construction(v, mvOff + off));
      });
      return m;
    };
    const vertical = cons(vCov, nV, 10), horizontal = cons(hCov, nH, 10 + nV * 2);
    return { tag: (
      /** @type {const} */
      "Table"
    ), table: { constants, italics, topAccent, extended, kerns, minConnectorOverlap, vertical, horizontal } };
  }, (f) => MathError.Truncated(f.at, f.why));
  if (r.tag === "Err") return r;
  const v2 = r.value;
  return "table" in v2 ? ok(v2.table) : err(
    /** @type {import('../../otel-compact/src/adt.js').Of<typeof MathError>} */
    v2
  );
}
function mathOf(font) {
  const b = font.tables.get("MATH");
  return b ? parseMath(b) : err(MathError.Missing);
}

// math/src/symbols.js
var SYMBOLS = {};
var add = (cls, m) => {
  for (const [k, cp] of Object.entries(m)) SYMBOLS[k] = [cp, cls];
};
add("ord", {
  infty: 8734,
  partial: 120597,
  nabla: 8711,
  forall: 8704,
  exists: 8707,
  nexists: 8708,
  neg: 172,
  lnot: 172,
  emptyset: 8709,
  varnothing: 8960,
  hbar: 8463,
  hslash: 8463,
  ell: 8467,
  wp: 8472,
  Re: 8476,
  Im: 8465,
  aleph: 8501,
  beth: 8502,
  angle: 8736,
  triangle: 9651,
  prime: 8242,
  top: 8868,
  bot: 8869,
  surd: 8730,
  flat: 9837,
  natural: 9838,
  sharp: 9839,
  clubsuit: 9827,
  diamondsuit: 9826,
  heartsuit: 9825,
  spadesuit: 9824,
  imath: 120484,
  jmath: 120485,
  Box: 9633,
  vdots: 8942,
  backslash: 92,
  "%": 37,
  "#": 35,
  "&": 38,
  $: 36,
  _: 95,
  "|": 8214,
  vert: 124,
  Vert: 8214,
  mho: 8487,
  complement: 8705,
  checkmark: 10003,
  dagger: 8224,
  ddagger: 8225,
  S: 167,
  P: 182
});
add("inner", { ldots: 8230, dots: 8230, cdots: 8943, ddots: 8945 });
add("bin", {
  pm: 177,
  mp: 8723,
  times: 215,
  div: 247,
  cdot: 8901,
  ast: 8727,
  star: 8902,
  circ: 8728,
  bullet: 8729,
  cap: 8745,
  cup: 8746,
  uplus: 8846,
  sqcap: 8851,
  sqcup: 8852,
  vee: 8744,
  lor: 8744,
  wedge: 8743,
  land: 8743,
  setminus: 8726,
  wr: 8768,
  oplus: 8853,
  ominus: 8854,
  otimes: 8855,
  oslash: 8856,
  odot: 8857,
  amalg: 10815,
  diamond: 8900,
  bigtriangleup: 9651,
  bigtriangledown: 9661,
  triangleleft: 9665,
  triangleright: 9655,
  lhd: 8882,
  rhd: 8883,
  unlhd: 8884,
  unrhd: 8885,
  bigcirc: 9711,
  cdotp: 8901
});
add("rel", {
  le: 8804,
  leq: 8804,
  ge: 8805,
  geq: 8805,
  ne: 8800,
  neq: 8800,
  equiv: 8801,
  sim: 8764,
  simeq: 8771,
  approx: 8776,
  cong: 8773,
  asymp: 8781,
  propto: 8733,
  subset: 8834,
  supset: 8835,
  subseteq: 8838,
  supseteq: 8839,
  subsetneq: 8842,
  supsetneq: 8843,
  sqsubset: 8847,
  sqsupset: 8848,
  sqsubseteq: 8849,
  sqsupseteq: 8850,
  in: 8712,
  ni: 8715,
  owns: 8715,
  notin: 8713,
  vdash: 8866,
  dashv: 8867,
  models: 8872,
  perp: 10178,
  mid: 8739,
  nmid: 8740,
  parallel: 8741,
  nparallel: 8742,
  prec: 8826,
  succ: 8827,
  preceq: 10927,
  succeq: 10928,
  ll: 8810,
  gg: 8811,
  bowtie: 8904,
  smile: 8995,
  frown: 8994,
  doteq: 8784,
  coloneqq: 8788,
  leqslant: 10877,
  geqslant: 10878,
  lesssim: 8818,
  gtrsim: 8819,
  triangleq: 8796,
  leftarrow: 8592,
  gets: 8592,
  rightarrow: 8594,
  to: 8594,
  uparrow: 8593,
  downarrow: 8595,
  leftrightarrow: 8596,
  updownarrow: 8597,
  Leftarrow: 8656,
  Rightarrow: 8658,
  Uparrow: 8657,
  Downarrow: 8659,
  Leftrightarrow: 8660,
  Updownarrow: 8661,
  mapsto: 8614,
  longleftarrow: 10229,
  longrightarrow: 10230,
  longleftrightarrow: 10231,
  Longleftarrow: 10232,
  Longrightarrow: 10233,
  Longleftrightarrow: 10234,
  longmapsto: 10236,
  hookleftarrow: 8617,
  hookrightarrow: 8618,
  leftharpoonup: 8636,
  leftharpoondown: 8637,
  rightharpoonup: 8640,
  rightharpoondown: 8641,
  rightleftharpoons: 8652,
  nearrow: 8599,
  searrow: 8600,
  swarrow: 8601,
  nwarrow: 8598,
  leadsto: 8669,
  iff: 10234,
  implies: 10233,
  impliedby: 10232
});
add("punct", { colon: 58 });
add("open", { "{": 123, lbrace: 123 });
add("close", { "}": 125, rbrace: 125 });
var NEGATED = (
  /** @type {Record<number, number>} */
  {
    61: 8800,
    60: 8814,
    62: 8815,
    8804: 8816,
    8805: 8817,
    8712: 8713,
    8715: 8716,
    8801: 8802,
    8764: 8769,
    8771: 8772,
    8776: 8777,
    8773: 8775,
    8834: 8836,
    8835: 8837,
    8838: 8840,
    8839: 8841,
    8739: 8740,
    8741: 8742,
    8826: 8832,
    8827: 8833
  }
);
var BIG_OPS = {
  sum: [8721, "auto"],
  prod: [8719, "auto"],
  coprod: [8720, "auto"],
  bigcup: [8899, "auto"],
  bigcap: [8898, "auto"],
  bigvee: [8897, "auto"],
  bigwedge: [8896, "auto"],
  bigoplus: [10753, "auto"],
  bigotimes: [10754, "auto"],
  bigodot: [10752, "auto"],
  biguplus: [10756, "auto"],
  bigsqcup: [10758, "auto"],
  int: [8747, "nolimits"],
  iint: [8748, "nolimits"],
  iiint: [8749, "nolimits"],
  oint: [8750, "nolimits"],
  oiint: [8751, "nolimits"],
  oiiint: [8752, "nolimits"]
};
var FUNCTIONS = {
  arccos: false,
  arcsin: false,
  arctan: false,
  arg: false,
  cos: false,
  cosh: false,
  cot: false,
  coth: false,
  csc: false,
  deg: false,
  det: true,
  dim: false,
  exp: false,
  gcd: true,
  hom: false,
  inf: true,
  ker: false,
  lg: false,
  lim: true,
  liminf: true,
  limsup: true,
  ln: false,
  log: false,
  max: true,
  min: true,
  Pr: true,
  sec: false,
  sin: false,
  sinh: false,
  sup: true,
  tan: false,
  tanh: false
};
var GREEK_LOWER = [
  "alpha",
  "beta",
  "gamma",
  "delta",
  "varepsilon",
  "zeta",
  "eta",
  "theta",
  "iota",
  "kappa",
  "lambda",
  "mu",
  "nu",
  "xi",
  "omicron",
  "pi",
  "rho",
  "varsigma",
  "sigma",
  "tau",
  "upsilon",
  "varphi",
  "chi",
  "psi",
  "omega"
];
var GREEK_UPPER = [
  "Alpha",
  "Beta",
  "Gamma",
  "Delta",
  "Epsilon",
  "Zeta",
  "Eta",
  "Theta",
  "Iota",
  "Kappa",
  "Lambda",
  "Mu",
  "Nu",
  "Xi",
  "Omicron",
  "Pi",
  "Rho",
  "varTheta",
  "Sigma",
  "Tau",
  "Upsilon",
  "Phi",
  "Chi",
  "Psi",
  "Omega"
];
var GREEK_SYMBOLS = ["epsilon", "vartheta", "varkappa", "phi", "varrho", "varpi"];
var GREEK = {};
GREEK_UPPER.forEach((n, i) => {
  GREEK[n] = n === "varTheta" ? 1012 : 913 + i;
});
GREEK_LOWER.forEach((n, i) => {
  GREEK[n] = 945 + i;
});
[1013, 977, 1008, 981, 1009, 982].forEach((cp, i) => {
  GREEK[GREEK_SYMBOLS[i]] = cp;
});
var ALPHABETS = (
  /** @type {Record<string, Variant>} */
  {
    mathrm: "normal",
    mathit: "italic",
    mathbf: "bold",
    boldsymbol: "bold-italic",
    bm: "bold-italic",
    mathbb: "double-struck",
    mathcal: "script",
    mathscr: "script",
    mathfrak: "fraktur",
    mathsf: "sans-serif",
    mathtt: "monospace"
  }
);
var LATIN = (
  /** @type {Record<string, number>} */
  {
    bold: 119808,
    italic: 119860,
    "bold-italic": 119912,
    script: 119964,
    fraktur: 120068,
    "double-struck": 120120,
    "sans-serif": 120224,
    monospace: 120432
  }
);
var HOLES = (
  /** @type {Record<string, Record<string, number>>} */
  {
    italic: { h: 8462 },
    script: { B: 8492, E: 8496, F: 8497, H: 8459, I: 8464, L: 8466, M: 8499, R: 8475, e: 8495, g: 8458, o: 8500 },
    fraktur: { C: 8493, H: 8460, I: 8465, R: 8476, Z: 8488 },
    "double-struck": { C: 8450, H: 8461, N: 8469, P: 8473, Q: 8474, R: 8477, Z: 8484 }
  }
);
var DIGITS = (
  /** @type {Record<string, number>} */
  { bold: 120782, "double-struck": 120792, "sans-serif": 120802, monospace: 120822 }
);
var GREEK_BASE = (
  /** @type {Record<string, number>} */
  { bold: 120488, italic: 120546, "bold-italic": 120604 }
);
var GREEK_ORDER = [
  ...Array.from({ length: 17 }, (_, i) => 913 + i),
  1012,
  ...Array.from({ length: 7 }, (_, i) => 931 + i),
  8711,
  ...Array.from({ length: 25 }, (_, i) => 945 + i),
  8706,
  1013,
  977,
  1008,
  981,
  1009,
  982
];
function styled(cp, v) {
  const ch = String.fromCodePoint(cp);
  const latin = /^[A-Za-z]$/.test(ch), digit = /^[0-9]$/.test(ch), greek = GREEK_ORDER.indexOf(cp);
  const isLowerGreek = greek >= 26 && greek <= 50;
  const w = v === "default" ? latin || isLowerGreek || greek >= 51 && cp !== 8706 ? "italic" : "normal" : v;
  if (w === "normal") return cp;
  if (latin) {
    const hole = HOLES[w] && HOLES[w][ch];
    if (hole) return hole;
    const base = LATIN[w];
    return base ? base + (ch >= "a" ? 26 + cp - 97 : cp - 65) : cp;
  }
  if (digit) return DIGITS[w] ? DIGITS[w] + cp - 48 : cp;
  if (greek >= 0 && GREEK_BASE[w]) return GREEK_BASE[w] + greek;
  return cp;
}
var CHAR_CLASS = {
  "+": "bin",
  "-": "bin",
  "*": "bin",
  "=": "rel",
  "<": "rel",
  ">": "rel",
  ":": "rel",
  ",": "punct",
  ";": "punct",
  "(": "open",
  "[": "open",
  ")": "close",
  "]": "close",
  "!": "close",
  "?": "close"
};
var CHAR_MAP = { "-": 8722, "*": 8727 };
var DELIMS = {
  "(": 40,
  ")": 41,
  "[": 91,
  "]": 93,
  "|": 124,
  "/": 47,
  ".": 0,
  "<": 10216,
  ">": 10217,
  "\\{": 123,
  "\\}": 125,
  "\\lbrace": 123,
  "\\rbrace": 125,
  "\\|": 8214,
  "\\Vert": 8214,
  "\\vert": 124,
  "\\lvert": 124,
  "\\rvert": 124,
  "\\lVert": 8214,
  "\\rVert": 8214,
  "\\langle": 10216,
  "\\rangle": 10217,
  "\\lfloor": 8970,
  "\\rfloor": 8971,
  "\\lceil": 8968,
  "\\rceil": 8969,
  "\\backslash": 92,
  "\\uparrow": 8593,
  "\\downarrow": 8595,
  "\\updownarrow": 8597,
  "\\Uparrow": 8657,
  "\\Downarrow": 8659,
  "\\Updownarrow": 8661,
  "\\lbrack": 91,
  "\\rbrack": 93,
  "\\lgroup": 10222,
  "\\rgroup": 10223
};
var DELIM_SYMBOLS = {
  langle: [10216, "open"],
  rangle: [10217, "close"],
  lfloor: [8970, "open"],
  rfloor: [8971, "close"],
  lceil: [8968, "open"],
  rceil: [8969, "close"],
  lvert: [124, "open"],
  rvert: [124, "close"],
  lVert: [8214, "open"],
  rVert: [8214, "close"],
  lbrack: [91, "open"],
  rbrack: [93, "close"]
};
var ACCENTS = {
  hat: [770, false],
  check: [780, false],
  tilde: [771, false],
  acute: [769, false],
  grave: [768, false],
  dot: [775, false],
  ddot: [776, false],
  breve: [774, false],
  bar: [772, false],
  vec: [8407, false],
  mathring: [778, false],
  widehat: [770, true],
  widetilde: [771, true],
  widecheck: [780, true],
  overrightarrow: [8594, true],
  overleftarrow: [8592, true],
  overleftrightarrow: [8596, true]
};
var BRACES = { overbrace: [9182, false], underbrace: [9183, true] };
var SPACES = {
  ",": 3,
  thinspace: 3,
  ":": 4,
  ">": 4,
  medspace: 4,
  ";": 5,
  thickspace: 5,
  "!": -3,
  negthinspace: -3,
  quad: 18,
  qquad: 36,
  " ": 6,
  enspace: 9
};
var BIG_SIZES = (
  /** @type {Record<string, [number, Cls]>} */
  {}
);
for (
  const [k, em] of
  /** @type {[string, number][]} */
  [["big", 0.85], ["Big", 1.15], ["bigg", 1.45], ["Bigg", 1.75]]
) {
  BIG_SIZES[k] = [em, "ord"];
  BIG_SIZES[`${k}l`] = [em, "open"];
  BIG_SIZES[`${k}r`] = [em, "close"];
  BIG_SIZES[`${k}m`] = [em, "rel"];
}
var ENVIRONMENTS = {
  matrix: [0, 0],
  pmatrix: [40, 41],
  bmatrix: [91, 93],
  Bmatrix: [123, 125],
  vmatrix: [124, 124],
  Vmatrix: [8214, 8214],
  cases: [123, 0],
  smallmatrix: [0, 0]
};

// math/src/tex.js
var TexError = variants("TexError", {
  UnknownCommand: ["name", "at"],
  UnknownEnvironment: ["name", "at"],
  Unexpected: ["found", "expected", "at"],
  DoubleScript: ["script", "at"],
  MissingArgument: ["name", "at"],
  BadDelimiter: ["found", "at"],
  TooDeep: ["limit", "at"],
  TooLong: ["length", "limit"]
});
var TEX_LIMITS = Object.freeze({ chars: 4096, depth: 64 });
function parseTex(src, limits = TEX_LIMITS) {
  if (src.length > limits.chars) return err(TexError.TooLong(src.length, limits.chars));
  let i = 0, depth = 0;
  let fault = null;
  const fail = (e) => {
    if (!fault) fault = e;
    i = src.length;
    return { kind: "row", items: [], at: i };
  };
  const isLetter = (c) => /^[A-Za-z]$/.test(c);
  const skip2 = () => {
    for (; ; ) {
      while (i < src.length && /\s/.test(src[i])) i++;
      if (src[i] !== "%") return;
      while (i < src.length && src[i] !== "\n") i++;
    }
  };
  const peekCmd = () => {
    if (src[i] !== "\\") return "";
    let j = i + 1;
    if (j < src.length && isLetter(src[j])) {
      while (j < src.length && isLetter(src[j])) j++;
      return src.slice(i + 1, j);
    }
    return j < src.length ? src[j] : "";
  };
  const readCmd = () => {
    const name = peekCmd();
    if (!name) {
      fail(TexError.Unexpected("end of input", "a control sequence name", i));
      return "";
    }
    i += 1 + name.length;
    return name;
  };
  const enter = () => {
    if (++depth > limits.depth) fail(TexError.TooDeep(limits.depth, i));
  };
  const row = (v, stops = []) => {
    enter();
    const at = i;
    const items = [];
    for (; ; ) {
      skip2();
      if (i >= src.length || src[i] === "}" || src[i] === "&" || src[i] === "]" && stops.includes("]")) break;
      const c = peekCmd();
      if (src[i] === "\\" && (stops.includes(c) || c === "\\" || c === "end" || c === "right" || c === "middle")) break;
      if (src[i] === "^" || src[i] === "_" || src[i] === "'") {
        attach(items, v);
        continue;
      }
      if (c === "limits" || c === "nolimits") {
        i += 1 + c.length;
        const last = items[items.length - 1];
        const op = last && last.kind === "scripts" ? last.base : last;
        if (!op || op.kind !== "bigop" && op.kind !== "opname") {
          fail(TexError.Unexpected(`\\${c}`, "a large operator before \\limits or \\nolimits", i));
          continue;
        }
        op.limits = c;
        continue;
      }
      items.push(atom(v));
    }
    depth--;
    return (
      /** @type {Node} */
      { kind: "row", items, at }
    );
  };
  const primed = /* @__PURE__ */ new WeakSet();
  const attach = (items, v) => {
    const at = i, ch = src[i++];
    const last = items.pop() || /** @type {Node} */
    { kind: "row", items: [], at };
    const s = last.kind === "scripts" ? last : { kind: "scripts", base: last, sup: null, sub: null, at: last.at };
    items.push(s);
    if (ch === "'") {
      if (s.sup && !primed.has(s.sup)) {
        fail(TexError.DoubleScript("superscript", at));
        return;
      }
      const primes = s.sup && s.sup.kind === "row" ? s.sup.items : [];
      primes.push({ kind: "sym", cp: 8242, cls: "ord", at });
      while (src[i] === "'") primes.push({ kind: "sym", cp: 8242, cls: "ord", at: i++ });
      if (!s.sup) {
        s.sup = { kind: "row", items: primes, at };
        primed.add(s.sup);
      }
      return;
    }
    const which = ch === "^" ? "sup" : "sub";
    const arg = argument(v, ch);
    const cur = s[which];
    if (cur && which === "sup" && primed.has(cur) && cur.kind === "row") {
      primed.delete(cur);
      cur.items.push(arg);
      return;
    }
    if (cur) {
      fail(TexError.DoubleScript(which === "sup" ? "superscript" : "subscript", at));
      return;
    }
    s[which] = arg;
  };
  const argument = (v, name) => {
    skip2();
    if (i >= src.length || src[i] === "}" || src[i] === "&") return fail(TexError.MissingArgument(name, i));
    if (src[i] === "^" || src[i] === "_") return fail(TexError.Unexpected(src[i], `an argument for ${name}`, i));
    return atom(v);
  };
  const group = (v, name) => {
    skip2();
    if (src[i] !== "{") return fail(TexError.MissingArgument(name, i));
    i++;
    const r2 = row(v);
    close("}");
    return r2;
  };
  const close = (ch) => {
    skip2();
    if (src[i] !== ch) fail(TexError.Unexpected(i < src.length ? src[i] : "end of input", `'${ch}'`, i));
    i++;
  };
  const rawGroup = (name) => {
    skip2();
    if (src[i] !== "{") {
      fail(TexError.MissingArgument(name, i));
      return "";
    }
    const start = ++i;
    let level = 1;
    while (i < src.length && level > 0) {
      if (src[i] === "\\" && i + 1 < src.length) {
        i += 2;
        continue;
      }
      if (src[i] === "{") level++;
      else if (src[i] === "}") level--;
      i++;
    }
    if (level) {
      fail(TexError.Unexpected("end of input", "'}'", i));
      return "";
    }
    return src.slice(start, i - 1);
  };
  const delim = () => {
    skip2();
    const at = i;
    if (i >= src.length) {
      fail(TexError.BadDelimiter("end of input", at));
      return 0;
    }
    const key = src[i] === "\\" ? `\\${readCmd()}` : String.fromCodePoint(
      /** @type {number} */
      src.codePointAt(i)
    );
    if (key[0] !== "\\") i += key.length;
    if (!has(DELIMS, key)) {
      fail(TexError.BadDelimiter(key, at));
      return 0;
    }
    return DELIMS[key];
  };
  const atom = (v) => {
    enter();
    const n = fault || i >= src.length ? fail(TexError.Unexpected("end of input", "a math atom", i)) : atom1(v);
    depth--;
    return n;
  };
  const atom1 = (v) => {
    skip2();
    const at = i;
    const ch = src[i];
    if (ch === "{") {
      i++;
      const r2 = row(v);
      close("}");
      return r2;
    }
    if (ch === "\\") return command(v);
    if (ch === "}" || ch === "&") return fail(TexError.Unexpected(ch, "a math atom", at));
    if (ch === "#" || ch === "$") return fail(TexError.Unexpected(ch, `a math character (escape it as \\${ch})`, at));
    if (ch === "~") {
      i++;
      return { kind: "space", mu: SPACES[" "], at };
    }
    const cp = (
      /** @type {number} */
      src.codePointAt(i)
    );
    i += cp > 65535 ? 2 : 1;
    const s = String.fromCodePoint(cp);
    const cls = CHAR_CLASS[s] ?? classOf(cp);
    const mapped = CHAR_MAP[s] ?? cp;
    return { kind: "sym", cp: cls === "ord" ? styled(mapped, v) : mapped, cls, at };
  };
  const command = (v) => {
    const at = i;
    const name = readCmd();
    if (has(GREEK, name)) return { kind: "sym", cp: styled(GREEK[name], v), cls: "ord", at };
    if (has(SYMBOLS, name)) {
      const [cp, cls] = SYMBOLS[name];
      if (name === "iff" || name === "implies" || name === "impliedby") {
        return { kind: "row", items: [{ kind: "space", mu: 5, at }, { kind: "sym", cp, cls, at }, { kind: "space", mu: 5, at }], at };
      }
      return { kind: "sym", cp, cls, at };
    }
    if (has(DELIM_SYMBOLS, name)) {
      const [cp, cls] = DELIM_SYMBOLS[name];
      return { kind: "sym", cp, cls, at };
    }
    if (has(BIG_OPS, name)) {
      const [cp, limits2] = BIG_OPS[name];
      return { kind: "bigop", cp, limits: limits2, at };
    }
    if (has(FUNCTIONS, name)) return { kind: "opname", name, limits: FUNCTIONS[name] ? "auto" : "nolimits", at };
    if (has(SPACES, name)) return { kind: "space", mu: SPACES[name], at };
    if (has(ALPHABETS, name)) {
      const g = argument(ALPHABETS[name], `\\${name}`);
      return g.kind === "row" ? g : { kind: "row", items: [g], at };
    }
    if (has(ACCENTS, name)) {
      const [cp, stretchy] = ACCENTS[name];
      return { kind: "accent", base: argument(v, `\\${name}`), cp, stretchy, at };
    }
    if (has(BRACES, name)) {
      const [cp, under] = BRACES[name];
      return { kind: "brace", base: argument(v, `\\${name}`), cp, under, at };
    }
    if (has(BIG_SIZES, name)) {
      const [em, cls] = BIG_SIZES[name];
      return { kind: "big", cp: delim(), em, cls, at };
    }
    switch (name) {
      case "frac":
      case "dfrac":
      case "tfrac":
      case "cfrac": {
        const num2 = argument(v, `\\${name}`), den2 = argument(v, `\\${name}`);
        return { kind: "frac", num: num2, den: den2, bar: true, style: name === "dfrac" || name === "cfrac" ? "D" : name === "tfrac" ? "T" : "auto", open: 0, close: 0, at };
      }
      case "binom":
      case "dbinom":
      case "tbinom": {
        const num2 = argument(v, `\\${name}`), den2 = argument(v, `\\${name}`);
        return { kind: "frac", num: num2, den: den2, bar: false, style: name === "dbinom" ? "D" : name === "tbinom" ? "T" : "auto", open: 40, close: 41, at };
      }
      case "sqrt": {
        skip2();
        let index = null;
        if (src[i] === "[") {
          i++;
          index = row(v, ["]"]);
          close("]");
        }
        return { kind: "sqrt", body: argument(v, "\\sqrt"), index, at };
      }
      case "left": {
        const open = delim();
        const parts = [];
        const middles = [];
        for (; ; ) {
          parts.push(row(v));
          skip2();
          const c = peekCmd();
          if (c === "middle") {
            readCmd();
            middles.push(delim());
            continue;
          }
          if (c === "right") {
            readCmd();
            return { kind: "fenced", open, close: delim(), middles, parts, at };
          }
          return fail(TexError.Unexpected(i < src.length ? src.slice(i, i + 8) : "end of input", "\\right to close \\left", i));
        }
      }
      case "right":
      case "middle":
        return fail(TexError.Unexpected(`\\${name}`, "a \\left before it", at));
      case "overline":
      case "underline":
        return { kind: "line", base: argument(v, `\\${name}`), under: name === "underline", at };
      case "overset":
      case "underset":
      case "stackrel": {
        const script = argument(v, `\\${name}`), base = argument(v, `\\${name}`);
        return { kind: "stack", base, over: name === "underset" ? null : script, under: name === "underset" ? script : null, cls: name === "stackrel" ? "rel" : clsOf(base), at };
      }
      case "text":
      case "textrm":
      case "mbox":
      case "textup":
      case "textnormal":
        return { kind: "text", text: rawGroup(`\\${name}`).replace(/(^|[^\\])[{}]/g, "$1").replace(/\\([{}$&#%_ ])/g, "$1"), at };
      case "operatorname": {
        const star = src[i] === "*";
        if (star) i++;
        const text = rawGroup("\\operatorname");
        if (/\\/.test(text)) return fail(TexError.Unexpected(text, "plain letters in \\operatorname", at));
        return { kind: "opname", name: text.trim(), limits: star ? "auto" : "nolimits", at };
      }
      case "mathord":
      case "mathop":
      case "mathbin":
      case "mathrel":
      case "mathopen":
      case "mathclose":
      case "mathpunct":
      case "mathinner": {
        const cls = (
          /** @type {Cls} */
          name.slice(4)
        );
        return { kind: "class", cls, body: argument(v, `\\${name}`), at };
      }
      case "displaystyle":
        return { kind: "style", style: "D", at };
      case "textstyle":
        return { kind: "style", style: "T", at };
      case "scriptstyle":
        return { kind: "style", style: "S", at };
      case "scriptscriptstyle":
        return { kind: "style", style: "SS", at };
      case "not": {
        const next2 = atom(v);
        const neg = next2.kind === "sym" ? NEGATED[next2.cp] : 0;
        if (!neg) return fail(TexError.Unexpected(src.slice(at, i), "a relation \\not can negate (=, <, \\in, \\equiv, \u2026)", at));
        return { kind: "sym", cp: neg, cls: "rel", at };
      }
      case "begin": {
        const env = rawGroup("\\begin");
        if (!has(ENVIRONMENTS, env)) return fail(TexError.UnknownEnvironment(env, at));
        const [open, closeCp] = ENVIRONMENTS[env];
        const rows = [[]];
        for (; ; ) {
          rows[rows.length - 1].push(row(v));
          skip2();
          if (src[i] === "&") {
            i++;
            continue;
          }
          const c = peekCmd();
          if (c === "\\") {
            i += 2;
            rows.push([]);
            continue;
          }
          if (c === "end") {
            readCmd();
            const end = rawGroup("\\end");
            if (end !== env) return fail(TexError.Unexpected(`\\end{${end}}`, `\\end{${env}}`, i));
            const last = rows[rows.length - 1];
            if (rows.length > 1 && last.length === 1 && last[0].kind === "row" && last[0].items.length === 0) rows.pop();
            return { kind: "matrix", rows, open, close: closeCp, cases: env === "cases", small: env === "smallmatrix", at };
          }
          return fail(TexError.Unexpected(i < src.length ? src[i] : "end of input", `& or \\\\ or \\end{${env}}`, i));
        }
      }
      default:
        return fail(TexError.UnknownCommand(`\\${name}`, at));
    }
  };
  const r = row("default");
  skip2();
  if (i < src.length) fail(TexError.Unexpected(src[i] === "\\" ? `\\${peekCmd()}` : src[i], "end of input", i));
  return fault ? err(fault) : ok(r);
}
var has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
function clsOf(n) {
  if (n.kind === "sym") return n.cls;
  if (n.kind === "row" && n.items.length === 1) return clsOf(n.items[0]);
  return n.kind === "bigop" || n.kind === "opname" ? "op" : "ord";
}
var BY_CP = /* @__PURE__ */ new Map();
for (const [cp, cls] of Object.values(SYMBOLS)) if (!BY_CP.has(cp)) BY_CP.set(cp, cls);
var classOf = (cp) => BY_CP.get(cp) ?? "ord";

// shape/src/kern.js
function parseKern(b) {
  const v = view(b);
  const r = guard(() => {
    if (u16(v, 0) !== 0) return (
      /** @type {Kerner[]} */
      []
    );
    const n = u16(v, 2);
    const out = [];
    let o = 4;
    for (let t = 0; t < n && o + 6 <= b.length; t++) {
      const length = u16(v, o + 2), coverage2 = u16(v, o + 4);
      const format = coverage2 >> 8, horizontal = (coverage2 & 1) !== 0, cross = (coverage2 & 4) !== 0;
      if (format === 0 && horizontal && !cross) {
        const nPairs = u16(v, o + 6), base = o + 14;
        if (fits(v, base, nPairs * 6)) out.push(pairs(v, base, nPairs));
      }
      if (length < 6) break;
      o += length;
    }
    return out;
  }, () => "truncated");
  return r.tag === "Ok" ? r : ok([]);
}
function pairs(v, base, n) {
  return (left, right) => {
    const key = left * 65536 + right;
    let lo = 0, hi = n - 1;
    while (lo <= hi) {
      const m = lo + hi >> 1, at = base + m * 6;
      const k = u16(v, at) * 65536 + u16(v, at + 2);
      if (k === key) return i16(v, at + 4);
      if (k < key) lo = m + 1;
      else hi = m - 1;
    }
    return 0;
  };
}
function applyKern(subtables, buf, isMark) {
  for (const kern of subtables) {
    for (let i = 0; i < buf.length; ) {
      if (isMark(i)) {
        i++;
        continue;
      }
      let j = i + 1;
      while (j < buf.length && isMark(j)) j++;
      if (j >= buf.length) break;
      const k = kern(buf[i].gid, buf[j].gid);
      if (k) {
        const k1 = k >> 1, k2 = k - k1;
        buf[i].ax += k1;
        buf[j].ax += k2;
        buf[j].dx += k2;
      }
      i = j;
    }
  }
}

// existing-glyph-table:ccc
var CCC_RANGES = Object.freeze([768, 788, 230, 789, 789, 232, 790, 793, 220, 794, 794, 232, 795, 795, 216, 796, 800, 220, 801, 802, 202, 803, 806, 220, 807, 808, 202, 809, 819, 220, 820, 824, 1, 825, 828, 220, 829, 836, 230, 837, 837, 240, 838, 838, 230, 839, 841, 220, 842, 844, 230, 845, 846, 220, 848, 850, 230, 851, 854, 220, 855, 855, 230, 856, 856, 232, 857, 858, 220, 859, 859, 230, 860, 860, 233, 861, 862, 234, 863, 863, 233, 864, 865, 234, 866, 866, 233, 867, 879, 230, 1155, 1159, 230, 1425, 1425, 220, 1426, 1429, 230, 1430, 1430, 220, 1431, 1433, 230, 1434, 1434, 222, 1435, 1435, 220, 1436, 1441, 230, 1442, 1447, 220, 1448, 1449, 230, 1450, 1450, 220, 1451, 1452, 230, 1453, 1453, 222, 1454, 1454, 228, 1455, 1455, 230, 1456, 1456, 22, 1457, 1457, 15, 1458, 1458, 16, 1459, 1459, 17, 1460, 1460, 23, 1461, 1461, 18, 1462, 1462, 19, 1463, 1463, 20, 1464, 1464, 21, 1465, 1466, 14, 1467, 1467, 24, 1468, 1468, 12, 1469, 1469, 25, 1471, 1471, 13, 1473, 1473, 10, 1474, 1474, 11, 1476, 1476, 230, 1477, 1477, 220, 1479, 1479, 21, 1552, 1559, 230, 1560, 1560, 31, 1561, 1561, 32, 1562, 1562, 33, 1611, 1611, 28, 1612, 1612, 29, 1613, 1613, 30, 1614, 1614, 31, 1615, 1615, 32, 1616, 1616, 33, 1617, 1617, 27, 1618, 1618, 34, 1619, 1620, 230, 1621, 1622, 220, 1623, 1627, 230, 1628, 1628, 220, 1629, 1630, 230, 1631, 1631, 220, 1648, 1648, 35, 1750, 1756, 230, 1759, 1762, 230, 1763, 1763, 220, 1764, 1764, 230, 1767, 1768, 230, 1770, 1770, 220, 1771, 1772, 230, 1773, 1773, 220, 1809, 1809, 36, 1840, 1840, 230, 1841, 1841, 220, 1842, 1843, 230, 1844, 1844, 220, 1845, 1846, 230, 1847, 1849, 220, 1850, 1850, 230, 1851, 1852, 220, 1853, 1853, 230, 1854, 1854, 220, 1855, 1857, 230, 1858, 1858, 220, 1859, 1859, 230, 1860, 1860, 220, 1861, 1861, 230, 1862, 1862, 220, 1863, 1863, 230, 1864, 1864, 220, 1865, 1866, 230, 2027, 2033, 230, 2034, 2034, 220, 2035, 2035, 230, 2045, 2045, 220, 2070, 2073, 230, 2075, 2083, 230, 2085, 2087, 230, 2089, 2093, 230, 2137, 2139, 220, 2200, 2200, 230, 2201, 2203, 220, 2204, 2207, 230, 2250, 2254, 230, 2255, 2259, 220, 2260, 2273, 230, 2275, 2275, 220, 2276, 2277, 230, 2278, 2278, 220, 2279, 2280, 230, 2281, 2281, 220, 2282, 2284, 230, 2285, 2287, 220, 2288, 2288, 28, 2289, 2289, 29, 2290, 2290, 30, 2291, 2293, 230, 2294, 2294, 220, 2295, 2296, 230, 2297, 2298, 220, 2299, 2303, 230, 2364, 2364, 7, 2381, 2381, 9, 2385, 2385, 230, 2386, 2386, 220, 2387, 2388, 230, 2492, 2492, 7, 2509, 2509, 9, 2558, 2558, 230, 2620, 2620, 7, 2637, 2637, 9, 2748, 2748, 7, 2765, 2765, 9, 2876, 2876, 7, 2893, 2893, 9, 3021, 3021, 9, 3132, 3132, 7, 3149, 3149, 9, 3157, 3157, 4, 3158, 3158, 5, 3260, 3260, 7, 3277, 3277, 9, 3387, 3388, 9, 3405, 3405, 9, 3530, 3530, 9, 3640, 3641, 3, 3642, 3642, 9, 3656, 3659, 107, 3768, 3769, 118, 3770, 3770, 9, 3784, 3787, 122, 3864, 3865, 220, 3893, 3893, 220, 3895, 3895, 220, 3897, 3897, 127, 3953, 3953, 129, 3954, 3954, 132, 3956, 3956, 131, 3962, 3965, 132, 3968, 3968, 132, 3970, 3971, 230, 3972, 3972, 9, 3974, 3975, 230, 4038, 4038, 254, 4151, 4151, 7, 4153, 4154, 9, 4237, 4237, 220, 4957, 4959, 230, 5908, 5909, 9, 5940, 5940, 9, 6098, 6098, 9, 6109, 6109, 230, 6313, 6313, 228, 6457, 6457, 222, 6458, 6458, 230, 6459, 6459, 220, 6679, 6679, 230, 6680, 6680, 220, 6752, 6752, 254, 6773, 6780, 230, 6783, 6783, 220, 6832, 6836, 230, 6837, 6842, 220, 6843, 6844, 230, 6845, 6845, 220, 6847, 6848, 220, 6849, 6850, 230, 6851, 6852, 220, 6853, 6857, 230, 6858, 6858, 220, 6859, 6862, 230, 6964, 6964, 7, 6980, 6980, 9, 7019, 7019, 230, 7020, 7020, 220, 7021, 7027, 230, 7082, 7083, 9, 7142, 7142, 7, 7154, 7155, 9, 7223, 7223, 7, 7376, 7378, 230, 7380, 7380, 1, 7381, 7385, 220, 7386, 7387, 230, 7388, 7391, 220, 7392, 7392, 230, 7394, 7400, 1, 7405, 7405, 220, 7412, 7412, 230, 7416, 7417, 230, 7616, 7617, 230, 7618, 7618, 220, 7619, 7625, 230, 7626, 7626, 220, 7627, 7628, 230, 7629, 7629, 234, 7630, 7630, 214, 7631, 7631, 220, 7632, 7632, 202, 7633, 7669, 230, 7670, 7670, 232, 7671, 7672, 228, 7673, 7673, 220, 7674, 7674, 218, 7675, 7675, 230, 7676, 7676, 233, 7677, 7677, 220, 7678, 7678, 230, 7679, 7679, 220, 8400, 8401, 230, 8402, 8403, 1, 8404, 8407, 230, 8408, 8410, 1, 8411, 8412, 230, 8417, 8417, 230, 8421, 8422, 1, 8423, 8423, 230, 8424, 8424, 220, 8425, 8425, 230, 8426, 8427, 1, 8428, 8431, 220, 8432, 8432, 230, 11503, 11505, 230, 11647, 11647, 9, 11744, 11775, 230, 12330, 12330, 218, 12331, 12331, 228, 12332, 12332, 232, 12333, 12333, 222, 12334, 12335, 224, 12441, 12442, 8, 42607, 42607, 230, 42612, 42621, 230, 42654, 42655, 230, 42736, 42737, 230, 43014, 43014, 9, 43052, 43052, 9, 43204, 43204, 9, 43232, 43249, 230, 43307, 43309, 220, 43347, 43347, 9, 43443, 43443, 7, 43456, 43456, 9, 43696, 43696, 230, 43698, 43699, 230, 43700, 43700, 220, 43703, 43704, 230, 43710, 43711, 230, 43713, 43713, 230, 43766, 43766, 9, 44013, 44013, 9, 64286, 64286, 26, 65056, 65062, 230, 65063, 65069, 220, 65070, 65071, 230, 66045, 66045, 220, 66272, 66272, 220, 66422, 66426, 230, 68109, 68109, 220, 68111, 68111, 230, 68152, 68152, 230, 68153, 68153, 1, 68154, 68154, 220, 68159, 68159, 9, 68325, 68325, 230, 68326, 68326, 220, 68900, 68903, 230, 69291, 69292, 230, 69373, 69375, 220, 69446, 69447, 220, 69448, 69450, 230, 69451, 69451, 220, 69452, 69452, 230, 69453, 69456, 220, 69506, 69506, 230, 69507, 69507, 220, 69508, 69508, 230, 69509, 69509, 220, 69702, 69702, 9, 69744, 69744, 9, 69759, 69759, 9, 69817, 69817, 9, 69818, 69818, 7, 69888, 69890, 230, 69939, 69940, 9, 70003, 70003, 7, 70080, 70080, 9, 70090, 70090, 7, 70197, 70197, 9, 70198, 70198, 7, 70377, 70377, 7, 70378, 70378, 9, 70459, 70460, 7, 70477, 70477, 9, 70502, 70508, 230, 70512, 70516, 230, 70722, 70722, 9, 70726, 70726, 7, 70750, 70750, 230, 70850, 70850, 9, 70851, 70851, 7, 71103, 71103, 9, 71104, 71104, 7, 71231, 71231, 9, 71350, 71350, 9, 71351, 71351, 7, 71467, 71467, 9, 71737, 71737, 9, 71738, 71738, 7, 71997, 71998, 9, 72003, 72003, 7, 72160, 72160, 9, 72244, 72244, 9, 72263, 72263, 9, 72345, 72345, 9, 72767, 72767, 9, 73026, 73026, 7, 73028, 73029, 9, 73111, 73111, 9, 73537, 73538, 9, 92912, 92916, 1, 92976, 92982, 230, 94192, 94193, 6, 113822, 113822, 1, 119141, 119142, 216, 119143, 119145, 1, 119149, 119149, 226, 119150, 119154, 216, 119163, 119170, 220, 119173, 119177, 230, 119178, 119179, 220, 119210, 119213, 230, 119362, 119364, 230, 122880, 122886, 230, 122888, 122904, 230, 122907, 122913, 230, 122915, 122916, 230, 122918, 122922, 230, 123023, 123023, 230, 123184, 123190, 230, 123566, 123566, 230, 123628, 123631, 230, 124140, 124141, 232, 124142, 124142, 220, 124143, 124143, 230, 125136, 125142, 220, 125252, 125257, 230, 125258, 125258, 7]);

// otel-compact/src/otlp.js
var NO_EVENTS = Object.freeze(
  /** @type {never[]} */
  []
);
var VARINT = 0;
var I64 = 1;
var LEN = 2;
var tag2 = (field, wire) => field << 3 | wire;
var vlen32 = (v) => v < 128 ? 1 : v < 16384 ? 2 : v < 2097152 ? 3 : v < 268435456 ? 4 : 5;
var enc = new TextEncoder();
var utf8Cache = /* @__PURE__ */ new Map();
var utf8 = (s) => {
  let b = utf8Cache.get(s);
  if (!b) {
    b = enc.encode(s);
    if (utf8Cache.size > 4096) utf8Cache.clear();
    utf8Cache.set(s, b);
  }
  return b;
};
var putNanos = (b, p, us) => {
  const whole = Math.floor(us);
  const frac = Math.round((us - whole) * 1e3);
  const hiU = Math.floor(whole / 4294967296), loU = whole - hiU * 4294967296;
  const low = loU * 1e3 + frac;
  const carry = Math.floor(low / 4294967296);
  const lo = low - carry * 4294967296, hi = hiU * 1e3 + carry;
  b[p] = lo;
  b[p + 1] = lo >>> 8;
  b[p + 2] = lo >>> 16;
  b[p + 3] = lo >>> 24;
  b[p + 4] = hi;
  b[p + 5] = hi >>> 8;
  b[p + 6] = hi >>> 16;
  b[p + 7] = hi >>> 24;
};
var f64 = new Float64Array(1);
var f64b = new Uint8Array(f64.buffer);
function anySize(v) {
  if (typeof v === "string") {
    const b = utf8(v).length;
    return 1 + vlen32(b) + b;
  }
  if (typeof v === "boolean") return 2;
  if (typeof v === "number") return Number.isInteger(v) ? 1 + int64Len(v) : 9;
  let inner = 0;
  for (
    const x of
    /** @type {any[]} */
    v
  ) {
    const s = anySize(x);
    inner += 1 + vlen32(s) + s;
  }
  return 1 + vlen32(inner) + inner;
}
var int64Len = (v) => {
  if (v < 0) return 10;
  let n = 1;
  while (v >= 128) {
    v = Math.floor(v / 128);
    n++;
  }
  return n;
};
var kvSize2 = (kb, v) => {
  const a = anySize(v);
  return 1 + vlen32(kb.length) + kb.length + 1 + vlen32(a) + a;
};
var Fwd = class {
  /** @param {number} size */
  constructor(size) {
    this.b = new Uint8Array(size);
    this.p = 0;
  }
  /** @param {number} v */
  v32(v) {
    const b = this.b;
    while (v >= 128) {
      b[this.p++] = v & 127 | 128;
      v >>>= 7;
    }
    b[this.p++] = v;
  }
  /** @param {number} v */
  i64(v) {
    if (v >= 0 && v < 2147483648) {
      this.v32(v);
      return;
    }
    if (v >= 0) {
      while (v >= 128) {
        this.b[this.p++] = v % 128 | 128;
        v = Math.floor(v / 128);
      }
      this.b[this.p++] = v;
      return;
    }
    let lo = v >>> 0, hi = Math.floor(v / 4294967296) >>> 0;
    for (let i = 0; i < 9; i++) {
      this.b[this.p++] = lo & 127 | 128;
      lo = (lo >>> 7 | hi << 25) >>> 0;
      hi >>>= 7;
    }
    this.b[this.p++] = lo & 1;
  }
  /** @param {Uint8Array} x */
  raw(x) {
    const n = x.length, b = this.b;
    if (n < 32) {
      let p = this.p;
      for (let i = 0; i < n; i++) b[p++] = x[i];
      this.p = p;
    } else {
      b.set(x, this.p);
      this.p += n;
    }
  }
  /** Length-delimited bytes copied from src[off..off+n). @param {number} field @param {Uint8Array} src @param {number} off @param {number} n */
  bytesAt(field, src, off, n) {
    const b = this.b;
    let p = this.p;
    b[p++] = tag2(field, LEN);
    b[p++] = n;
    for (let i = 0; i < n; i++) b[p++] = src[off + i];
    this.p = p;
  }
  /** @param {number} field @param {number} us */
  nanos(field, us) {
    this.b[this.p++] = tag2(field, I64);
    putNanos(this.b, this.p, us);
    this.p += 8;
  }
  /** @param {number} lo @param {number} hi */
  fixed64(lo, hi) {
    const b = this.b, p = this.p;
    b[p] = lo;
    b[p + 1] = lo >>> 8;
    b[p + 2] = lo >>> 16;
    b[p + 3] = lo >>> 24;
    b[p + 4] = hi;
    b[p + 5] = hi >>> 8;
    b[p + 6] = hi >>> 16;
    b[p + 7] = hi >>> 24;
    this.p += 8;
  }
  /** @param {number} field @param {Uint8Array} x */
  bytes(field, x) {
    this.v32(tag2(field, LEN));
    this.v32(x.length);
    this.raw(x);
  }
  /** @param {AttrValue} v */
  any(v) {
    if (typeof v === "string") return this.bytes(1, utf8(v));
    if (typeof v === "boolean") {
      this.v32(tag2(2, VARINT));
      this.v32(v ? 1 : 0);
      return;
    }
    if (typeof v === "number") {
      if (Number.isInteger(v)) {
        this.v32(tag2(3, VARINT));
        this.i64(v);
        return;
      }
      this.v32(tag2(4, I64));
      f64[0] = v;
      this.raw(f64b);
      return;
    }
    let inner = 0;
    for (
      const x of
      /** @type {any[]} */
      v
    ) {
      const s = anySize(x);
      inner += 1 + vlen32(s) + s;
    }
    this.v32(tag2(5, LEN));
    this.v32(inner);
    for (
      const x of
      /** @type {any[]} */
      v
    ) {
      this.v32(tag2(1, LEN));
      this.v32(anySize(x));
      this.any(x);
    }
  }
  /** @param {number} field @param {Attr} kv */
  kv(field, kv) {
    this.kv2(field, utf8(kv[0]), kv[1]);
  }
  /** @param {number} field @param {Uint8Array} kb @param {AttrValue} v */
  kv2(field, kb, v) {
    this.v32(tag2(field, LEN));
    this.v32(kvSize2(kb, v));
    this.bytes(1, kb);
    this.v32(tag2(2, LEN));
    this.v32(anySize(v));
    this.any(v);
  }
};
var scratch = new Fwd(10);

// otel-compact/src/trace.js
var Config = variants("Config", { Noop: [], Record: ["sink", "opts"] });
var Status = variants("Status", { Unset: [], Error: ["message"] });
var noop = () => {
};
var NOOP_SPAN = Object.freeze({
  recording: false,
  span: (_name, a, f) => (
    /** @type {any} */
    (typeof a === "function" ? a : f)(NOOP_SPAN)
  ),
  set: noop,
  event: noop,
  fail: noop
});
var NOOP_TRACER = Object.freeze({
  recording: false,
  span: NOOP_SPAN.span,
  flush: noop,
  record: noop,
  clock: null
});
var HEX = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, "0"));
function pooledRandomIds(words = 4096) {
  const pool = new Int32Array(words);
  let p = words;
  const next2 = () => {
    if (p === words) {
      globalThis.crypto.getRandomValues(pool);
      p = 0;
    }
    return pool[p++];
  };
  return { next: next2, trace: () => [next2(), next2(), next2(), next2()] };
}
var randomIds = Object.freeze(pooledRandomIds());

// shape/src/layout.js
var LayoutError = variants("LayoutError", { Truncated: ["table", "at"] });
function coverage(v, o) {
  const m = /* @__PURE__ */ new Map();
  const fmt = u16(v, o);
  if (fmt === 1) {
    const n = u16(v, o + 2);
    for (let i = 0; i < n; i++) m.set(u16(v, o + 4 + i * 2), i);
  } else if (fmt === 2) {
    const n = u16(v, o + 2);
    for (let i = 0; i < n; i++) {
      const r = o + 4 + i * 6;
      const start = u16(v, r), end = u16(v, r + 2), idx = u16(v, r + 4);
      for (let g = start; g <= end; g++) m.set(g, idx + g - start);
    }
  }
  return m;
}
function coverageView(v, o) {
  const fmt = u16(v, o), n = u16(v, o + 2);
  const s = slice(v, o + 4, n * (fmt === 1 ? 2 : 6));
  const dv = s.dv, len = s.bytes.length === 0 ? 0 : n;
  const get = fmt === 1 ? (g) => {
    let lo = 0, hi = len - 1;
    while (lo <= hi) {
      const m = lo + hi >> 1, x = dv.getUint16(m * 2);
      if (x === g) return m;
      if (x < g) lo = m + 1;
      else hi = m - 1;
    }
    return -1;
  } : fmt === 2 ? (g) => {
    let lo = 0, hi = len - 1;
    while (lo <= hi) {
      const m = lo + hi >> 1, r = m * 6;
      const start = dv.getUint16(r), end = dv.getUint16(r + 2);
      if (g < start) hi = m - 1;
      else if (g > end) lo = m + 1;
      else return dv.getUint16(r + 4) + g - start;
    }
    return -1;
  } : () => -1;
  return { get, has: (g) => get(g) >= 0 };
}
function classView(v, o) {
  const fmt = u16(v, o);
  if (fmt === 1) {
    const start = u16(v, o + 2), n = u16(v, o + 4);
    const s = slice(v, o + 6, n * 2), dv = s.dv, len = s.bytes.length === 0 ? 0 : n;
    return (g) => g >= start && g < start + len ? dv.getUint16((g - start) * 2) : 0;
  }
  if (fmt === 2) {
    const n = u16(v, o + 2);
    const s = slice(v, o + 4, n * 6), dv = s.dv, len = s.bytes.length === 0 ? 0 : n;
    return (g) => {
      let lo = 0, hi = len - 1;
      while (lo <= hi) {
        const m = lo + hi >> 1, r = m * 6;
        const start = dv.getUint16(r), end = dv.getUint16(r + 2);
        if (g < start) hi = m - 1;
        else if (g > end) lo = m + 1;
        else return dv.getUint16(r + 4);
      }
      return 0;
    };
  }
  return () => 0;
}
function classDef(v, o) {
  const m = /* @__PURE__ */ new Map();
  const fmt = u16(v, o);
  if (fmt === 1) {
    const start = u16(v, o + 2), n = u16(v, o + 4);
    for (let i = 0; i < n; i++) m.set(start + i, u16(v, o + 6 + i * 2));
  } else if (fmt === 2) {
    const n = u16(v, o + 2);
    for (let i = 0; i < n; i++) {
      const r = o + 4 + i * 6;
      const start = u16(v, r), end = u16(v, r + 2), cls = u16(v, r + 4);
      for (let g = start; g <= end; g++) m.set(g, cls);
    }
  }
  return (g) => m.get(g) ?? 0;
}
var EMPTY_GDEF = Object.freeze({ glyphClass: () => 0, markAttachClass: () => 0, markSets: [], hasClasses: false });
function parseGdef(b) {
  const v = view(b);
  return guard(() => {
    const minor = u16(v, 2);
    const gc = u16(v, 4), mac = u16(v, 10);
    const ms = minor >= 2 ? u16(v, 12) : 0;
    const markSets = ms ? times(u16(v, ms + 2), (i) => coverage(v, ms + u32(v, ms + 4 + i * 4))) : [];
    return {
      glyphClass: gc ? classDef(v, gc) : () => 0,
      hasClasses: gc !== 0,
      markAttachClass: mac ? classDef(v, mac) : () => 0,
      markSets
    };
  }, (e) => LayoutError.Truncated("GDEF", e.at));
}
function applyFeatureVariations(v, features) {
  if (u16(v, 0) !== 1 || u16(v, 2) < 1) return;
  const fvo = u32(v, 10);
  if (!fvo) return;
  const n = u32(v, fvo + 4);
  if (!fits(v, fvo + 8, n * 8)) return;
  for (let r = 0; r < n; r++) {
    const cs = u32(v, fvo + 8 + r * 8), fts = u32(v, fvo + 12 + r * 8);
    let match = true;
    if (cs) {
      const nc = u16(v, fvo + cs);
      for (let c = 0; c < nc && match; c++) {
        const co = fvo + cs + u32(v, fvo + cs + 2 + c * 4);
        match = u16(v, co) === 1 && i16(v, co + 4) <= 0 && 0 <= i16(v, co + 6);
      }
    }
    if (!match) continue;
    if (fts) {
      const base = fvo + fts, count = u16(v, base + 4);
      for (let k = 0; k < count; k++) {
        const fi = u16(v, base + 6 + k * 6), alt = base + u32(v, base + 8 + k * 6);
        if (fi < features.length) features[fi] = { tag: features[fi].tag, lookups: times(u16(v, alt + 2), (j) => u16(v, alt + 4 + j * 2)) };
      }
    }
    return;
  }
}
function parseLayout(b, which, span = NOOP_SPAN) {
  const v = view(b);
  const extType = which === "GSUB" ? 7 : 9;
  return guard(() => {
    const sl = u16(v, 4), fl = u16(v, 6), ll = u16(v, 8);
    const scripts = /* @__PURE__ */ new Map();
    span.span("layout.scripts", { atomic: true, items: u16(v, sl) }, () => {
      const langSys = /* @__PURE__ */ new Map();
      const parseLangSys = (at) => {
        const known = langSys.get(at);
        if (known) return known;
        const req = u16(v, at + 2);
        const list = times(u16(v, at + 4), (k) => u16(v, at + 6 + k * 2));
        const parsed = req === 65535 ? list : [req, ...list];
        langSys.set(at, parsed);
        return parsed;
      };
      times(u16(v, sl), (i) => {
        const s = sl + u16(v, sl + 6 + i * 6);
        const dl = u16(v, s);
        scripts.set(tag(v, sl + 2 + i * 6), { defaultLang: dl ? parseLangSys(s + dl) : [] });
      });
    });
    const features = span.span("layout.features", { atomic: true, items: u16(v, fl) }, () => times(u16(v, fl), (i) => {
      const f = fl + u16(v, fl + 6 + i * 6);
      return { tag: tag(v, fl + 2 + i * 6), lookups: times(u16(v, f + 2), (k) => u16(v, f + 4 + k * 2)) };
    }));
    span.span("layout.featureVariations", () => applyFeatureVariations(v, features));
    const lookups = span.span("layout.lookups", { atomic: true, items: u16(v, ll) }, () => times(u16(v, ll), (index) => {
      const l = ll + u16(v, ll + 2 + index * 2);
      let type = u16(v, l);
      const flag = u16(v, l + 2);
      const n = u16(v, l + 4);
      let subtables = times(n, (k) => l + u16(v, l + 6 + k * 2));
      if (type === extType && n > 0) {
        type = u16(v, subtables[0] + 2);
        subtables = subtables.map((s) => s + u32(v, s + 4));
      }
      const markSet = flag & 16 ? u16(v, l + 6 + n * 2) : -1;
      return { index, type, flag, markSet, subtables };
    }));
    return { v, scripts, features, lookups };
  }, (e) => LayoutError.Truncated(which, e.at));
}
function selectLookups(t, scriptPrefs, enabled) {
  const script = scriptPrefs.map((s) => t.scripts.get(s)).find(Boolean);
  if (!script) return { lookups: (
    /** @type {Lookup[]} */
    []
  ), features: (
    /** @type {string[]} */
    []
  ) };
  const feats = script.defaultLang.map((i) => t.features[i]).filter((f) => f && enabled.has(f.tag));
  const idx = [...new Set(feats.flatMap((f) => f.lookups))].sort((a, b) => a - b);
  return { lookups: idx.map((i) => t.lookups[i]).filter(Boolean), features: [...new Set(feats.map((f) => f.tag))] };
}

// shape/src/shape.js
var SYNTH_MARK = /^\p{Mn}$/u;
var DEFAULT_IGNORABLE = /^\p{Default_Ignorable_Code_Point}$/u;
var UNICODE_MARK = /^\p{M}$/u;
var PICTOGRAPHIC = /^\p{Extended_Pictographic}$/u;
var isRI = (cp) => cp >= 127462 && cp <= 127487;
function combiningClass(cp) {
  let lo = 0, hi = CCC_RANGES.length / 3 - 1;
  while (lo <= hi) {
    const m = lo + hi >> 1, a = CCC_RANGES[3 * m], b = CCC_RANGES[3 * m + 1];
    if (cp < a) hi = m - 1;
    else if (cp > b) lo = m + 1;
    else return CCC_RANGES[3 * m + 2];
  }
  return 0;
}
function reorderMarks(buf, ccc) {
  for (let i = 0; i < buf.length; i++) {
    if (!ccc[i]) continue;
    let end = i + 1;
    while (end < buf.length && ccc[end]) end++;
    if (end - i <= 32) {
      for (let a = i + 1; a < end; a++) {
        let j = a;
        while (j > i && ccc[j - 1] > ccc[a]) j--;
        if (j === a) continue;
        const cl = Math.min(...buf.slice(j, a + 1).map((g) => g.cluster));
        for (let k = j; k <= a; k++) buf[k].cluster = cl;
        buf.splice(j, 0, ...buf.splice(a, 1));
        ccc.splice(j, 0, ...ccc.splice(a, 1));
      }
    }
    i = end - 1;
  }
}
function graphemeClusters(chars) {
  const cont = new Array(chars.length).fill(false);
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i], cp = (
      /** @type {number} */
      ch.codePointAt(0)
    );
    if (cp < 128) continue;
    if (UNICODE_MARK.test(ch) || cp >= 127995 && cp <= 127999 || cp >= 65438 && cp <= 65439 || cp >= 917536 && cp <= 917631) cont[i] = true;
    else if (i && isRI(cp)) {
      if (isRI(
        /** @type {number} */
        chars[i - 1].codePointAt(0)
      ) && !cont[i - 1]) cont[i] = true;
    } else if (cp === 8205) {
      cont[i] = true;
      if (i + 1 < chars.length && PICTOGRAPHIC.test(chars[i + 1])) cont[++i] = true;
    }
  }
  const out = new Array(chars.length);
  for (let i = 0, start = 0; i < chars.length; i++) {
    if (!cont[i]) start = i;
    out[i] = start;
  }
  return out;
}
var DEFAULT_GSUB = Object.freeze(/* @__PURE__ */ new Set(["rvrn", "ccmp", "locl", "rlig", "calt", "clig", "liga", "rclt"]));
var DEFAULT_GPOS = Object.freeze(/* @__PURE__ */ new Set(["kern", "mark", "mkmk", "curs", "dist", "abvm", "blwm"]));
var Skipped = variants("Skipped", { Lookup: ["table", "index", "type", "format"] });
function prepare(font, span = NOOP_SPAN) {
  const hit = prepared.get(font);
  if (hit) return hit;
  const gsubB = font.tables.get("GSUB"), gposB = font.tables.get("GPOS"), gdefB = font.tables.get("GDEF");
  const gsub = gsubB ? span.span("layout.parse.gsub", { bytes: gsubB.length }, (ps) => parseLayout(gsubB, "GSUB", ps)) : ok(null);
  const gpos = gposB ? span.span("layout.parse.gpos", { bytes: gposB.length }, (ps) => parseLayout(gposB, "GPOS", ps)) : ok(null);
  const gdef = gdefB ? span.span("layout.parse.gdef", { bytes: gdefB.length }, () => parseGdef(gdefB)) : ok(EMPTY_GDEF);
  const kernB = font.tables.get("kern");
  const kern = kernB ? span.span("layout.parse.kern", { bytes: kernB.length }, () => parseKern(kernB)) : ok(
    /** @type {import('./kern.js').Kerner[]} */
    []
  );
  const r = gsub.tag === "Err" ? gsub : gpos.tag === "Err" ? gpos : gdef.tag === "Err" ? gdef : kern.tag === "Err" ? kern : ok({ gsub: gsub.value, gpos: gpos.value, gdef: gdef.value, kern: kern.value });
  prepared.set(font, r);
  return r;
}
var prepared = /* @__PURE__ */ new WeakMap();
function shape(font, text, { gsubFeatures = DEFAULT_GSUB, gposFeatures = DEFAULT_GPOS, span = NOOP_SPAN } = {}) {
  return span.span("shape", { chars: text.length }, (s) => {
    const p = s.span("shape.prepare", (ps) => prepare(font, ps));
    if (p.tag === "Err") {
      s.fail(JSON.stringify(p.error));
      return err(p.error);
    }
    const { gsub, gpos, gdef, kern } = p.value;
    const buf = s.span("shape.cmap", { atomic: true, items: text.length }, () => ((chars) => {
      const cl = graphemeClusters(chars);
      return chars.map((ch, i) => ({
        gid: font.glyphOf(
          /** @type {number} */
          ch.codePointAt(0)
        ),
        cluster: cl[i],
        ax: 0,
        ay: 0,
        dx: 0,
        dy: 0,
        // Internal: synthesised glyph class (HarfBuzz hb_synthesize_glyph_classes: a mark iff the
        // character is general category Mn and not default-ignorable), used when GDEF has no
        // GlyphClassDef; and the GPOS attachment chain (relative index) and type, 1 mark, 2 cursive.
        k: SYNTH_MARK.test(ch) && !DEFAULT_IGNORABLE.test(ch) ? 3 : 1,
        chain: 0,
        atype: 0
      }));
    })([...text]));
    s.span("shape.reorder", { atomic: true, items: buf.length }, () => reorderMarks(buf, [...text].map((ch) => combiningClass(
      /** @type {number} */
      ch.codePointAt(0)
    ))));
    const skipped = [];
    const scripts = ["latn", "DFLT", "dflt"];
    if (gsub) s.span("shape.gsub", (gs) => {
      const { sel, ctx } = gs.span("gsub.select", () => ({ sel: selectLookups(gsub, scripts, gsubFeatures), ctx: context(gsub, gdef, buf, "GSUB", skipped) }));
      gs.set("features", sel.features);
      gs.set("lookups", sel.lookups.length);
      for (const l of sel.lookups) traceLookup(gs, ctx, l);
    });
    s.span("shape.advances", { atomic: true, items: buf.length }, () => {
      for (const g of buf) g.ax = font.advance(g.gid);
    });
    for (const g of buf) {
      g.chain = 0;
      g.atype = 0;
    }
    const klassAt = (i) => gdef.hasClasses ? gdef.glyphClass(buf[i].gid) : buf[i].k;
    if (gpos) s.span("shape.gpos", (gs) => {
      const { sel, ctx } = gs.span("gpos.select", () => ({ sel: selectLookups(gpos, scripts, gposFeatures), ctx: context(gpos, gdef, buf, "GPOS", skipped) }));
      gs.set("features", sel.features);
      gs.set("lookups", sel.lookups.length);
      for (const l of sel.lookups) traceLookup(gs, ctx, l);
    });
    if (kern.length && gposFeatures.has("kern") && !(gpos && gpos.features.some((f) => f.tag === "kern"))) {
      s.span("shape.kern", { atomic: true, items: buf.length }, () => applyKern(kern, buf, (i) => klassAt(i) === 3));
    }
    s.span("shape.finish", { atomic: true, items: buf.length }, () => finishPositions(buf, klassAt, !!(gpos && gpos.lookups.length)));
    if (skipped.length) s.set("skippedSubtables", skipped.length);
    s.set("glyphs", buf.length);
    return ok(buf.map((g) => ({ gid: g.gid, cluster: g.cluster, ax: g.ax, ay: g.ay, dx: g.dx, dy: g.dy })));
  });
}
var SHAPE_LIMITS = Object.freeze({ opsPerGlyph: 64, minOps: 16384, growth: 32, minLen: 8192, nesting: 8 });
function context(t, gdef, buf, table, skipped) {
  const covCache = /* @__PURE__ */ new Map();
  const clsCache = /* @__PURE__ */ new Map();
  const L = SHAPE_LIMITS;
  return {
    v: t.v,
    lookups: t.lookups,
    gdef,
    buf,
    table,
    skipped,
    ops: Math.max(L.minOps, L.opsPerGlyph * buf.length),
    maxLen: Math.max(L.minLen, L.growth * buf.length),
    depth: 0,
    /** Why shaping stopped early ('' = it did not): a budget, as a value. */
    stopped: "",
    /** Glyph class at buffer position i: GDEF's when it has classes, else the synthesised one. */
    klass: (i) => gdef.hasClasses ? gdef.glyphClass(buf[i].gid) : buf[i].k,
    cov: (o) => {
      let c = covCache.get(o);
      if (!c) covCache.set(o, c = coverageView(t.v, o));
      return c;
    },
    cls: (o) => {
      let c = clsCache.get(o);
      if (!c) clsCache.set(o, c = classView(t.v, o));
      return c;
    }
  };
}
function ignored(c, l, i) {
  const gid = c.buf[i].gid, k = c.klass(i);
  if (l.flag & 2 && k === 1) return true;
  if (l.flag & 4 && k === 2) return true;
  if (l.flag & 8 && k === 3) return true;
  if (k === 3) {
    if (l.flag & 16) {
      const ms = c.gdef.markSets;
      return !(l.markSet < ms.length && ms[l.markSet].has(gid));
    }
    const t = l.flag >> 8;
    if (t && c.gdef.markAttachClass(gid) !== t) return true;
  }
  return false;
}
var next = (c, l, i) => {
  for (let j = i + 1; j < c.buf.length; j++) if (!ignored(c, l, j)) return j;
  return -1;
};
var prev = (c, l, i) => {
  for (let j = i - 1; j >= 0; j--) if (!ignored(c, l, j)) return j;
  return -1;
};
function traceLookup(span, c, l) {
  if (c.stopped) return;
  span.span(`${c.table.toLowerCase()}.lookup`, { atomic: true, index: l.index, type: l.type, subtables: l.subtables.length, items: c.buf.length }, (ls) => {
    const before = c.buf.map((g) => ({ ...g }));
    const r = guard(() => runLookup(c, l), (f) => f);
    if (r.tag === "Err") {
      c.buf.length = 0;
      for (const g of before) c.buf.push(g);
      c.skipped.push(Skipped.Lookup(c.table, l.index, l.type, "malformed"));
      ls.set("malformed", true);
      return;
    }
    if (c.stopped) {
      c.skipped.push(Skipped.Lookup(c.table, l.index, l.type, `budget: ${c.stopped}`));
      ls.set("budget", c.stopped);
    }
    if (ls.recording) ls.set("applied", r.value);
  });
}
function runLookup(c, l) {
  let applied = 0;
  if (c.table === "GSUB" && l.type === 8) {
    for (let i2 = c.buf.length - 1; i2 >= 0 && !c.stopped; i2--) if (!ignored(c, l, i2) && applyAt(c, l, i2) !== -1) applied++;
    return applied;
  }
  let i = 0;
  while (i < c.buf.length && !c.stopped) {
    if (ignored(c, l, i)) {
      i++;
      continue;
    }
    const r = applyAt(c, l, i);
    if (r >= 0) applied++;
    i = r < 0 ? i + 1 : r;
  }
  return applied;
}
function applyAt(c, l, i) {
  if (--c.ops < 0) {
    c.stopped = "operations";
    return -1;
  }
  if (c.buf.length > c.maxLen) {
    c.stopped = "buffer length";
    return -1;
  }
  for (const off of l.subtables) {
    const r = c.table === "GSUB" ? gsubSubtable(c, l, off, i) : gposSubtable(c, l, off, i);
    if (r >= 0) return r;
  }
  return -1;
}
var skip = (c, l, off) => {
  c.skipped.push(Skipped.Lookup(c.table, l.index, l.type, u16(c.v, off)));
  return -1;
};
function gsubSubtable(c, l, off, i) {
  const { v, buf } = c;
  const fmt = u16(v, off);
  const g = buf[i].gid;
  switch (l.type) {
    case 1: {
      const ci = c.cov(off + u16(v, off + 2)).get(g);
      if (ci < 0) return -1;
      buf[i].gid = fmt === 1 ? g + i16(v, off + 4) & 65535 : u16(v, off + 6 + ci * 2);
      return i + 1;
    }
    case 2:
    case 3: {
      const ci = c.cov(off + u16(v, off + 2)).get(g);
      if (ci < 0) return -1;
      const seq = off + u16(v, off + 6 + ci * 2);
      const n = u16(v, seq);
      const gids = times(n, (k) => u16(v, seq + 2 + k * 2));
      if (l.type === 3) {
        if (n) buf[i].gid = gids[0];
        return i + 1;
      }
      buf.splice(i, 1, ...gids.map((gid) => ({ ...buf[i], gid })));
      return i + n;
    }
    case 4: {
      const ci = c.cov(off + u16(v, off + 2)).get(g);
      if (ci < 0) return -1;
      const set = off + u16(v, off + 6 + ci * 2);
      for (let k = 0, n = u16(v, set); k < n; k++) {
        const lig = set + u16(v, set + 2 + k * 2);
        const ligGlyph = u16(v, lig), comps = u16(v, lig + 2);
        const pos = [i];
        for (let m = 1; m < comps; m++) {
          const j = next(c, l, pos[pos.length - 1]);
          if (j < 0 || buf[j].gid !== u16(v, lig + 4 + (m - 1) * 2)) break;
          pos.push(j);
        }
        if (pos.length !== comps) continue;
        const cluster = Math.min(...buf.slice(i, pos[pos.length - 1] + 1).map((x) => x.cluster));
        for (let k2 = i; k2 <= pos[pos.length - 1]; k2++) buf[k2].cluster = cluster;
        buf[i].gid = ligGlyph;
        buf[i].k = 2;
        for (const j of pos.slice(1).reverse()) buf.splice(j, 1);
        return i + 1;
      }
      return -1;
    }
    case 5:
    case 6:
      return contextual(c, l, off, i, l.type === 6);
    case 8: {
      const ci = c.cov(off + u16(v, off + 2)).get(g);
      if (ci < 0) return -1;
      const nb = u16(v, off + 4);
      const back = times(nb, (k) => off + u16(v, off + 6 + k * 2));
      const la = off + 6 + nb * 2;
      const nl = u16(v, la);
      const ahead = times(nl, (k) => off + u16(v, la + 2 + k * 2));
      if (!matchCoverages(c, l, i, back, -1) || !matchCoverages(c, l, i, ahead, 1)) return -1;
      buf[i].gid = u16(v, la + 2 + nl * 2 + 2 + ci * 2);
      return i - 1;
    }
    default:
      return skip(c, l, off);
  }
}
function valueRecord(c, o, fmt) {
  const r = { dx: 0, dy: 0, ax: 0, ay: 0 };
  let p = o;
  if (fmt & 1) {
    r.dx = i16(c.v, p);
    p += 2;
  }
  if (fmt & 2) {
    r.dy = i16(c.v, p);
    p += 2;
  }
  if (fmt & 4) {
    r.ax = i16(c.v, p);
    p += 2;
  }
  if (fmt & 8) {
    r.ay = i16(c.v, p);
    p += 2;
  }
  for (const bit of [16, 32, 64, 128]) if (fmt & bit) p += 2;
  return (
    /** @type {const} */
    [r, p - o]
  );
}
var vrSize = (fmt) => {
  let n = 0;
  for (let b = fmt & 255; b; b >>= 1) n += b & 1;
  return n * 2;
};
var addValue = (g, r) => {
  g.dx += r.dx;
  g.dy += r.dy;
  g.ax += r.ax;
  g.ay += r.ay;
};
function gposSubtable(c, l, off, i) {
  const { v, buf } = c;
  const fmt = u16(v, off);
  const g = buf[i].gid;
  switch (l.type) {
    case 1: {
      const ci = c.cov(off + u16(v, off + 2)).get(g);
      if (ci < 0) return -1;
      const vf = u16(v, off + 4);
      const at = fmt === 1 ? off + 6 : off + 8 + ci * vrSize(vf);
      addValue(buf[i], valueRecord(c, at, vf)[0]);
      return i + 1;
    }
    case 2: {
      const ci = c.cov(off + u16(v, off + 2)).get(g);
      if (ci < 0) return -1;
      const j = next(c, l, i);
      if (j < 0) return -1;
      const vf1 = u16(v, off + 4), vf2 = u16(v, off + 6);
      const s1 = vrSize(vf1), s2 = vrSize(vf2);
      let rec = -1;
      if (fmt === 1) {
        const set = off + u16(v, off + 10 + ci * 2);
        const n = u16(v, set), stride = 2 + s1 + s2;
        let lo = 0, hi = n - 1;
        while (lo <= hi) {
          const m = lo + hi >> 1, second = u16(v, set + 2 + m * stride);
          if (second === buf[j].gid) {
            rec = set + 2 + m * stride + 2;
            break;
          }
          if (second < buf[j].gid) lo = m + 1;
          else hi = m - 1;
        }
      } else if (fmt === 2) {
        const k1 = c.cls(off + u16(v, off + 8))(g), k2 = c.cls(off + u16(v, off + 10))(buf[j].gid);
        const n1 = u16(v, off + 12), n2 = u16(v, off + 14);
        if (k1 < n1 && k2 < n2) rec = off + 16 + (k1 * n2 + k2) * (s1 + s2);
      } else return skip(c, l, off);
      if (rec < 0) return -1;
      addValue(buf[i], valueRecord(c, rec, vf1)[0]);
      addValue(buf[j], valueRecord(c, rec + s1, vf2)[0]);
      return vf2 ? j + 1 : j;
    }
    case 3:
      return cursive(c, l, off, i);
    case 4:
    case 5:
    case 6:
      return markAttach(c, l, off, i);
    case 7:
    case 8:
      return contextual(c, l, off, i, l.type === 8);
    default:
      return skip(c, l, off);
  }
}
var anchor = (c, at) => at ? [i16(c.v, at + 2), i16(c.v, at + 4)] : null;
var prevNonMark = (c, i) => {
  for (let j = i - 1; j >= 0; j--) if (c.klass(j) !== 3) return j;
  return -1;
};
function markAttach(c, l, off, i) {
  const { v, buf } = c;
  if (u16(v, off) !== 1) return skip(c, l, off);
  const mi = c.cov(off + u16(v, off + 2)).get(buf[i].gid);
  if (mi < 0) return -1;
  const classCount = u16(v, off + 6), markArray = off + u16(v, off + 8), baseArrayOff = off + u16(v, off + 10);
  let j = -1, row = 0;
  if (l.type === 4 || l.type === 5) {
    j = prevNonMark(c, i);
    if (j < 0) return -1;
    const bi = c.cov(off + u16(v, off + 4)).get(buf[j].gid);
    if (bi < 0) return -1;
    if (l.type === 4) row = baseArrayOff + 2 + bi * classCount * 2;
    else {
      const attach = baseArrayOff + u16(v, baseArrayOff + 2 + bi * 2), comps = u16(v, attach);
      if (!comps) return -1;
      row = attach + 2 + (comps - 1) * classCount * 2;
      return attachMark(c, markArray, mi, attach, row, classCount, i, j);
    }
    return attachMark(c, markArray, mi, baseArrayOff, row, classCount, i, j);
  }
  const flags = { ...l, flag: l.flag & ~14 };
  j = prev(c, flags, i);
  if (j < 0 || c.klass(j) !== 3) return -1;
  const m2 = c.cov(off + u16(v, off + 4)).get(buf[j].gid);
  if (m2 < 0) return -1;
  return attachMark(c, markArray, mi, baseArrayOff, baseArrayOff + 2 + m2 * classCount * 2, classCount, i, j);
}
function attachMark(c, markArray, mi, base, row, classCount, i, j) {
  const { v, buf } = c;
  const rec = markArray + 2 + mi * 4, klass = u16(v, rec);
  if (klass >= classCount) return -1;
  const markOff = u16(v, rec + 2);
  const markA = anchor(c, markOff ? markArray + markOff : 0);
  const baseOff = u16(v, row + klass * 2);
  const baseA = anchor(c, baseOff ? base + baseOff : 0);
  if (!markA || !baseA) return -1;
  let cross = buf[j].dy;
  for (let k = j, n = 0; buf[k].atype === 2 && buf[k].chain && n < 64; n++) {
    k += buf[k].chain;
    if (k < 0 || k >= buf.length) break;
    cross += buf[k].dy;
  }
  const g = buf[i];
  g.chain = j - i;
  g.atype = 1;
  g.dx = Math.round(baseA[0] - markA[0]);
  g.dy = Math.round(baseA[1] - markA[1]) + cross;
  return i + 1;
}
function cursive(c, l, off, i) {
  const { v, buf } = c;
  if (u16(v, off) !== 1) return skip(c, l, off);
  const cov = c.cov(off + u16(v, off + 2));
  const ci = cov.get(buf[i].gid);
  if (ci < 0) return -1;
  const entryOff = u16(v, off + 6 + ci * 4);
  if (!entryOff) return -1;
  const p = prev(c, l, i);
  if (p < 0) return -1;
  const pi = cov.get(buf[p].gid);
  if (pi < 0) return -1;
  const exitOff = u16(v, off + 6 + pi * 4 + 2);
  if (!exitOff) return -1;
  const exit = (
    /** @type {number[]} */
    anchor(c, off + exitOff)
  ), entry = (
    /** @type {number[]} */
    anchor(c, off + entryOff)
  );
  buf[p].ax = Math.round(exit[0]) + buf[p].dx;
  const d = Math.round(entry[0]) + buf[i].dx;
  buf[i].ax -= d;
  buf[i].dx -= d;
  let child = p, parent = i, y = Math.round(entry[1] - exit[1]);
  if (!(l.flag & 1)) {
    child = i;
    parent = p;
    y = -y;
  }
  reverseCursive(buf, child, parent, 0);
  buf[child].chain = parent - child;
  buf[child].atype = 2;
  buf[child].dy = y;
  if (buf[parent].chain === -buf[child].chain) {
    buf[parent].chain = 0;
    buf[parent].dy = 0;
  }
  return i + 1;
}
function reverseCursive(buf, i, newParent, depth) {
  if (depth > 64) return;
  const chain = buf[i].chain, type = buf[i].atype;
  if (!chain || type !== 2) return;
  buf[i].chain = 0;
  const j = i + chain;
  if (j < 0 || j >= buf.length || j === newParent) return;
  reverseCursive(buf, j, newParent, depth + 1);
  buf[j].dy = -buf[i].dy;
  buf[j].chain = -chain;
  buf[j].atype = type;
}
function finishPositions(buf, klass, hadGpos) {
  for (let i = 0; i < buf.length; i++) if (klass(i) === 3) {
    if (!hadGpos) {
      buf[i].dx -= buf[i].ax;
      buf[i].dy -= buf[i].ay;
    }
    buf[i].ax = 0;
    buf[i].ay = 0;
  }
  for (let i = 0; i < buf.length; i++) if (buf[i].chain) propagate(buf, i, 64);
}
function propagate(buf, i, nesting) {
  const chain = buf[i].chain, type = buf[i].atype;
  buf[i].chain = 0;
  const j = i + chain;
  if (j < 0 || j >= buf.length || !nesting) return;
  if (buf[j].chain) propagate(buf, j, nesting - 1);
  if (type === 2) {
    buf[i].dy += buf[j].dy;
    return;
  }
  buf[i].dx += buf[j].dx;
  if (j < i) for (let k = j; k < i; k++) {
    buf[i].dx -= buf[k].ax;
    buf[i].dy -= buf[k].ay;
  }
  else for (let k = i; k < j; k++) {
    buf[i].dx += buf[k].ax;
    buf[i].dy += buf[k].ay;
  }
}
function matchCoverages(c, l, i, covs, dir) {
  let j = i;
  for (const o of covs) {
    j = dir > 0 ? next(c, l, j) : prev(c, l, j);
    if (j < 0 || !c.cov(o).has(c.buf[j].gid)) return null;
  }
  return j;
}
function matchSeq(c, l, i, n, test, dir) {
  const pos = [];
  let j = i;
  for (let k = 0; k < n; k++) {
    j = dir > 0 ? next(c, l, j) : prev(c, l, j);
    if (j < 0 || !test(k, c.buf[j].gid)) return null;
    pos.push(j);
  }
  return pos;
}
function contextual(c, l, off, i, chained) {
  const { v, buf } = c;
  const fmt = u16(v, off);
  const g = buf[i].gid;
  if (fmt === 1 || fmt === 2) {
    if (c.cov(off + u16(v, off + 2)).get(g) < 0) return -1;
    const id = (x) => x;
    const [setsAt, bk, inp, la] = fmt === 1 ? [off + 6, id, id, id] : chained ? [off + 12, c.cls(off + u16(v, off + 4)), c.cls(off + u16(v, off + 6)), c.cls(off + u16(v, off + 8))] : [off + 8, id, c.cls(off + u16(v, off + 4)), id];
    const key = fmt === 1 ? c.cov(off + u16(v, off + 2)).get(g) : inp(g);
    if (key >= u16(v, setsAt - 2)) return -1;
    const setOff = u16(v, setsAt + key * 2);
    if (!setOff) return -1;
    const set = off + setOff;
    const arr = (at, n) => times(n, (k) => u16(v, at + k * 2));
    const eq = (f, want) => (k, gid) => f(gid) === want[k];
    for (let r = 0, nr = u16(v, set); r < nr; r++) {
      let p = set + u16(v, set + 2 + r * 2);
      let back = (
        /** @type {number[]} */
        []
      ), ahead = (
        /** @type {number[]} */
        []
      ), nRec = 0;
      if (chained) {
        const nb = u16(v, p);
        back = arr(p + 2, nb);
        p += 2 + nb * 2;
      }
      const ni = u16(v, p);
      p += 2;
      if (!chained) {
        nRec = u16(v, p);
        p += 2;
      }
      const input = arr(p, ni - 1);
      p += (ni - 1) * 2;
      if (chained) {
        const na = u16(v, p);
        ahead = arr(p + 2, na);
        p += 2 + na * 2;
        nRec = u16(v, p);
        p += 2;
      }
      const inPos = matchSeq(c, l, i, input.length, eq(inp, input), 1);
      if (!inPos) continue;
      if (!matchSeq(c, l, i, back.length, eq(bk, back), -1)) continue;
      if (!matchSeq(c, l, inPos.length ? inPos[inPos.length - 1] : i, ahead.length, eq(la, ahead), 1)) continue;
      return applyRecords(c, l, [i, ...inPos], p, nRec);
    }
    return -1;
  }
  if (fmt === 3) {
    let p = off + 2;
    const nb = chained ? u16(v, p) : 0;
    if (chained) p += 2 + nb * 2;
    const ni = u16(v, p);
    const covAt = chained ? p + 2 : p + 4;
    if (ni === 0 || !c.cov(off + u16(v, covAt)).has(g)) return -1;
    const nLookPlain = chained ? 0 : u16(v, p + 2);
    const back = times(nb, (k) => off + u16(v, off + 4 + k * 2));
    const input = times(ni, (k) => off + u16(v, covAt + k * 2));
    p = covAt + ni * 2;
    let ahead = [];
    if (chained) {
      const na = u16(v, p);
      ahead = times(na, (k) => off + u16(v, p + 2 + k * 2));
      p += 2 + na * 2;
    }
    const inPos = matchSeq(c, l, i, ni - 1, (k, gid) => c.cov(input[k + 1]).has(gid), 1);
    if (!inPos) return -1;
    if (chained && matchCoverages(c, l, i, back, -1) === null) return -1;
    const last = inPos.length ? inPos[inPos.length - 1] : i;
    if (chained && matchCoverages(c, l, last, ahead, 1) === null) return -1;
    return chained ? applyRecords(c, l, [i, ...inPos], p + 2, u16(v, p)) : applyRecords(c, l, [i, ...inPos], p, nLookPlain);
  }
  return skip(c, l, off);
}
function applyRecords(c, l, pos, at, n) {
  pos = [...pos];
  let end = pos[pos.length - 1] + 1;
  for (let r = 0; r < n; r++) {
    const seq = u16(c.v, at + r * 4), li = u16(c.v, at + r * 4 + 2);
    const nested = c.lookups[li];
    if (!nested || seq >= pos.length) continue;
    if (c.depth >= SHAPE_LIMITS.nesting) continue;
    const before = c.buf.length;
    c.depth++;
    applyAt(c, nested, pos[seq]);
    c.depth--;
    const delta = c.buf.length - before;
    if (delta) {
      for (let k = seq + 1; k < pos.length; k++) pos[k] += delta;
      end += delta;
    }
  }
  void l;
  return end;
}

// math/src/layout.js
var MathLayoutError = variants("MathLayoutError", {
  MissingGlyph: ["cp", "at"],
  // the font maps no glyph for a character of the formula
  Outline: ["gid", "error"],
  // a glyph the formula needs has an outline error
  Shape: ["text", "at", "error"],
  TooBig: ["what", "limit"]
  // an assembly or the whole formula past its glyph budget
});
var LAYOUT_LIMITS = Object.freeze({ glyphs: 1 << 16, assemblyParts: 1024 });
var sup = (s) => ({ level: s.level < 2 ? 2 : 3, cramped: s.cramped });
var sub = (s) => ({ level: s.level < 2 ? 2 : 3, cramped: true });
var num = (s) => ({ level: Math.min(s.level + 1, 3), cramped: s.cramped });
var den = (s) => ({ level: Math.min(s.level + 1, 3), cramped: true });
var cramp = (s) => ({ level: s.level, cramped: true });
var SPACING = [
  /* Ord   */
  [0, 3, -4, -5, 0, 0, 0, -3],
  /* Op    */
  [3, 3, 0, -5, 0, 0, 0, -3],
  /* Bin   */
  [-4, -4, 0, 0, -4, 0, 0, -4],
  /* Rel   */
  [-5, -5, 0, 0, -5, 0, 0, -5],
  /* Open  */
  [0, 0, 0, 0, 0, 0, 0, 0],
  /* Close */
  [0, 3, -4, -5, 0, 0, 0, -3],
  /* Punct */
  [-3, -3, 0, -3, -3, -3, -3, -3],
  /* Inner */
  [-3, 3, -4, -5, -3, 0, -3, -3]
];
var CLASS_INDEX = (
  /** @type {Record<Cls, number>} */
  { ord: 0, op: 1, bin: 2, rel: 3, open: 4, close: 5, punct: 6, inner: 7 }
);
function inkBounds(p) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, cx = 0, cy = 0;
  const add2 = (x, y) => {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  };
  const ext = (c, at) => {
    const [p0, p1, p2, p3] = c, a = -p0 + 3 * p1 - 3 * p2 + p3, b = 2 * (p0 - 2 * p1 + p2), k = p1 - p0;
    if (Math.abs(a) < 1e-12) {
      if (Math.abs(b) > 1e-12) {
        const t = -k / b;
        if (t > 0 && t < 1) at(t);
      }
      return;
    }
    const disc = b * b - 4 * a * k;
    if (disc < 0) return;
    const r = Math.sqrt(disc);
    for (const t of [(-b + r) / (2 * a), (-b - r) / (2 * a)]) if (t > 0 && t < 1) at(t);
  };
  for (const s of p) {
    Seg.match(s, {
      MoveTo: ({ x, y }) => {
        add2(x, y);
        cx = x;
        cy = y;
      },
      LineTo: ({ x, y }) => {
        add2(x, y);
        cx = x;
        cy = y;
      },
      QuadTo: ({ x1: qx, y1: qy, x, y }) => {
        const c = [cx, cx + 2 / 3 * (qx - cx), x + 2 / 3 * (qx - x), x], d = [cy, cy + 2 / 3 * (qy - cy), y + 2 / 3 * (qy - y), y];
        const pt = (t) => add2(bez(c, t), bez(d, t));
        ext(c, pt);
        ext(d, pt);
        add2(x, y);
        cx = x;
        cy = y;
      },
      CubicTo: ({ x1: ax, y1: ay, x2: bx, y2: by, x, y }) => {
        const c = [cx, ax, bx, x], d = [cy, ay, by, y];
        const pt = (t) => add2(bez(c, t), bez(d, t));
        ext(c, pt);
        ext(d, pt);
        add2(x, y);
        cx = x;
        cy = y;
      },
      Close: () => {
      }
    });
  }
  return x0 === Infinity ? null : (
    /** @type {[number, number, number, number]} */
    [x0, y0, x1, y1]
  );
}
var bez = (c, t) => {
  const u = 1 - t;
  return u * u * u * c[0] + 3 * u * u * t * c[1] + 3 * u * t * t * c[2] + t * t * t * c[3];
};
function layoutMath(font, math, ast, { display = false, limits = LAYOUT_LIMITS } = {}) {
  const C = math.constants;
  const c = (n, s) => C[n] * kOf(s);
  const kOf = (s) => s.level < 2 ? 1 : s.level === 2 ? C.ScriptPercentScaleDown / 100 : C.ScriptScriptPercentScaleDown / 100;
  const em = (s) => font.unitsPerEm * kOf(s);
  let fault = null;
  let glyphCount = 0;
  const fail = (e) => {
    if (!fault) fault = e;
    return empty();
  };
  const tokens = [];
  const metrics = /* @__PURE__ */ new Map();
  const glyphMetrics = (gid) => {
    let m = metrics.get(gid);
    if (!m) {
      const p = font.path(gid);
      if (p.tag === "Err") {
        fail(MathLayoutError.Outline(gid, p.error));
        m = { adv: 0, bb: null };
      } else m = { adv: font.advance(gid), bb: inkBounds(p.value) };
      metrics.set(gid, m);
    }
    return m;
  };
  const empty = () => ({ w: 0, h: 0, d: 0, ic: 0, ta: NaN, op: false, large: false, gid: -1, k: 1, ink: [] });
  const glyphBox = (gid, k) => {
    if (++glyphCount > limits.glyphs) return fail(MathLayoutError.TooBig("glyphs", limits.glyphs));
    const m = glyphMetrics(gid);
    const ta = math.topAccent.get(gid);
    return {
      w: m.adv * k,
      h: m.bb ? m.bb[3] * k : 0,
      d: m.bb ? -m.bb[1] * k : 0,
      ic: (math.italics.get(gid) ?? 0) * k,
      ta: ta === void 0 ? NaN : ta * k,
      op: false,
      large: false,
      gid,
      k,
      ink: [{ t: "g", gid, x: 0, y: 0, k }]
      // edge: Map.get miss
    };
  };
  const gidOf = (cp, at) => {
    const g = font.glyphOf(cp);
    if (!g) fail(MathLayoutError.MissingGlyph(cp, at));
    return g;
  };
  const compose = (m, kids) => ({ w: 0, h: 0, d: 0, ic: 0, ta: NaN, op: false, large: false, gid: -1, k: 1, ...m, ink: kids.map((q) => ({ t: (
    /** @type {const} */
    "b"
  ), ...q })) });
  const token = (kind, at, b) => {
    const tk = { kind, at, x: 0, w: b.w, top: b.h, bottom: -b.d, ic: b.op ? 0 : b.ic, lic: b.large ? b.ic : 0, k: b.k };
    tokens.push(tk);
    return (
      /** @type {Box & { tok?: Token }} */
      { ...b, tok: tk }
    );
  };
  const stretch = (gid, T, k, vertical) => {
    const con = (vertical ? math.vertical : math.horizontal).get(gid);
    const base = glyphBox(gid, k);
    if (!con) return base;
    if ((vertical ? base.h + base.d : base.w) >= T) return base;
    let last = base;
    for (const v of con.variants) {
      last = glyphBox(v.gid, k);
      if (v.advance * k >= T) return last;
    }
    const a = con.assembly;
    return a ? assembly(a, T, k, vertical) ?? last : last;
  };
  const assembly = (a, T, k, vertical) => {
    const omin = math.minConnectorOverlap * k;
    const parts = a.parts.map((p) => ({ gid: p.gid, start: p.start * k, end: p.end * k, full: p.full * k, ext: (p.flags & 1) === 1 }));
    const ext = parts.filter((p) => p.ext), non = parts.filter((p) => !p.ext);
    const sExt = ext.reduce((s, p) => s + p.full, 0), sNon = non.reduce((s, p) => s + p.full, 0);
    const sExtNon = sExt - omin * ext.length;
    if (!ext.length || !(sExtNon > 0) || parts.some((p, i) => i > 0 && p.start < omin - 1e-9 || i < parts.length - 1 && p.end < omin - 1e-9)) return null;
    const r = Math.max(0, Math.ceil((T - sNon + omin * (non.length - 1)) / sExtNon));
    const count = non.length + r * ext.length;
    if (count > limits.assemblyParts) return null;
    const size0 = sNon + r * sExt;
    let o = count > 1 ? (size0 - T) / (count - 1) : 0;
    parts.forEach((p, i) => {
      if (i > 0 || p.ext) o = Math.min(o, p.start);
      if (i < parts.length - 1 || p.ext) o = Math.min(o, p.end);
    });
    o = Math.max(o, omin);
    const kids = [];
    let pos = 0, w = 0, h = 0, d = 0;
    for (const p of parts) {
      for (let n = p.ext ? r : 1; n > 0; n--) {
        const g = glyphBox(p.gid, k);
        kids.push(vertical ? { box: g, x: 0, y: pos } : { box: g, x: pos, y: 0 });
        pos += p.full - o;
        if (vertical) w = Math.max(w, g.w);
        else {
          h = Math.max(h, g.h);
          d = Math.max(d, g.d);
        }
      }
    }
    const size = pos + o;
    return compose(vertical ? { w, h: size, d: 0, ic: a.italic * k } : { w: size, h, d, ic: a.italic * k }, kids);
  };
  const stretchV = (gid, Ua, Ud, s, symmetric) => {
    const axis = c("AxisHeight", s);
    let Ta = Ua, Td = Ud;
    if (symmetric) {
      const m = Math.max(Ua - axis, Ud + axis);
      Ta = m + axis;
      Td = m - axis;
    }
    const g = stretch(gid, Ta + Td, kOf(s), true);
    const delta = (g.h - g.d - (Ta - Td)) / 2;
    return compose({ w: g.w, h: g.h - delta, d: g.d + delta, ic: g.ic, op: true, gid: g.ink.length === 1 ? g.gid : -1, k: g.k }, [{ box: g, x: 0, y: -delta }]);
  };
  const clsOf2 = (n) => {
    switch (n.kind) {
      case "sym":
      case "big":
      case "class":
      case "stack":
        return n.cls;
      case "scripts":
        return clsOf2(n.base);
      case "bigop":
      case "opname":
      case "brace":
        return "op";
      case "frac":
      case "fenced":
        return "inner";
      case "matrix":
        return n.open || n.close ? "inner" : "ord";
      default:
        return "ord";
    }
  };
  const textBox = (text, at, s) => {
    const r = shape(font, text);
    if (r.tag === "Err") return fail(MathLayoutError.Shape(text, at, r.error));
    const k = kOf(s);
    const kids = [];
    let pen = 0, h = 0, d = 0;
    for (const g of r.value) {
      if (g.gid === 0) return fail(MathLayoutError.MissingGlyph(text.codePointAt(Math.min(g.cluster, text.length - 1)) ?? 0, at));
      const b = glyphBox(g.gid, k);
      if (b.ink.length && glyphMetrics(g.gid).bb) {
        kids.push({ box: b, x: pen + g.dx * k, y: g.dy * k });
        h = Math.max(h, b.h + g.dy * k);
        d = Math.max(d, b.d - g.dy * k);
      }
      pen += g.ax * k;
    }
    return compose({ w: pen, h, d }, kids);
  };
  const node = (n, s) => {
    switch (n.kind) {
      case "sym": {
        const b = glyphBox(gidOf(n.cp, n.at), kOf(s));
        return token(n.cls !== "ord" ? "mo" : n.cp >= 48 && n.cp <= 57 ? "mn" : "mi", n.at, { ...b, op: n.cls !== "ord" });
      }
      case "row":
        return row(n.items, s);
      case "text":
        return token("mtext", n.at, textBox(n.text, n.at, s));
      case "space":
        return { ...empty(), w: n.mu / 18 * em(s) };
      case "style":
        return empty();
      case "class": {
        const b = node(n.body, s);
        return { ...b, op: n.cls !== "ord" };
      }
      case "opname":
        return token("mo", n.at, { ...textBox(n.name, n.at, s), op: true, large: true });
      case "bigop": {
        const gid = gidOf(n.cp, n.at), k = kOf(s);
        const g = s.level === 0 ? stretch(gid, C.DisplayOperatorMinHeight * k, k, true) : glyphBox(gid, k);
        const delta = (g.h - g.d - 2 * c("AxisHeight", s)) / 2;
        return token("mo", n.at, compose({ w: g.w, h: g.h - delta, d: g.d + delta, ic: g.ic, op: true, large: true, gid: g.gid, k }, [{ box: g, x: 0, y: -delta }]));
      }
      case "big": {
        if (!n.cp) return { ...empty(), w: 0.12 * font.unitsPerEm };
        return token("mo", n.at, stretchV(gidOf(n.cp, n.at), n.em * font.unitsPerEm, 0, s, true));
      }
      case "scripts":
        return scripts(n, s);
      case "frac":
        return frac(n, s);
      case "sqrt":
        return radical(n, s);
      case "fenced":
        return fenced(n, s);
      case "accent":
        return accent(n, s);
      case "line":
        return line(n, s);
      case "brace":
        return brace(n, s);
      case "stack":
        return stack(n, s);
      case "matrix":
        return matrix(n, s);
    }
  };
  const row = (items, s0) => {
    let s = s0;
    const atoms = [];
    for (const it of items) {
      if (it.kind === "style") {
        s = { level: { D: 0, T: 1, S: 2, SS: 3 }[it.style], cramped: s.cramped };
        continue;
      }
      atoms.push({ box: node(it, s), cls: it.kind === "space" ? "" : clsOf2(it), s });
    }
    return joinAtoms(atoms);
  };
  const joinAtoms = (atoms) => {
    let prev2 = -1;
    for (let i = 0; i < atoms.length; i++) {
      const a = atoms[i];
      if (!a.cls) continue;
      const p = prev2 >= 0 ? atoms[prev2].cls : "open";
      if (a.cls === "bin" && (p === "bin" || p === "op" || p === "rel" || p === "open" || p === "punct" || p === "middle")) a.cls = "ord";
      if ((a.cls === "rel" || a.cls === "close" || a.cls === "punct" || a.cls === "middle") && prev2 >= 0 && atoms[prev2].cls === "bin") atoms[prev2].cls = "ord";
      prev2 = i;
    }
    if (prev2 >= 0 && atoms[prev2].cls === "bin") atoms[prev2].cls = "ord";
    const kids = [];
    let x = 0, h = -Infinity, d = -Infinity, pic = 0, last = "";
    for (const a of atoms) {
      const b = a.box;
      if (a.cls) {
        if (last) {
          const l = last === "middle" ? "open" : last, r = a.cls === "middle" ? "close" : a.cls;
          const mu = SPACING[CLASS_INDEX[
            /** @type {Cls} */
            l
          ]][CLASS_INDEX[
            /** @type {Cls} */
            r
          ]];
          if (mu > 0 || mu < 0 && a.s.level < 2) x += Math.abs(mu) / 18 * em(a.s);
        }
        last = a.cls;
      }
      const slanted = !b.op && b.ic !== 0;
      if (!slanted) x += pic;
      kids.push({ box: b, x, y: 0 });
      x += b.w;
      pic = slanted ? b.ic : 0;
      if (b.ink.length || b.w) {
        h = Math.max(h, b.h);
        d = Math.max(d, b.d);
      }
    }
    const one = atoms.length === 1 ? atoms[0].box : null;
    return compose({ w: x, h: h === -Infinity ? 0 : h, d: d === -Infinity ? 0 : d, ic: pic, op: one ? one.op : false, large: one ? one.large : false, gid: one ? one.gid : -1, k: one ? one.k : 1, ta: one ? one.ta : NaN }, kids);
  };
  const kernAt = (mk, y) => {
    if (!mk) return 0;
    let i = 0;
    while (i < mk.heights.length && y >= mk.heights[i]) i++;
    return mk.kerns[i] ?? 0;
  };
  const cutIn = (b, scr, top, shift) => {
    const bk = b.gid >= 0 ? math.kerns.get(b.gid) : null, sk = scr.gid >= 0 ? math.kerns.get(scr.gid) : null;
    if (!bk && !sk) return 0;
    const yb = top ? shift - scr.d : -shift + scr.h;
    const ys = top ? b.h - shift : -b.d + shift;
    return (bk ? kernAt(top ? bk.TopRight : bk.BottomRight, yb / b.k) * b.k : 0) + (sk ? kernAt(top ? sk.BottomLeft : sk.TopLeft, ys / scr.k) * scr.k : 0);
  };
  const scripts = (n, s) => {
    const b = node(n.base, s);
    const bk = n.base.kind === "row" && n.base.items.length === 1 ? n.base.items[0] : n.base;
    const lim = bk.kind === "brace" || (bk.kind === "bigop" || bk.kind === "opname") && (bk.limits === "limits" || bk.limits === "auto" && s.level === 0);
    const under = n.sub ? node(n.sub, sub(s)) : null, over = n.sup ? node(n.sup, sup(s)) : null;
    if (lim) return limitsBox(b, over, under, s);
    const largeIc = b.large ? b.ic : 0, ic = b.large ? 0 : b.ic;
    let subShift = 0, supShift = 0;
    if (under) subShift = Math.max(c("SubscriptShiftDown", s), under.h - c("SubscriptTopMax", s), c("SubscriptBaselineDropMin", s) + b.d);
    if (over) supShift = Math.max(c(s.cramped ? "SuperscriptShiftUpCramped" : "SuperscriptShiftUp", s), c("SuperscriptBottomMin", s) + over.d, b.h - c("SuperscriptBaselineDropMax", s));
    if (under && over) {
      const gap = subShift - under.h + (supShift - over.d), min = c("SubSuperscriptGapMin", s);
      if (gap < min) {
        let delta = c("SuperscriptBottomMaxWithSubscript", s) - (supShift - over.d);
        if (delta > 0) {
          delta = Math.min(delta, min - gap);
          supShift += delta;
        }
        const gap2 = subShift - under.h + (supShift - over.d);
        if (min - gap2 > 0) subShift += min - gap2;
      }
    }
    const kids = [{ box: b, x: 0, y: 0 }];
    let w = b.w, h = b.h, d = b.d;
    if (under) {
      const x = b.w - largeIc + cutIn(b, under, false, subShift);
      kids.push({ box: under, x, y: -subShift });
      w = Math.max(w, x + under.w);
      h = Math.max(h, under.h - subShift);
      d = Math.max(d, under.d + subShift);
    }
    if (over) {
      const x = b.w + ic + cutIn(b, over, true, supShift);
      kids.push({ box: over, x, y: supShift });
      w = Math.max(w, x + over.w);
      h = Math.max(h, over.h + supShift);
      d = Math.max(d, over.d - supShift);
    }
    return compose({ w: w + c("SpaceAfterScript", s), h, d, op: b.op }, kids);
  };
  const limitsBox = (b, over, under, s) => {
    const largeIc = b.large ? b.ic : 0;
    const kids = [];
    const cs = [{ box: b, dx: 0 }, ...over ? [{ box: over, dx: largeIc / 2 }] : [], ...under ? [{ box: under, dx: -largeIc / 2 }] : []];
    const lo = Math.min(...cs.map((q) => q.dx - q.box.w / 2)), hi = Math.max(...cs.map((q) => q.dx + q.box.w / 2));
    let h = b.h, d = b.d;
    kids.push({ box: b, x: -lo - b.w / 2, y: 0 });
    if (over) {
      const shift = b.large ? Math.max(c("UpperLimitBaselineRiseMin", s), c("UpperLimitGapMin", s) + over.d) : c("OverbarVerticalGap", s) + over.d;
      const y = b.h + shift;
      kids.push({ box: over, x: -lo - over.w / 2 + largeIc / 2, y });
      h = Math.max(h, y + over.h + (b.large ? 0 : c("OverbarExtraAscender", s)));
    }
    if (under) {
      const shift = b.large ? Math.max(c("LowerLimitBaselineDropMin", s), c("LowerLimitGapMin", s) + under.h) : c("UnderbarVerticalGap", s) + under.h;
      const y = -b.d - shift;
      kids.push({ box: under, x: -lo - under.w / 2 - largeIc / 2, y });
      d = Math.max(d, -y + under.d + (b.large ? 0 : c("UnderbarExtraDescender", s)));
    }
    return compose({ w: hi - lo, h, d, op: b.op }, kids);
  };
  const frac = (n, s) => {
    const fs = n.style === "D" ? { level: 0, cramped: s.cramped } : n.style === "T" ? { level: Math.max(1, s.level), cramped: s.cramped } : s;
    const disp = fs.level === 0, mark = tokens.length;
    const top = node(n.num, num(fs)), bot = node(n.den, den(fs));
    const w = Math.max(top.w, bot.w), axis = c("AxisHeight", fs);
    let up = 0, down = 0;
    const kids = [];
    if (n.bar) {
      const t = c("FractionRuleThickness", fs);
      up = Math.max(c(disp ? "FractionNumeratorDisplayStyleShiftUp" : "FractionNumeratorShiftUp", fs), axis + t / 2 + c(disp ? "FractionNumDisplayStyleGapMin" : "FractionNumeratorGapMin", fs) + top.d);
      down = Math.max(c(disp ? "FractionDenominatorDisplayStyleShiftDown" : "FractionDenominatorShiftDown", fs), t / 2 + c(disp ? "FractionDenomDisplayStyleGapMin" : "FractionDenominatorGapMin", fs) + bot.h - axis);
      kids.push({ box: rule(w, t), x: 0, y: axis - t / 2 });
    } else {
      up = c(disp ? "StackTopDisplayStyleShiftUp" : "StackTopShiftUp", fs);
      down = c(disp ? "StackBottomDisplayStyleShiftDown" : "StackBottomShiftDown", fs);
      const gap = down - bot.h + (up - top.d), min = c(disp ? "StackDisplayStyleGapMin" : "StackGapMin", fs);
      if (min - gap > 0) {
        up += (min - gap) / 2;
        down += min - gap - (min - gap) / 2;
      }
    }
    kids.push({ box: top, x: (w - top.w) / 2, y: up }, { box: bot, x: (w - bot.w) / 2, y: -down });
    const h = Math.max(up + top.h, -down + bot.h, n.bar ? axis + c("FractionRuleThickness", fs) / 2 : -Infinity);
    const d = Math.max(-up + top.d, down + bot.d, n.bar ? -axis + c("FractionRuleThickness", fs) / 2 : -Infinity);
    const core = compose({ w, h, d }, kids);
    if (n.open || n.close) return fencedBoxes(n.open, n.close, [core], fs, n.at, mark);
    const pad = 0.12 * font.unitsPerEm;
    return compose({ w: w + 2 * pad, h, d }, [{ box: core, x: pad, y: 0 }]);
  };
  const rule = (w, t) => ({ ...empty(), w, h: t, ink: [{ t: "r", x: 0, y: 0, w, h: t }] });
  const radical = (n, s) => {
    const base = node(n.body, cramp(s));
    const t = c("RadicalRuleThickness", s), gap = c(s.level === 0 ? "RadicalDisplayStyleVerticalGap" : "RadicalVerticalGap", s);
    const extra = c("RadicalExtraAscender", s);
    const surd = stretch(gidOf(8730, n.at), t + gap + base.h + base.d, kOf(s), true);
    const h = Math.max(base.h, base.h + gap + t + extra);
    const d = Math.max(base.d, surd.h + surd.d + extra - h);
    const barTop = h - extra;
    const B = compose({ w: surd.w + base.w, h, d }, [
      { box: surd, x: 0, y: barTop - surd.h },
      { box: rule(base.w, t), x: surd.w, y: barTop - t },
      { box: base, x: surd.w, y: 0 }
    ]);
    if (!n.index) return B;
    const idx = node(n.index, { level: 3, cramped: s.cramped });
    const before = Math.max(0, c("RadicalKernBeforeDegree", s)), after = Math.max(-idx.w, c("RadicalKernAfterDegree", s));
    const raise = C.RadicalDegreeBottomRaisePercent / 100 * (B.h + B.d);
    const iy = -B.d + raise + idx.d;
    return compose({ w: before + idx.w + after + B.w, h: Math.max(B.h, iy + idx.h), d: Math.max(B.d, idx.d - iy) }, [
      { box: idx, x: before, y: iy },
      { box: B, x: before + idx.w + after, y: 0 }
    ]);
  };
  const fencedBoxes = (open, close, parts, s, at, mark) => {
    let Ua = 0, Ud = 0;
    for (const p of parts) {
      Ua = Math.max(Ua, p.h);
      Ud = Math.max(Ud, p.d);
    }
    const del = (cp) => cp ? token("mo", at, stretchV(gidOf(cp, at), Ua, Ud, s, true)) : { ...empty(), w: 0.12 * font.unitsPerEm };
    const atoms = [{ box: del(open), cls: "open", s }];
    moveToken(atoms[0].box, mark);
    for (const p of parts) atoms.push({ box: p, cls: "", s });
    atoms.push({ box: del(close), cls: "close", s });
    return joinAtoms(atoms);
  };
  const fenced = (n, s) => {
    const atoms = [];
    const slots = [];
    const ends = [];
    const mark = tokens.length;
    let Ua = 0, Ud = 0;
    n.parts.forEach((p, i) => {
      if (i > 0) {
        slots.push(atoms.length);
        atoms.push({ box: empty(), cls: "middle", s });
        ends.push(tokens.length);
      }
      const items = p.kind === "row" ? p.items : [p];
      let st2 = s;
      for (const it of items) {
        if (it.kind === "style") {
          st2 = { level: { D: 0, T: 1, S: 2, SS: 3 }[it.style], cramped: st2.cramped };
          continue;
        }
        const b = node(it, st2);
        if (b.ink.length || b.w) {
          Ua = Math.max(Ua, b.h);
          Ud = Math.max(Ud, b.d);
        }
        atoms.push({ box: b, cls: it.kind === "space" ? "" : clsOf2(it), s: st2 });
      }
    });
    const del = (cp) => cp ? token("mo", n.at, stretchV(gidOf(cp, n.at), Ua, Ud, s, true)) : { ...empty(), w: 0.12 * font.unitsPerEm };
    const open = del(n.open);
    moveToken(open, mark);
    slots.forEach((at, i) => {
      atoms[at].box = del(n.middles[i]);
      moveToken(atoms[at].box, ends[i] + 1 + i);
    });
    const close = del(n.close);
    return joinAtoms([{ box: open, cls: "open", s }, ...atoms, { box: close, cls: "close", s }]);
  };
  const moveToken = (b, i) => {
    const t = (
      /** @type {Box & { tok?: Token }} */
      b.tok
    );
    const j = t ? tokens.indexOf(t) : -1;
    if (j > i) {
      tokens.splice(j, 1);
      tokens.splice(
        i,
        0,
        /** @type {Token} */
        t
      );
    }
  };
  const accent = (n, s) => {
    const base = node(n.base, cramp(s));
    const gid = gidOf(n.cp, n.at), k = kOf(s);
    const acc = token("mo", n.at, n.stretchy ? stretch(gid, base.w, k, false) : glyphBox(gid, k));
    const at = base.gid >= 0 && !Number.isNaN(base.ta) ? base.ta : base.w / 2;
    const aa = Number.isNaN(acc.ta) ? acc.w / 2 : acc.ta;
    const shift = Math.max(0, c("AccentBaseHeight", s) - base.h);
    const y = base.h + shift + acc.d;
    const x0 = Math.min(0, at - aa), w = Math.max(base.w, at - aa + acc.w) - x0;
    return compose({ w, h: Math.max(base.h, y + acc.h), d: base.d, ic: base.ic, gid: -1 }, [{ box: base, x: -x0, y: 0 }, { box: acc, x: at - aa - x0, y }]);
  };
  const line = (n, s) => {
    const base = node(n.base, n.under ? s : cramp(s));
    if (n.under) {
      const t2 = c("UnderbarRuleThickness", s), y2 = -base.d - c("UnderbarVerticalGap", s) - t2;
      return compose({ w: base.w, h: base.h, d: -y2 + c("UnderbarExtraDescender", s) }, [{ box: base, x: 0, y: 0 }, { box: rule(base.w, t2), x: 0, y: y2 }]);
    }
    const t = c("OverbarRuleThickness", s), y = base.h + c("OverbarVerticalGap", s);
    return compose({ w: base.w, h: y + t + c("OverbarExtraAscender", s), d: base.d }, [{ box: base, x: 0, y: 0 }, { box: rule(base.w, t), x: 0, y }]);
  };
  const brace = (n, s) => {
    const base = node(n.base, s);
    const br = token("mo", n.at, stretch(gidOf(n.cp, n.at), base.w, kOf(s), false));
    return n.under ? limitsBox(base, null, br, s) : limitsBox(base, br, null, s);
  };
  const stack = (n, s) => {
    const base = node(n.base, s);
    const under = n.under ? node(n.under, sub(s)) : null;
    return limitsBox(base, n.over ? node(n.over, sup(s)) : null, under, s);
  };
  const matrix = (n, s) => {
    const cs = n.small ? { level: Math.max(2, s.level), cramped: s.cramped } : { level: Math.max(1, s.level), cramped: s.cramped };
    const mark = tokens.length, e = em(cs), cells = n.rows.map((r) => r.map((x) => node(x, cs)));
    const cols = Math.max(...cells.map((r) => r.length));
    const colW = Array.from({ length: cols }, (_, j) => Math.max(0, ...cells.map((r) => r[j] ? r[j].w : 0)));
    const sep = n.cases ? e : n.small ? e / 3 : e;
    const rows = cells.map((r) => ({ h: Math.max(0.84 * e, ...r.map((b) => b.h)), d: Math.max(0.36 * e, ...r.map((b) => b.d)) }));
    const total = rows.reduce((a, r) => a + r.h + r.d, 0);
    const kids = [];
    let y = total / 2 + c("AxisHeight", s);
    cells.forEach((r, i) => {
      y -= rows[i].h;
      let x = 0;
      r.forEach((b, j) => {
        kids.push({ box: b, x: n.cases ? x : x + (colW[j] - b.w) / 2, y });
        x += colW[j] + sep;
      });
      y -= rows[i].d;
    });
    const w = colW.reduce((a, b) => a + b, 0) + sep * (cols - 1);
    const core = compose({ w, h: total / 2 + c("AxisHeight", s), d: total / 2 - c("AxisHeight", s) }, kids);
    return n.open || n.close ? fencedBoxes(n.open, n.close, [core], s, n.at, mark) : core;
  };
  const st = { level: display ? 0 : 1, cramped: false };
  const root = node(ast, st);
  if (fault) return err(fault);
  const glyphs = [];
  const rules = [];
  const walk = (b, ox, oy) => {
    const tk = (
      /** @type {Box & { tok?: Token }} */
      b.tok
    );
    if (tk) {
      tk.x = ox;
      tk.top += oy;
      tk.bottom += oy;
    }
    for (const i of b.ink) {
      if (i.t === "g") glyphs.push({ gid: i.gid, x: ox + i.x, y: oy + i.y, k: i.k });
      else if (i.t === "r") rules.push({ x: ox + i.x, y: oy + i.y, w: i.w, h: i.h });
      else walk(i.box, ox + i.x, oy + i.y);
    }
  };
  walk(root, 0, 0);
  return ok({ width: root.w + root.ic, ascent: root.h, descent: root.d, glyphs, rules, tokens });
}

// math/src/typeset.js
var TypesetError = variants("TypesetError", {
  Tex: ["error"],
  // TexError: the source, with an offset
  Table: ["error"],
  // MathError: the font has no usable MATH table
  Layout: ["error"],
  // MathLayoutError: a glyph the formula needs
  Size: ["size"]
});
var TABLES = /* @__PURE__ */ new WeakMap();
function typeset(font, fontKey, latex, { size, display = false, limits = TEX_LIMITS }) {
  if (!(size > 0 && size <= 1e5)) return err(TypesetError.Size(size));
  let t = TABLES.get(font);
  if (!t) {
    t = mathOf(font);
    TABLES.set(font, t);
  }
  if (t.tag === "Err") return err(TypesetError.Table(t.error));
  const ast = parseTex(latex, limits);
  if (ast.tag === "Err") return err(TypesetError.Tex(ast.error));
  const box = layoutMath(font, t.value, ast.value, { display });
  if (box.tag === "Err") return err(TypesetError.Layout(box.error));
  const s = size / font.unitsPerEm;
  const glyphs = [];
  for (const g of box.value.glyphs) {
    const p = font.path(g.gid);
    if (p.tag === "Ok" && p.value.length) glyphs.push({ ...g, path: p.value });
  }
  return ok({ fontKey, size, s, width: box.value.width * s, ascent: box.value.ascent * s, descent: box.value.descent * s, glyphs, rules: box.value.rules, tokens: box.value.tokens });
}
export {
  typeset
};
