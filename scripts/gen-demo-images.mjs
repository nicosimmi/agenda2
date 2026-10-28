// Genera las ilustraciones de la demo pública (apps/web/public/img/demo). Son dibujos vectoriales
// hechos con formas geométricas propias, sin fotos ni arte de terceros, así que no llevan
// derechos de autor ajenos. Uso: node scripts/gen-demo-images.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { DEMO_BUSINESSES, demoImageSlug } from "../packages/shared/src/demo-data.ts";

const OUT = new URL("../apps/web/public/img/demo/", import.meta.url);
mkdirSync(OUT, { recursive: true });

const INK = "#1C1917";
const PALETTES = {
  barberia: {
    bg1: "#2A2420",
    bg2: "#4A3B2C",
    accent: "#C89B3C",
    soft: "#E9D8A6",
    wall: "#3B3029",
    a: "#B23A48",
    b: "#2F5D8A",
    shirt: "#C89B3C",
  },
  peluqueria: {
    bg1: "#FDEDE7",
    bg2: "#F4B9A8",
    accent: "#C4543F",
    soft: "#FFF6F2",
    wall: "#F6CFC2",
    a: "#E58C79",
    b: "#8E3B2E",
    shirt: "#C4543F",
  },
  fisioterapia: {
    bg1: "#E4F5F0",
    bg2: "#8FD0C0",
    accent: "#1F7A68",
    soft: "#F5FCFA",
    wall: "#CBEBE3",
    a: "#2FA58D",
    b: "#14584A",
    shirt: "#1F7A68",
  },
  padel: {
    bg1: "#E1EEFF",
    bg2: "#80B2F2",
    accent: "#2457B5",
    soft: "#F0F6FF",
    wall: "#BFD8F7",
    a: "#C5E04A",
    b: "#173F86",
    shirt: "#2457B5",
  },
  estetica: {
    bg1: "#F3E9FA",
    bg2: "#CBABE6",
    accent: "#7B4BA6",
    soft: "#FAF5FD",
    wall: "#E3D0F2",
    a: "#D98FBF",
    b: "#563478",
    shirt: "#7B4BA6",
  },
  veterinaria: {
    bg1: "#E8F5DE",
    bg2: "#A9D58B",
    accent: "#D9761C",
    soft: "#F7FCF2",
    wall: "#D3EBC0",
    a: "#E8A04A",
    b: "#4F8A2C",
    shirt: "#4F8A2C",
  },
  otros: {
    bg1: "#FBF3DF",
    bg2: "#E9CE87",
    accent: "#A67C22",
    soft: "#FFFBF0",
    wall: "#F2E2B5",
    a: "#C89B3C",
    b: "#6F5216",
    shirt: "#A67C22",
  },
};
const SKIN = ["#F3D1B3", "#E3B48D", "#C98D63", "#9C6440", "#6E4429"];
const HAIR = ["#1C1917", "#3B2A1E", "#6B4A2B", "#B58B4A", "#8A8A8A"];

const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const wrap = (name, max = 16) => {
  if (name.length <= max) return [name];
  const lines = [""];
  for (const w of name.split(" ")) {
    const last = lines.length - 1;
    const joined = `${lines[last]} ${w}`.trim();
    if (joined.length <= max) lines[last] = joined;
    else lines.push(w);
  }
  return lines;
};
const svg = (w, h, label, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(label)}">${body}</svg>\n`;
const grad = (id, a, b, vertical = true) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="${vertical ? 0 : 1}" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;

// --- Motivos de cada categoría, centrados en (0,0) y de unos 240 px de alto ---
const MOTIFS = {
  barberia: (p) => `
    <g stroke="${p.accent}" stroke-width="12" stroke-linecap="round" fill="none">
      <path d="M-58 -96 L52 62"/><path d="M58 -96 L-52 62"/>
      <circle cx="-62" cy="92" r="26"/><circle cx="62" cy="92" r="26"/>
    </g><circle r="9" fill="${p.accent}" cy="-12"/>`,
  peluqueria: (p) => `
    <g fill="${p.accent}"><rect x="-110" y="-30" width="220" height="48" rx="12"/>
      ${Array.from({ length: 11 }, (_, i) => `<rect x="${-104 + i * 20}" y="14" width="10" height="62" rx="5"/>`).join("")}
    </g><circle cx="0" cy="-86" r="30" fill="none" stroke="${p.b}" stroke-width="12"/><path d="M-26 -60 L26 -112" stroke="${p.b}" stroke-width="12" stroke-linecap="round"/>`,
  fisioterapia: (p) => `
    <g fill="${p.accent}">${[0, 1, 2, 3, 4]
      .map(
        (i) =>
          `<rect x="${-46 + Math.sin(i * 0.9) * 16 + i * 4}" y="${-104 + i * 46}" width="${92 - i * 6}" height="34" rx="16" transform="rotate(${(i - 2) * 5} 0 ${-87 + i * 46})"/>`,
      )
      .join("")}</g>
    <path d="M-120 100 Q-70 40 -70 -30" stroke="${p.b}" stroke-width="12" fill="none" stroke-linecap="round"/><path d="M120 100 Q70 40 70 -30" stroke="${p.b}" stroke-width="12" fill="none" stroke-linecap="round"/>`,
  padel: (p) => `
    <g transform="rotate(-28)"><ellipse rx="78" ry="98" cy="-26" fill="${p.accent}"/>
      <ellipse rx="62" ry="82" cy="-26" fill="${p.soft}"/>
      ${[-36, -12, 12, 36].flatMap((x) => [-80, -50, -20, 10, 40].map((y) => `<circle cx="${x}" cy="${y}" r="6" fill="${p.accent}"/>`)).join("")}
      <rect x="-14" y="64" width="28" height="86" rx="12" fill="${p.b}"/></g>
    <circle cx="88" cy="86" r="34" fill="${p.a}"/><path d="M62 72 Q88 90 114 72" stroke="${p.soft}" stroke-width="5" fill="none"/>`,
  estetica: (p) => `
    <g>${[-60, -30, 0, 30, 60].map((r) => `<ellipse cx="0" cy="-48" rx="30" ry="74" fill="${r === 0 ? p.accent : p.a}" opacity="${r === 0 ? 1 : 0.85}" transform="rotate(${r} 0 40)"/>`).join("")}</g>
    <ellipse cx="0" cy="92" rx="92" ry="14" fill="${p.b}" opacity="0.5"/><circle cx="0" cy="-130" r="14" fill="${p.soft}"/>`,
  veterinaria: (p) => `
    <ellipse cx="0" cy="40" rx="64" ry="52" fill="${p.accent}"/>
    ${[
      [-84, -34],
      [-30, -84],
      [30, -84],
      [84, -34],
    ]
      .map(
        ([x, y]) =>
          `<ellipse cx="${x}" cy="${y}" rx="24" ry="32" fill="${p.accent}" transform="rotate(${x * 0.35} ${x} ${y})"/>`,
      )
      .join("")}`,
  otros: (p) => `
    <circle r="86" fill="${p.accent}"/><circle r="56" fill="${p.soft}"/><path d="M-30 4 L-8 28 L36 -26" stroke="${p.b}" stroke-width="16" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
};

// --- Los tres dibujos de cada negocio ---
function logo(b, p) {
  const lines = wrap(b.name);
  const color = b.category === "barberia" ? p.soft : INK;
  const text = lines
    .map(
      (l, i) =>
        `<text x="400" y="${470 + i * 52}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="46" font-weight="700" fill="${color}">${esc(l)}</text>`,
    )
    .join("");
  return svg(
    800,
    600,
    `Logotipo de ${b.name}`,
    `<defs>${grad("g", p.bg1, p.bg2)}</defs><rect width="800" height="600" fill="url(#g)"/>
    <circle cx="400" cy="230" r="170" fill="${p.soft}" opacity="0.25"/><circle cx="400" cy="230" r="130" fill="${p.soft}" opacity="0.18"/>
    <g transform="translate(400 230) scale(1.05)">${MOTIFS[b.category](p)}</g>${text}
    <rect x="300" y="${470 + (lines.length - 1) * 52 + 26}" width="200" height="5" rx="2.5" fill="${p.accent}"/>`,
  );
}

function storefront(b, p) {
  const sign = wrap(b.name, 20);
  const stripes = Array.from(
    { length: 12 },
    (_, i) =>
      `<path d="M${100 + i * 50} 205 h50 v52 a25 25 0 0 1 -50 0 z" fill="${i % 2 ? p.soft : p.accent}"/>`,
  ).join("");
  const signText = sign
    .map(
      (l, i) =>
        `<text x="400" y="${138 + i * 30}" text-anchor="middle" font-family="Georgia, serif" font-size="${sign.length > 1 ? 24 : 28}" font-weight="700" fill="${p.soft}">${esc(l)}</text>`,
    )
    .join("");
  return svg(
    800,
    600,
    `Fachada de ${b.name}`,
    `<defs>${grad("sky", p.bg1, p.bg2)}</defs><rect width="800" height="600" fill="url(#sky)"/>
    <circle cx="660" cy="90" r="46" fill="${p.soft}" opacity="0.8"/><ellipse cx="170" cy="80" rx="70" ry="22" fill="${p.soft}" opacity="0.7"/><ellipse cx="220" cy="66" rx="46" ry="18" fill="${p.soft}" opacity="0.7"/>
    <rect y="500" width="800" height="100" fill="${INK}" opacity="0.18"/><rect y="500" width="800" height="10" fill="${INK}" opacity="0.12"/>
    <rect x="100" y="150" width="600" height="352" fill="${p.wall}"/><rect x="100" y="150" width="600" height="14" fill="${INK}" opacity="0.15"/>
    <rect x="230" y="${104 - (sign.length - 1) * 12}" width="340" height="${40 + (sign.length - 1) * 30}" rx="10" fill="${INK}"/>
    <g transform="translate(0 ${-(sign.length - 1) * 12})">${signText}</g>
    ${stripes}
    <rect x="140" y="300" width="290" height="170" rx="8" fill="${p.soft}" stroke="${INK}" stroke-opacity="0.25" stroke-width="6"/>
    <path d="M160 462 L260 308 L300 308 L200 462 Z" fill="#fff" opacity="0.45"/>
    <g transform="translate(285 385) scale(0.42)">${MOTIFS[b.category](p)}</g>
    <rect x="480" y="300" width="170" height="202" rx="8" fill="${p.b}"/><rect x="496" y="318" width="138" height="90" rx="6" fill="${p.soft}" opacity="0.55"/>
    <circle cx="628" cy="420" r="8" fill="${p.soft}"/>
    <rect x="662" y="450" width="40" height="52" rx="6" fill="${p.accent}"/><circle cx="682" cy="430" r="26" fill="${p.b}" opacity="0.8"/><circle cx="662" cy="418" r="16" fill="${p.b}" opacity="0.8"/><circle cx="700" cy="416" r="16" fill="${p.b}" opacity="0.8"/>`,
  );
}

function detail(b, p) {
  const dots = Array.from({ length: 30 }, (_, i) => {
    const h = hash(b.slug + i);
    return `<circle cx="${h % 800}" cy="${(h >>> 5) % 600}" r="${10 + (h % 28)}" fill="${p.soft}" opacity="${0.12 + (h % 20) / 100}"/>`;
  }).join("");
  return svg(
    800,
    600,
    `Detalle de ${b.name}`,
    `<defs>${grad("g", p.bg2, p.bg1, false)}</defs><rect width="800" height="600" fill="url(#g)"/>${dots}
    <rect x="60" y="60" width="680" height="480" rx="28" fill="none" stroke="${p.accent}" stroke-width="6" opacity="0.6"/>
    <g transform="translate(400 300) scale(1.5)">${MOTIFS[b.category](p)}</g>`,
  );
}

// --- Retratos (y pistas de pádel) ---
function portrait(b, name, p) {
  if (/^Pista/.test(name)) {
    return svg(
      400,
      400,
      name,
      `<rect width="400" height="400" fill="${p.bg1}"/>
      <rect x="70" y="40" width="260" height="320" rx="10" fill="${p.accent}"/><rect x="86" y="56" width="228" height="288" fill="${p.b}" opacity="0.55"/>
      <g stroke="#fff" stroke-width="5" fill="none"><rect x="96" y="66" width="208" height="268"/><path d="M96 200 H304 M200 66 V334 M96 142 H304 M96 258 H304"/></g>
      <rect x="86" y="196" width="228" height="8" fill="#fff" opacity="0.9"/><circle cx="250" cy="120" r="9" fill="${p.a}"/>`,
    );
  }
  const h = hash(b.slug + name);
  const skin = SKIN[h % SKIN.length];
  const hair = HAIR[(h >>> 3) % HAIR.length];
  const style = (h >>> 6) % 4;
  const back =
    style === 1
      ? `<path d="M118 190 Q112 330 150 340 L250 340 Q288 330 282 190 Z" fill="${hair}"/>`
      : "";
  const top = [
    `<path d="M128 186 Q124 106 200 106 Q276 106 272 186 Q252 150 200 148 Q148 150 128 186 Z" fill="${hair}"/>`,
    `<path d="M126 196 Q122 100 200 100 Q278 100 274 196 Q250 140 200 140 Q150 140 126 196 Z" fill="${hair}"/>`,
    `<path d="M132 176 Q140 112 200 112 Q260 112 268 176 Q240 150 200 150 Q160 150 132 176 Z" fill="${hair}"/><path d="M146 232 Q200 318 254 232 Q236 268 200 270 Q164 268 146 232 Z" fill="${hair}"/>`,
    `<path d="M130 184 Q128 112 200 112 Q272 112 270 184 Q248 152 200 150 Q152 152 130 184 Z" fill="${hair}"/><circle cx="200" cy="96" r="24" fill="${hair}"/>`,
  ][style];
  return svg(
    400,
    400,
    `Ilustración de ${name}`,
    `<defs>${grad("g", p.bg1, p.bg2)}</defs><rect width="400" height="400" fill="url(#g)"/>
    ${back}<path d="M50 400 Q56 296 200 288 Q344 296 350 400 Z" fill="${p.shirt}"/><path d="M168 288 L200 330 L232 288 Z" fill="${p.soft}"/>
    <rect x="176" y="236" width="48" height="62" rx="18" fill="${skin}"/><circle cx="200" cy="190" r="72" fill="${skin}"/>${top}
    <circle cx="176" cy="192" r="7" fill="${INK}"/><circle cx="224" cy="192" r="7" fill="${INK}"/><path d="M178 222 Q200 244 222 222" stroke="${INK}" stroke-width="6" fill="none" stroke-linecap="round"/>`,
  );
}

let count = 0;
for (const b of DEMO_BUSINESSES.filter((x) => x.status !== "draft")) {
  const p = PALETTES[b.category] ?? PALETTES.otros;
  const files = {
    [`${b.slug}-logo`]: logo(b, p),
    [`${b.slug}-local`]: storefront(b, p),
    [`${b.slug}-detalle`]: detail(b, p),
  };
  for (const m of b.staff) files[`${b.slug}-${demoImageSlug(m.name)}`] = portrait(b, m.name, p);
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(new URL(`${name}.svg`, OUT), content);
    count++;
  }
}
console.log(`${count} ilustraciones en apps/web/public/img/demo`);
