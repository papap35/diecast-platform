/**
 * 程式化產生的模型車插圖（SVG）。
 * 作品集示範站不使用任何品牌官方圖片，所有商品圖都由這支程式依車型、配色、彩繪產生。
 *
 * 座標系：車輛局部座標 1000 × 400，車頭朝右，地面 y = 380。
 */

export type BodyStyle = 'coupe' | 'gt' | 'hatch' | 'van' | 'racer' | 'pickup' | 'muscle' | 'sedan';
export type Livery = 'none' | 'stripes' | 'side-stripe' | 'race' | 'two-tone' | 'taxi';

export interface CarArtSpec {
  style: BodyStyle;
  body: string;
  accent?: string;
  livery?: Livery;
  number?: number;
  rim?: string;
  background?: [string, string];
  /** 尾翼（性能車型可加） */
  wing?: boolean;
}

interface BodyGeometry {
  body: string;
  glass: string;
  /** B 柱位置（x），用來把側窗分成前後兩片 */
  pillarX?: number;
  rearWheelX: number;
  frontWheelX: number;
  wheelR: number;
  /** 車身腰線高度（two-tone 與側邊條紋的分界） */
  beltY: number;
  headlight: { x: number; y: number };
  taillight: { x: number; y: number };
  doorX: [number, number];
  /** 尾翼／擾流板 */
  wing?: string;
  /** 車頂中心（計程車頂燈位置） */
  roofX?: number;
  roofY?: number;
}

function arch(cx: number, r: number, y: number): string {
  return `L ${cx + r} ${y} A ${r} ${r} 0 0 0 ${cx - r} ${y}`;
}

const GEOMETRY: Record<BodyStyle, BodyGeometry> = {
  coupe: {
    body: `M 40 330 L 38 292 C 40 262 62 244 112 236 L 300 224
      C 360 218 400 168 470 146 C 520 132 600 130 642 144 C 690 160 730 198 782 212
      L 930 236 C 966 244 986 264 986 292 L 980 330 ${arch(790, 74, 330)} ${arch(222, 74, 330)} Z`,
    glass: `M 392 214 C 430 178 478 156 528 150 L 636 150 C 668 162 700 186 724 210 Z`,
    pillarX: 572,
    rearWheelX: 222,
    frontWheelX: 790,
    wheelR: 62,
    beltY: 262,
    headlight: { x: 952, y: 258 },
    taillight: { x: 46, y: 262 },
    doorX: [420, 700],
    wing: 'M 44 214 L 168 206 L 170 220 L 48 228 Z M 92 226 L 104 226 L 104 240 L 92 240 Z',
  },
  gt: {
    body: `M 30 330 L 30 290 C 32 262 54 246 100 240 L 330 226
      C 390 218 426 170 492 148 C 540 134 610 132 652 146 C 694 162 724 196 770 212
      L 950 238 C 978 246 992 264 992 292 L 986 330 ${arch(800, 74, 330)} ${arch(214, 74, 330)} Z`,
    glass: `M 418 214 C 452 180 498 158 546 152 L 646 152 C 674 164 700 188 718 210 Z`,
    pillarX: 590,
    rearWheelX: 214,
    frontWheelX: 800,
    wheelR: 63,
    beltY: 262,
    headlight: { x: 960, y: 258 },
    taillight: { x: 36, y: 262 },
    doorX: [450, 712],
  },
  hatch: {
    body: `M 80 330 L 76 268 C 78 226 96 156 132 128 C 160 108 220 104 300 104
      L 520 104 C 580 106 640 150 690 196 L 860 222 C 900 230 922 252 924 282 L 920 330
      ${arch(752, 70, 330)} ${arch(236, 70, 330)} Z`,
    glass: `M 140 196 C 150 160 170 132 206 124 L 520 122 C 568 126 618 162 662 200 Z`,
    pillarX: 420,
    rearWheelX: 236,
    frontWheelX: 752,
    wheelR: 58,
    beltY: 240,
    headlight: { x: 892, y: 250 },
    taillight: { x: 84, y: 236 },
    doorX: [330, 640],
    wing: 'M 96 112 L 230 98 L 232 110 L 106 128 Z',
  },
  van: {
    body: `M 120 330 L 118 120 C 120 84 140 66 180 64 L 640 64 C 700 66 740 96 772 150
      L 820 236 C 840 252 846 270 846 290 L 842 330 ${arch(716, 64, 330)} ${arch(250, 64, 330)} Z`,
    glass: `M 520 84 L 640 84 C 680 88 712 112 738 160 L 760 200 L 520 200 Z`,
    pillarX: 520,
    rearWheelX: 250,
    frontWheelX: 716,
    wheelR: 54,
    beltY: 214,
    headlight: { x: 818, y: 250 },
    taillight: { x: 126, y: 230 },
    doorX: [300, 500],
  },
  racer: {
    body: `M 30 330 L 28 280 C 30 254 50 238 92 234 L 300 226
      C 380 218 430 176 492 158 C 532 148 584 148 620 160 C 664 176 700 214 760 230
      L 940 256 C 974 264 992 282 992 304 L 986 330 ${arch(808, 76, 330)} ${arch(206, 76, 330)} Z`,
    glass: `M 470 210 C 500 186 532 170 566 168 L 618 170 C 646 182 668 200 686 218 Z`,
    rearWheelX: 206,
    frontWheelX: 808,
    wheelR: 64,
    beltY: 272,
    headlight: { x: 958, y: 276 },
    taillight: { x: 34, y: 262 },
    doorX: [470, 690],
    wing: 'M 28 180 L 186 174 L 188 194 L 32 200 Z M 70 198 L 84 198 L 84 236 L 70 236 Z M 150 196 L 164 196 L 164 230 L 150 230 Z',
  },
  pickup: {
    body: `M 40 330 L 40 222 L 420 222 L 424 128 C 426 104 444 92 470 92 L 600 92
      C 636 94 664 120 690 170 L 714 214 L 900 230 C 936 236 956 256 956 286 L 952 330
      ${arch(790, 76, 330)} ${arch(214, 76, 330)} Z`,
    glass: `M 446 196 L 446 128 C 448 114 458 110 474 110 L 596 110 C 622 112 642 134 662 172 L 676 196 Z`,
    rearWheelX: 214,
    frontWheelX: 790,
    wheelR: 64,
    beltY: 256,
    headlight: { x: 926, y: 258 },
    taillight: { x: 46, y: 246 },
    doorX: [470, 700],
  },
  muscle: {
    body: `M 30 330 L 30 262 C 32 240 50 228 90 226 L 300 222
      C 360 214 404 160 472 142 C 520 132 602 130 646 142 C 690 156 718 186 756 206
      L 960 226 C 984 230 996 248 996 276 L 990 330 ${arch(806, 74, 330)} ${arch(208, 74, 330)} Z`,
    glass: `M 396 210 C 430 174 476 154 530 148 L 640 150 C 670 162 694 182 712 202 Z`,
    pillarX: 580,
    rearWheelX: 208,
    frontWheelX: 806,
    wheelR: 64,
    beltY: 254,
    headlight: { x: 968, y: 246 },
    taillight: { x: 36, y: 250 },
    doorX: [430, 708],
  },
  sedan: {
    body: `M 50 330 L 48 270 C 50 246 70 232 112 228 L 270 222
      C 320 214 362 152 420 130 C 470 116 600 114 650 128 C 700 144 736 190 780 210
      L 920 230 C 956 238 972 258 972 286 L 966 330 ${arch(782, 70, 330)} ${arch(236, 70, 330)} Z`,
    glass: `M 330 210 C 370 168 420 140 474 134 L 642 134 C 680 148 712 178 736 206 Z`,
    pillarX: 540,
    rearWheelX: 236,
    frontWheelX: 782,
    wheelR: 60,
    beltY: 248,
    headlight: { x: 940, y: 250 },
    taillight: { x: 56, y: 248 },
    doorX: [380, 700],
    roofX: 560,
    roofY: 116,
  },
};

function shade(hex: string, amount: number): string {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  const channel = (shift: number) => {
    const value = (n >> shift) & 0xff;
    const next = amount < 0 ? value * (1 + amount) : value + (255 - value) * amount;
    return Math.round(Math.min(255, Math.max(0, next)));
  };
  return `#${[channel(16), channel(8), channel(0)].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

function wheel(cx: number, r: number, rim: string, id: string): string {
  const spokes = Array.from({ length: 5 }, (_, i) => {
    const angle = (i * 72 * Math.PI) / 180;
    const x = cx + Math.cos(angle) * r * 0.48;
    const y = 330 - 8 + Math.sin(angle) * r * 0.48;
    return `<line x1="${cx}" y1="${330 - 8}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${shade(rim, -0.35)}" stroke-width="${(r * 0.13).toFixed(1)}" stroke-linecap="round"/>`;
  }).join('');
  const cy = 330 - 8;
  return `<g>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="#17171a"/>
    <circle cx="${cx}" cy="${cy}" r="${r * 0.86}" fill="#232327"/>
    <circle cx="${cx}" cy="${cy}" r="${r * 0.62}" fill="url(#${id}-rim)"/>
    ${spokes}
    <circle cx="${cx}" cy="${cy}" r="${r * 0.14}" fill="${shade(rim, 0.25)}"/>
  </g>`;
}

function livery(spec: CarArtSpec, g: BodyGeometry): string {
  const accent = spec.accent ?? '#ffffff';
  switch (spec.livery) {
    case 'stripes':
      return `<rect x="0" y="${g.beltY + 14}" width="1000" height="14" fill="${accent}"/>
        <rect x="0" y="${g.beltY + 36}" width="1000" height="7" fill="${accent}"/>`;
    case 'side-stripe':
      return `<rect x="0" y="${g.beltY + 6}" width="1000" height="12" fill="${accent}"/>`;
    case 'two-tone':
      return `<rect x="0" y="${g.beltY}" width="1000" height="200" fill="${accent}"/>
        <rect x="0" y="${g.beltY - 4}" width="1000" height="4" fill="${shade(accent, 0.4)}"/>`;
    case 'taxi':
      return `<rect x="0" y="${g.beltY + 4}" width="1000" height="22" fill="#111"/>
        ${Array.from({ length: 50 }, (_, i) => `<rect x="${i * 20}" y="${g.beltY + 4 + (i % 2) * 11}" width="10" height="11" fill="#f5f5f5"/>`).join('')}`;
    case 'race': {
      const doorMid = (g.doorX[0] + g.doorX[1]) / 2;
      return `<path d="M ${g.doorX[0] - 220} 400 L ${g.doorX[0] + 40} ${g.beltY - 40} L ${g.doorX[0] + 140} ${g.beltY - 40} L ${g.doorX[0] - 120} 400 Z" fill="${accent}"/>
        <path d="M ${g.doorX[1] + 60} 400 L ${g.doorX[1] + 220} ${g.beltY - 50} L ${g.doorX[1] + 280} ${g.beltY - 50} L ${g.doorX[1] + 120} 400 Z" fill="${accent}" opacity="0.85"/>
        ${
          spec.number !== undefined
            ? `<circle cx="${doorMid}" cy="${g.beltY + 20}" r="38" fill="#ffffff" stroke="#111" stroke-width="4"/>
               <text x="${doorMid}" y="${g.beltY + 34}" font-family="Arial Black, Arial, sans-serif" font-size="40" font-weight="900" text-anchor="middle" fill="#111">${spec.number}</text>`
            : ''
        }`;
    }
    default:
      return '';
  }
}

export function renderCarSvg(spec: CarArtSpec, id = 'car'): string {
  const g = GEOMETRY[spec.style];
  const rim = spec.rim ?? '#c9ccd1';
  const [bgTop, bgBottom] = spec.background ?? ['#f6f6f4', '#e4e3df'];
  const bodyDark = shade(spec.body, -0.35);

  const wing = spec.wing && g.wing ? `<path d="${g.wing}" fill="${shade(spec.body, -0.45)}"/>` : '';

  const taxiSign =
    spec.livery === 'taxi' && g.roofX && g.roofY
      ? `<rect x="${g.roofX - 46}" y="${g.roofY - 30}" width="92" height="30" rx="6" fill="#fff4c2" stroke="#222" stroke-width="3"/>
         <text x="${g.roofX}" y="${g.roofY - 8}" font-family="Arial Black, Arial, sans-serif" font-size="20" font-weight="900" text-anchor="middle" fill="#222">TAXI</text>`
      : '';

  const wells = [g.rearWheelX, g.frontWheelX]
    .map((x) => `<circle cx="${x}" cy="330" r="${g.wheelR + 11}" fill="#0f0f12"/>`)
    .join('');

  const pillar = g.pillarX
    ? `<rect x="${g.pillarX - 7}" y="100" width="14" height="140" fill="${bodyDark}"/>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900" role="img">
  <defs>
    <linearGradient id="${id}-bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${bgTop}"/>
      <stop offset="1" stop-color="${bgBottom}"/>
    </linearGradient>
    <radialGradient id="${id}-shadow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#000" stop-opacity="0.35"/>
      <stop offset="1" stop-color="#000" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="${id}-shine" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="0.55"/>
      <stop offset="0.45" stop-color="#fff" stop-opacity="0.08"/>
      <stop offset="0.6" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.28"/>
    </linearGradient>
    <linearGradient id="${id}-glass" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#2b3440"/>
      <stop offset="0.55" stop-color="#11161d"/>
      <stop offset="1" stop-color="#3a4553"/>
    </linearGradient>
    <radialGradient id="${id}-rim" cx="0.4" cy="0.35" r="0.75">
      <stop offset="0" stop-color="${shade(rim, 0.5)}"/>
      <stop offset="1" stop-color="${shade(rim, -0.25)}"/>
    </radialGradient>
    <radialGradient id="${id}-spot" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.85"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="${id}-plinth" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3a3c42"/>
      <stop offset="1" stop-color="#26272b"/>
    </linearGradient>
    <clipPath id="${id}-clip"><path d="${g.body}"/></clipPath>
  </defs>
  <rect width="1200" height="900" fill="url(#${id}-bg)"/>
  <ellipse cx="600" cy="430" rx="560" ry="330" fill="url(#${id}-spot)"/>
  <path d="M 120 664 L 1080 664 L 1120 724 L 80 724 Z" fill="url(#${id}-plinth)"/>
  <rect x="80" y="724" width="1040" height="26" fill="#1b1c20"/>
  <path d="M 120 664 L 1080 664 L 1086 672 L 114 672 Z" fill="#ffffff" opacity="0.18"/>
  <ellipse cx="600" cy="${664}" rx="520" ry="22" fill="url(#${id}-shadow)"/>
  <g transform="translate(80 266) scale(1.04)">
    ${wing}
    ${taxiSign}
    ${wells}
    <path d="${g.body}" fill="${spec.body}"/>
    <g clip-path="url(#${id}-clip)">
      ${livery(spec, g)}
      <rect x="0" y="0" width="1000" height="400" fill="url(#${id}-shine)"/>
      <line x1="${g.doorX[0]}" y1="${g.beltY - 60}" x2="${g.doorX[0] + 8}" y2="330" stroke="${bodyDark}" stroke-width="3" opacity="0.6"/>
      <line x1="${g.doorX[1]}" y1="${g.beltY - 60}" x2="${g.doorX[1] - 6}" y2="330" stroke="${bodyDark}" stroke-width="3" opacity="0.6"/>
    </g>
    <path d="${g.glass}" fill="url(#${id}-glass)"/>
    <g clip-path="url(#${id}-clip)">${pillar}</g>
    <path d="${g.glass}" fill="none" stroke="#0b0d10" stroke-width="5" stroke-linejoin="round"/>
    <ellipse cx="${g.headlight.x}" cy="${g.headlight.y}" rx="26" ry="12" fill="#fff6d8" stroke="${bodyDark}" stroke-width="3"/>
    <rect x="${g.taillight.x - 8}" y="${g.taillight.y - 10}" width="22" height="20" rx="4" fill="#d3262f"/>
    ${wheel(g.rearWheelX, g.wheelR, rim, id)}
    ${wheel(g.frontWheelX, g.wheelR, rim, id)}
  </g>
</svg>`;
}
