import type { CarArtSpec } from './car-art.js';

/**
 * 示範商品目錄。品牌與車款皆為虛構，避免使用真實商標；
 * 時間欄位以「種子執行當下」為基準的相對值，讓限量發售倒數永遠有效。
 */

type L10n<T> = { 'zh-TW': T; en: T; 'zh-CN': T };

export interface SeedBrand {
  slug: string;
  name: string;
  country: string;
  sortOrder: number;
  description: L10n<string>;
}

export interface SeedCategory {
  slug: string;
  parent?: string;
  sortOrder: number;
  name: L10n<string>;
  description?: L10n<string>;
}

export interface SeedProduct {
  slug: string;
  sku: string;
  brand: string;
  category: string;
  scale: string;
  price: number;
  compareAtPrice?: number;
  stock: number;
  status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  saleType?: 'REGULAR' | 'PRE_ORDER' | 'LIMITED';
  /** 相對種子執行時間的小時數 */
  releaseInHours?: number;
  /** 會員等級優先購：開賣前幾分鐘開放給指定等級以上 */
  earlyAccess?: { tier: 'DRIVER' | 'CHAMPION' | 'LEGEND'; minutesBefore: number };
  preorderClosesInDays?: number;
  expectedShipInDays?: number;
  purchaseLimit?: number;
  isFeatured?: boolean;
  specs: Record<string, string>;
  art: CarArtSpec;
  copy: L10n<{ name: string; subtitle?: string; description: string }>;
}

export const BRANDS: SeedBrand[] = [
  {
    slug: 'kaze-models',
    name: 'Kaze Models',
    country: 'JP',
    sortOrder: 1,
    description: {
      'zh-TW': '來自東京的小比例工作室，專注 80–90 年代日系街車，以細膩的車身線條與原廠色號著稱。',
      en: 'A Tokyo-based small-scale studio devoted to 80s–90s Japanese street cars, known for crisp body lines and factory-accurate paint codes.',
      'zh-CN': '来自东京的小比例工作室，专注 80–90 年代日系街车，以细腻的车身线条与原厂色号著称。',
    },
  },
  {
    slug: 'apex-miniatures',
    name: 'Apex Miniatures',
    country: 'US',
    sortOrder: 2,
    description: {
      'zh-TW': '美式肌肉車與皮卡的專家，橡膠輪胎、金屬底盤，是入門收藏的首選。',
      en: 'Specialists in American muscle and pickups — rubber tires and metal chassis make them a favourite starting point for new collectors.',
      'zh-CN': '美式肌肉车与皮卡的专家，橡胶轮胎、金属底盘，是入门收藏的首选。',
    },
  },
  {
    slug: 'torque-lab',
    name: 'Torque Lab',
    country: 'HK',
    sortOrder: 3,
    description: {
      'zh-TW': '香港賽車模型品牌，完整重現拉力賽與房車賽彩繪，每款皆附編號展示盒。',
      en: 'A Hong Kong motorsport label recreating rally and touring car liveries in full, each in a numbered display case.',
      'zh-CN': '香港赛车模型品牌，完整重现拉力赛与房车赛彩绘，每款皆附编号展示盒。',
    },
  },
  {
    slug: 'pit-lane-collectibles',
    name: 'Pit Lane Collectibles',
    country: 'GB',
    sortOrder: 4,
    description: {
      'zh-TW': '英國耐力賽模型老牌，1:43 與 1:18 樹脂車身，限量發行、極具收藏價值。',
      en: 'A veteran British endurance-racing marque producing limited 1:43 and 1:18 resin models prized by collectors.',
      'zh-CN': '英国耐力赛模型老牌，1:43 与 1:18 树脂车身，限量发行、极具收藏价值。',
    },
  },
  {
    slug: 'formosa-diecast',
    name: 'Formosa Diecast',
    country: 'TW',
    sortOrder: 5,
    description: {
      'zh-TW': '台灣在地品牌，用模型記錄街頭日常：計程車、夜市餐車、小貨卡，都是我們熟悉的風景。',
      en: 'A Taiwanese label capturing everyday street life in miniature — taxis, night-market food trucks and kei trucks we all know.',
      'zh-CN': '台湾在地品牌，用模型记录街头日常：出租车、夜市餐车、小货卡，都是我们熟悉的风景。',
    },
  },
  {
    slug: 'nordline-scale',
    name: 'Nordline Scale',
    country: 'SE',
    sortOrder: 6,
    description: {
      'zh-TW': '瑞典設計工作室，偏好低調配色的歐系經典車，展示盒採用可回收材質。',
      en: 'A Swedish design studio favouring understated European classics, packaged in recyclable display boxes.',
      'zh-CN': '瑞典设计工作室，偏好低调配色的欧系经典车，展示盒采用可回收材质。',
    },
  },
];

export const CATEGORIES: SeedCategory[] = [
  {
    slug: 'street',
    sortOrder: 1,
    name: { 'zh-TW': '街車', en: 'Street', 'zh-CN': '街车' },
    description: {
      'zh-TW': '日系、歐系、美式經典量產車',
      en: 'Classic production cars from Japan, Europe and America',
      'zh-CN': '日系、欧系、美式经典量产车',
    },
  },
  {
    slug: 'jdm',
    parent: 'street',
    sortOrder: 1,
    name: { 'zh-TW': '日系經典', en: 'JDM Classics', 'zh-CN': '日系经典' },
  },
  {
    slug: 'euro',
    parent: 'street',
    sortOrder: 2,
    name: { 'zh-TW': '歐系跑車', en: 'European', 'zh-CN': '欧系跑车' },
  },
  {
    slug: 'american',
    parent: 'street',
    sortOrder: 3,
    name: { 'zh-TW': '美式肌肉', en: 'American Muscle', 'zh-CN': '美式肌肉' },
  },
  {
    slug: 'motorsport',
    sortOrder: 2,
    name: { 'zh-TW': '賽車', en: 'Motorsport', 'zh-CN': '赛车' },
    description: {
      'zh-TW': '耐力賽、拉力賽、房車賽的經典彩繪',
      en: 'Iconic liveries from endurance, rally and touring car racing',
      'zh-CN': '耐力赛、拉力赛、房车赛的经典彩绘',
    },
  },
  {
    slug: 'endurance',
    parent: 'motorsport',
    sortOrder: 1,
    name: { 'zh-TW': '耐力賽', en: 'Endurance', 'zh-CN': '耐力赛' },
  },
  {
    slug: 'rally',
    parent: 'motorsport',
    sortOrder: 2,
    name: { 'zh-TW': '拉力賽', en: 'Rally', 'zh-CN': '拉力赛' },
  },
  {
    slug: 'touring',
    parent: 'motorsport',
    sortOrder: 3,
    name: { 'zh-TW': '房車賽', en: 'Touring Cars', 'zh-CN': '房车赛' },
  },
  {
    slug: 'utility',
    sortOrder: 3,
    name: { 'zh-TW': '工作車與城市日常', en: 'Utility & City', 'zh-CN': '工作车与城市日常' },
  },
  {
    slug: 'kei-van',
    parent: 'utility',
    sortOrder: 1,
    name: { 'zh-TW': '輕型車與廂型車', en: 'Kei & Vans', 'zh-CN': '轻型车与厢型车' },
  },
  {
    slug: 'trucks',
    parent: 'utility',
    sortOrder: 2,
    name: { 'zh-TW': '皮卡與貨卡', en: 'Pickups & Trucks', 'zh-CN': '皮卡与货卡' },
  },
  {
    slug: 'city',
    parent: 'utility',
    sortOrder: 3,
    name: { 'zh-TW': '城市日常', en: 'City Life', 'zh-CN': '城市日常' },
  },
  {
    slug: 'sets',
    sortOrder: 4,
    name: { 'zh-TW': '套組與禮盒', en: 'Sets & Gift Boxes', 'zh-CN': '套组与礼盒' },
  },
];

const DIECAST_64 = {
  material: 'Die-cast metal / ABS',
  wheels: 'Rubber tires',
  packaging: 'Acrylic display case',
};
const DIECAST_43 = {
  material: 'Die-cast metal',
  wheels: 'Rubber tires',
  packaging: 'Window box with plinth',
};
const RESIN_43 = { material: 'Resin', wheels: 'Rubber tires', packaging: 'Acrylic display case' };
const RESIN_18 = {
  material: 'Resin',
  wheels: 'Rubber tires',
  packaging: 'Acrylic display case with leather base',
};

export const PRODUCTS: SeedProduct[] = [
  // ── Kaze Models ──
  {
    slug: 'shiden-rs-coupe-midnight-purple',
    sku: 'KZ-64-001',
    brand: 'kaze-models',
    category: 'jdm',
    scale: '1:64',
    price: 420,
    stock: 48,
    isFeatured: true,
    specs: { ...DIECAST_64, edition: 'Regular' },
    art: { style: 'coupe', body: '#4b2a7a', rim: '#d6d8dc' },
    copy: {
      'zh-TW': {
        name: 'Shiden RS Coupe（午夜紫）',
        subtitle: '90 年代雙門跑車的代表作',
        description:
          '經典的午夜紫珠光漆在燈光下由紫轉藍，搭配五輻銀色輪框。車身線條依原廠圖面等比例縮小，是日系收藏的必備入門款。',
      },
      en: {
        name: 'Shiden RS Coupe — Midnight Purple',
        subtitle: 'The definitive 90s two-door',
        description:
          'The iconic midnight purple pearl shifts from violet to blue under light, paired with five-spoke silver wheels. Scaled faithfully from factory drawings — an essential first JDM piece.',
      },
      'zh-CN': {
        name: 'Shiden RS Coupe（午夜紫）',
        subtitle: '90 年代双门跑车的代表作',
        description:
          '经典的午夜紫珠光漆在灯光下由紫转蓝，搭配五辐银色轮框。车身线条依原厂图面等比例缩小，是日系收藏的必备入门款。',
      },
    },
  },
  {
    slug: 'shiden-rs-coupe-pearl-white',
    sku: 'KZ-64-002',
    brand: 'kaze-models',
    category: 'jdm',
    scale: '1:64',
    price: 420,
    stock: 4,
    specs: { ...DIECAST_64, edition: 'Regular' },
    art: {
      style: 'coupe',
      body: '#f1f0ea',
      rim: '#c9a227',
      livery: 'side-stripe',
      accent: '#b31b1b',
    },
    copy: {
      'zh-TW': {
        name: 'Shiden RS Coupe（珍珠白）',
        subtitle: '金色輪框 × 紅色腰線',
        description:
          '珍珠白車身配上金色輪框與紅色腰線，致敬當年的原廠運動套件。這個配色存量不多，喜歡請把握。',
      },
      en: {
        name: 'Shiden RS Coupe — Pearl White',
        subtitle: 'Gold wheels × red pinstripe',
        description:
          'Pearl white paired with gold wheels and a red pinstripe, a nod to the original factory sport package. Limited quantities remain.',
      },
      'zh-CN': {
        name: 'Shiden RS Coupe（珍珠白）',
        subtitle: '金色轮框 × 红色腰线',
        description:
          '珍珠白车身配上金色轮框与红色腰线，致敬当年的原厂运动套件。这个配色存量不多，喜欢请把握。',
      },
    },
  },
  {
    slug: 'kaminari-type-s-championship-white',
    sku: 'KZ-64-010',
    brand: 'kaze-models',
    category: 'jdm',
    scale: '1:64',
    price: 380,
    stock: 36,
    specs: { ...DIECAST_64, edition: 'Regular' },
    art: {
      style: 'hatch',
      body: '#f2f2ef',
      rim: '#e8b923',
      livery: 'side-stripe',
      accent: '#d7262e',
    },
    copy: {
      'zh-TW': {
        name: 'Kaminari Type-S（冠軍白）',
        subtitle: '輕量掀背的熱血原點',
        description: '冠軍白車身、紅色腰線、金色輪框，三個元素就說完了這台輕量掀背的熱血個性。',
      },
      en: {
        name: 'Kaminari Type-S — Championship White',
        subtitle: 'Where the lightweight hatch legend began',
        description:
          'Championship white, a red stripe and gold wheels — three details that say everything about this featherweight hot hatch.',
      },
      'zh-CN': {
        name: 'Kaminari Type-S（冠军白）',
        subtitle: '轻量掀背的热血原点',
        description: '冠军白车身、红色腰线、金色轮框，三个元素就说完了这台轻量掀背的热血个性。',
      },
    },
  },
  {
    slug: 'sakura-kei-van-89',
    sku: 'KZ-64-020',
    brand: 'kaze-models',
    category: 'kei-van',
    scale: '1:64',
    price: 350,
    stock: 60,
    specs: { ...DIECAST_64, edition: 'Regular' },
    art: { style: 'van', body: '#f4b6c2', livery: 'two-tone', accent: '#f8f4ec' },
    copy: {
      'zh-TW': {
        name: "Sakura Kei Van '89（櫻花粉）",
        subtitle: '昭和末期的可愛小廂型車',
        description:
          '櫻花粉與奶油白雙色塗裝，方正車身配上大面積車窗，放在展示櫃裡就是一道療癒風景。',
      },
      en: {
        name: "Sakura Kei Van '89 — Blossom Pink",
        subtitle: 'A charming late-Showa microvan',
        description:
          'Two-tone blossom pink and cream on a boxy body with big glass — a little dose of calm for any display shelf.',
      },
      'zh-CN': {
        name: "Sakura Kei Van '89（樱花粉）",
        subtitle: '昭和末期的可爱小厢型车',
        description:
          '樱花粉与奶油白双色涂装，方正车身配上大面积车窗，放在展示柜里就是一道治愈风景。',
      },
    },
  },
  {
    slug: 'raiden-grand-tourer-1-43',
    sku: 'KZ-43-001',
    brand: 'kaze-models',
    category: 'jdm',
    scale: '1:43',
    price: 2280,
    stock: 12,
    specs: { ...DIECAST_43, edition: '1,500 pcs', features: 'Opening doors' },
    art: { style: 'gt', body: '#8f1d21', rim: '#2a2a2e' },
    copy: {
      'zh-TW': {
        name: 'Raiden Grand Tourer 1:43（深紅）',
        subtitle: '可開啟車門的長途旅行跑車',
        description:
          '1:43 合金車身，雙側車門可開啟、內裝細節完整。深紅烤漆配黑色輪框，全球限量 1,500 台。',
      },
      en: {
        name: 'Raiden Grand Tourer 1:43 — Deep Crimson',
        subtitle: 'Long-distance GT with opening doors',
        description:
          'A 1:43 die-cast body with opening doors and a fully detailed interior. Deep crimson with black wheels, limited to 1,500 pieces worldwide.',
      },
      'zh-CN': {
        name: 'Raiden Grand Tourer 1:43（深红）',
        subtitle: '可开启车门的长途旅行跑车',
        description:
          '1:43 合金车身，双侧车门可开启、内饰细节完整。深红烤漆配黑色轮框，全球限量 1,500 台。',
      },
    },
  },
  {
    slug: 'shiden-rs-coupe-1-18-signature',
    sku: 'KZ-18-001',
    brand: 'kaze-models',
    category: 'jdm',
    scale: '1:18',
    price: 6980,
    stock: 80,
    saleType: 'PRE_ORDER',
    releaseInHours: -72,
    preorderClosesInDays: 20,
    expectedShipInDays: 75,
    purchaseLimit: 2,
    isFeatured: true,
    specs: { ...RESIN_18, edition: '800 pcs', features: 'Numbered certificate' },
    art: { style: 'coupe', body: '#4b2a7a', rim: '#c9ccd1', background: ['#f3f1f7', '#dcd8e6'] },
    copy: {
      'zh-TW': {
        name: 'Shiden RS Coupe 1:18 簽名版',
        subtitle: '預購｜全球 800 台・附編號證書',
        description:
          '首度推出 1:18 大比例，樹脂車身精雕每一道鈑件縫隙，附設計師簽名編號證書與皮革底座展示盒。',
      },
      en: {
        name: 'Shiden RS Coupe 1:18 Signature Edition',
        subtitle: 'Pre-order · 800 pcs worldwide · numbered certificate',
        description:
          'Our first 1:18 release. A resin body sculpted down to every panel gap, delivered with a designer-signed numbered certificate and a leather-based display case.',
      },
      'zh-CN': {
        name: 'Shiden RS Coupe 1:18 签名版',
        subtitle: '预购｜全球 800 台・附编号证书',
        description:
          '首度推出 1:18 大比例，树脂车身精雕每一道钣件缝隙，附设计师签名编号证书与皮革底座展示盒。',
      },
    },
  },

  // ── Apex Miniatures ──
  {
    slug: 'thunder-valley-69-fastback-hugger-orange',
    sku: 'AX-64-101',
    brand: 'apex-miniatures',
    category: 'american',
    scale: '1:64',
    price: 450,
    stock: 30,
    isFeatured: true,
    specs: { ...DIECAST_64, edition: 'Regular' },
    art: { style: 'muscle', body: '#e0661b', livery: 'stripes', accent: '#111111' },
    copy: {
      'zh-TW': {
        name: "Thunder Valley '69 Fastback（亮橘）",
        subtitle: '黑色雙側條紋的經典肌肉車',
        description:
          '亮橘車身搭黑色雙側條紋，長車頭、短車尾的比例完美呈現 60 年代末的美式肌肉車精神。',
      },
      en: {
        name: "Thunder Valley '69 Fastback — Hugger Orange",
        subtitle: 'Classic muscle with twin side stripes',
        description:
          'Bright orange with twin black side stripes. The long-hood, short-deck stance captures late-60s American muscle perfectly.',
      },
      'zh-CN': {
        name: "Thunder Valley '69 Fastback（亮橘）",
        subtitle: '黑色双侧条纹的经典肌肉车',
        description:
          '亮橘车身搭黑色双侧条纹，长车头、短车尾的比例完美呈现 60 年代末的美式肌肉车精神。',
      },
    },
  },
  {
    slug: 'thunder-valley-69-fastback-raven-black',
    sku: 'AX-64-102',
    brand: 'apex-miniatures',
    category: 'american',
    scale: '1:64',
    price: 450,
    stock: 0,
    specs: { ...DIECAST_64, edition: 'Regular' },
    art: { style: 'muscle', body: '#151517', livery: 'stripes', accent: '#c9a227', rim: '#c9a227' },
    copy: {
      'zh-TW': {
        name: "Thunder Valley '69 Fastback（渡鴉黑）",
        subtitle: '黑金配色・已售完',
        description: '渡鴉黑車身搭配金色條紋與輪框，上市一週即售完，補貨消息請加入願望清單。',
      },
      en: {
        name: "Thunder Valley '69 Fastback — Raven Black",
        subtitle: 'Black & gold · sold out',
        description:
          'Raven black with gold stripes and wheels — sold out within a week of launch. Add it to your wishlist for restock news.',
      },
      'zh-CN': {
        name: "Thunder Valley '69 Fastback（渡鸦黑）",
        subtitle: '黑金配色・已售完',
        description: '渡鸦黑车身搭配金色条纹与轮框，上市一周即售完，补货消息请加入愿望清单。',
      },
    },
  },
  {
    slug: 'big-sky-pickup-78',
    sku: 'AX-64-201',
    brand: 'apex-miniatures',
    category: 'trucks',
    scale: '1:64',
    price: 480,
    stock: 25,
    specs: { ...DIECAST_64, edition: 'Regular' },
    art: { style: 'pickup', body: '#2f5d8a', livery: 'two-tone', accent: '#efe6cf' },
    copy: {
      'zh-TW': {
        name: "Big Sky Pickup '78（湖水藍 × 米白）",
        subtitle: '70 年代牧場風雙色皮卡',
        description: '湖水藍與米白的雙色塗裝，加長貨斗與鍍鉻保險桿，滿滿的 70 年代牧場風情。',
      },
      en: {
        name: "Big Sky Pickup '78 — Lake Blue & Cream",
        subtitle: '70s ranch-style two-tone pickup',
        description:
          'Lake blue over cream with a long bed and chrome bumpers — pure 70s ranch character.',
      },
      'zh-CN': {
        name: "Big Sky Pickup '78（湖水蓝 × 米白）",
        subtitle: '70 年代牧场风双色皮卡',
        description: '湖水蓝与米白的双色涂装，加长货斗与镀铬保险杠，满满的 70 年代牧场风情。',
      },
    },
  },
  {
    slug: 'vortex-gt3-clubsport',
    sku: 'AX-64-301',
    brand: 'apex-miniatures',
    category: 'euro',
    scale: '1:64',
    price: 520,
    stock: 18,
    specs: { ...DIECAST_64, edition: 'Regular' },
    art: { style: 'gt', body: '#c0c4c8', livery: 'stripes', accent: '#1d3f8f', rim: '#2a2a2e' },
    copy: {
      'zh-TW': {
        name: 'Vortex GT3 Clubsport（銀 × 藍條紋）',
        subtitle: '賽道日的街道版本',
        description:
          '銀色車身、藍色雙側條紋與黑色輪框，低趴車身與寬體輪拱，帶著賽道血統的街道性能車。',
      },
      en: {
        name: 'Vortex GT3 Clubsport — Silver & Blue',
        subtitle: 'The road-going track-day weapon',
        description:
          'Silver with twin blue side stripes and black wheels. A low stance and wide arches reveal its racing pedigree.',
      },
      'zh-CN': {
        name: 'Vortex GT3 Clubsport（银 × 蓝条纹）',
        subtitle: '赛道日的街道版本',
        description:
          '银色车身、蓝色双侧条纹与黑色轮框，低趴车身与宽体轮拱，带着赛道血统的街道性能车。',
      },
    },
  },
  {
    slug: 'thunder-valley-69-fastback-1-18',
    sku: 'AX-18-101',
    brand: 'apex-miniatures',
    category: 'american',
    scale: '1:18',
    price: 5880,
    stock: 6,
    specs: { ...RESIN_18, edition: '1,200 pcs', features: 'Detailed engine bay' },
    art: {
      style: 'muscle',
      body: '#e0661b',
      livery: 'stripes',
      accent: '#111111',
      background: ['#f7f3ef', '#e6ddd3'],
    },
    copy: {
      'zh-TW': {
        name: "Thunder Valley '69 Fastback 1:18",
        subtitle: '大比例・引擎室完整重現',
        description: '1:18 大比例，引擎室管線與底盤細節完整重現。限量 1,200 台，附皮革底座展示盒。',
      },
      en: {
        name: "Thunder Valley '69 Fastback 1:18",
        subtitle: 'Large scale · fully detailed engine bay',
        description:
          'A 1:18 showpiece with a fully plumbed engine bay and chassis detail. Limited to 1,200 pieces, in a leather-based display case.',
      },
      'zh-CN': {
        name: "Thunder Valley '69 Fastback 1:18",
        subtitle: '大比例・引擎室完整重现',
        description: '1:18 大比例，引擎室管线与底盘细节完整重现。限量 1,200 台，附皮革底座展示盒。',
      },
    },
  },
  {
    slug: 'vortex-gt3-liquid-chrome',
    sku: 'AX-64-399',
    brand: 'apex-miniatures',
    category: 'euro',
    scale: '1:64',
    price: 890,
    stock: 300,
    saleType: 'LIMITED',
    releaseInHours: 50,
    earlyAccess: { tier: 'DRIVER', minutesBefore: 60 },
    purchaseLimit: 2,
    isFeatured: true,
    specs: { ...DIECAST_64, edition: '300 pcs', features: 'Chrome plating' },
    art: {
      style: 'gt',
      body: '#d9dde2',
      rim: '#111111',
      livery: 'side-stripe',
      accent: '#7a7f87',
      background: ['#eef1f5', '#d3d9e2'],
    },
    copy: {
      'zh-TW': {
        name: 'Vortex GT3「液態鉻」收藏家版',
        subtitle: '限量發售｜全球 300 台・每人限購 2 台',
        description:
          '全車電鍍鉻面處理，鏡面般的反光讓每一道車身曲線都清晰可見。開賣時間一到才能下單，售完不補。',
      },
      en: {
        name: "Vortex GT3 'Liquid Chrome' Collector Edition",
        subtitle: 'Limited drop · 300 pcs · max 2 per member',
        description:
          'Fully chrome-plated so every curve reads like a mirror. Orders open at drop time only — no restocks once it is gone.',
      },
      'zh-CN': {
        name: 'Vortex GT3「液态铬」收藏家版',
        subtitle: '限量发售｜全球 300 台・每人限购 2 台',
        description:
          '全车电镀铬面处理，镜面般的反光让每一道车身曲线都清晰可见。开卖时间一到才能下单，售完不补。',
      },
    },
  },

  // ── Torque Lab ──
  {
    slug: 'atlas-rally-hatch-21',
    sku: 'TL-64-021',
    brand: 'torque-lab',
    category: 'rally',
    scale: '1:64',
    price: 560,
    stock: 200,
    saleType: 'PRE_ORDER',
    releaseInHours: -24,
    preorderClosesInDays: 12,
    expectedShipInDays: 45,
    purchaseLimit: 3,
    specs: { ...DIECAST_64, edition: 'Pre-order', features: 'Roof spoiler & mud flaps' },
    art: {
      style: 'hatch',
      body: '#f2f2ef',
      livery: 'race',
      accent: '#d7262e',
      number: 21,
      rim: '#e8b923',
      wing: true,
    },
    copy: {
      'zh-TW': {
        name: 'Atlas Rally Hatch #21',
        subtitle: '預購中｜冬季拉力賽冠軍車',
        description:
          '重現冬季拉力賽奪冠車的紅白彩繪，加上車頂擾流與擋泥板。預購期間每人限購 3 台。',
      },
      en: {
        name: 'Atlas Rally Hatch #21',
        subtitle: 'Pre-order · Winter rally champion',
        description:
          'The red-and-white livery of the winter rally winner, complete with roof spoiler and mud flaps. Limit 3 per member during pre-order.',
      },
      'zh-CN': {
        name: 'Atlas Rally Hatch #21',
        subtitle: '预购中｜冬季拉力赛冠军车',
        description:
          '重现冬季拉力赛夺冠车的红白彩绘，加上车顶扰流与挡泥板。预购期间每人限购 3 台。',
      },
    },
  },
  {
    slug: 'kestrel-touring-car-33',
    sku: 'TL-64-033',
    brand: 'torque-lab',
    category: 'touring',
    scale: '1:64',
    price: 520,
    stock: 22,
    specs: { ...DIECAST_64, edition: 'Regular' },
    art: { style: 'sedan', body: '#1d4e89', livery: 'race', accent: '#f2c014', number: 33 },
    copy: {
      'zh-TW': {
        name: 'Kestrel Touring Car #33',
        subtitle: '藍黃經典房車賽塗裝',
        description: '藍色車身與黃色斜紋的經典房車賽塗裝，四門房車的實用外型下藏著賽道靈魂。',
      },
      en: {
        name: 'Kestrel Touring Car #33',
        subtitle: 'Classic blue & yellow touring livery',
        description:
          'Blue with yellow diagonal flashes — a practical four-door silhouette hiding a racing soul.',
      },
      'zh-CN': {
        name: 'Kestrel Touring Car #33',
        subtitle: '蓝黄经典房车赛涂装',
        description: '蓝色车身与黄色斜纹的经典房车赛涂装，四门房车的实用外型下藏着赛道灵魂。',
      },
    },
  },
  {
    slug: 'kestrel-touring-car-8',
    sku: 'TL-64-008',
    brand: 'torque-lab',
    category: 'touring',
    scale: '1:64',
    price: 520,
    stock: 3,
    specs: { ...DIECAST_64, edition: 'Regular' },
    art: { style: 'sedan', body: '#f2f2ef', livery: 'race', accent: '#0f7b5f', number: 8 },
    copy: {
      'zh-TW': {
        name: 'Kestrel Touring Car #8',
        subtitle: '白綠車隊配色・最後幾台',
        description: '白色車身搭配墨綠斜紋，這是車隊二號車的塗裝，數量稀少。',
      },
      en: {
        name: 'Kestrel Touring Car #8',
        subtitle: 'White & green team colours · last few',
        description:
          'White with deep green flashes — the team’s second car, produced in small numbers.',
      },
      'zh-CN': {
        name: 'Kestrel Touring Car #8',
        subtitle: '白绿车队配色・最后几台',
        description: '白色车身搭配墨绿斜纹，这是车队二号车的涂装，数量稀少。',
      },
    },
  },
  {
    slug: 'endurance-legends-gift-box',
    sku: 'TL-SET-001',
    brand: 'torque-lab',
    category: 'sets',
    scale: '1:64',
    price: 1480,
    compareAtPrice: 1680,
    stock: 10,
    specs: { ...DIECAST_64, edition: 'Gift box', features: '3 cars & display base' },
    art: {
      style: 'racer',
      body: '#101014',
      livery: 'race',
      accent: '#e10600',
      number: 1,
      rim: '#c9a227',
      wing: true,
    },
    copy: {
      'zh-TW': {
        name: 'Endurance Legends 三車禮盒',
        subtitle: '三台經典耐力賽車＋展示底座',
        description: '收錄三台耐力賽經典彩繪，附可並排展示的木紋底座，送禮自用都體面。',
      },
      en: {
        name: 'Endurance Legends 3-Car Gift Box',
        subtitle: 'Three endurance icons + display base',
        description:
          'Three classic endurance liveries with a wood-grain base that displays them side by side — a gift that looks the part.',
      },
      'zh-CN': {
        name: 'Endurance Legends 三车礼盒',
        subtitle: '三台经典耐力赛车＋展示底座',
        description: '收录三台耐力赛经典彩绘，附可并排展示的木纹底座，送礼自用都体面。',
      },
    },
  },

  // ── Pit Lane Collectibles ──
  {
    slug: 'comet-lmp-hybrid-7',
    sku: 'PL-43-007',
    brand: 'pit-lane-collectibles',
    category: 'endurance',
    scale: '1:43',
    price: 2680,
    stock: 3,
    saleType: 'LIMITED',
    releaseInHours: -1,
    purchaseLimit: 1,
    isFeatured: true,
    specs: { ...RESIN_43, edition: '500 pcs', features: 'Numbered plinth' },
    art: {
      style: 'racer',
      body: '#101014',
      livery: 'race',
      accent: '#18c3a0',
      number: 7,
      rim: '#c9a227',
      wing: true,
      background: ['#eef3f2', '#d2dfdc'],
    },
    copy: {
      'zh-TW': {
        name: 'Comet LMP Hybrid #7',
        subtitle: '限量發售中｜24 小時耐力賽冠軍・每人限購 1 台',
        description:
          '黑色碳纖維車身配上薄荷綠斜紋，重現奪下 24 小時耐力賽總冠軍的原車。全球 500 台，附編號底座。',
      },
      en: {
        name: 'Comet LMP Hybrid #7',
        subtitle: 'Drop live · 24-hour race winner · max 1 per member',
        description:
          'Black carbon bodywork with mint-green flashes, recreating the outright 24-hour race winner. 500 pieces worldwide on a numbered plinth.',
      },
      'zh-CN': {
        name: 'Comet LMP Hybrid #7',
        subtitle: '限量发售中｜24 小时耐力赛冠军・每人限购 1 台',
        description:
          '黑色碳纤维车身配上薄荷绿斜纹，重现夺下 24 小时耐力赛总冠军的原车。全球 500 台，附编号底座。',
      },
    },
  },
  {
    slug: 'comet-lmp-hybrid-8',
    sku: 'PL-43-008',
    brand: 'pit-lane-collectibles',
    category: 'endurance',
    scale: '1:43',
    price: 2680,
    stock: 500,
    saleType: 'LIMITED',
    releaseInHours: 146,
    earlyAccess: { tier: 'CHAMPION', minutesBefore: 30 },
    purchaseLimit: 1,
    specs: { ...RESIN_43, edition: '500 pcs', features: 'Numbered plinth' },
    art: {
      style: 'racer',
      body: '#f2f2ef',
      livery: 'race',
      accent: '#e10600',
      number: 8,
      rim: '#2a2a2e',
      wing: true,
    },
    copy: {
      'zh-TW': {
        name: 'Comet LMP Hybrid #8',
        subtitle: '即將發售｜姊妹車・每人限購 1 台',
        description:
          '冠軍車隊的姊妹車，白色車身與紅色斜紋。開賣前可先加入願望清單，開賣時收到通知。',
      },
      en: {
        name: 'Comet LMP Hybrid #8',
        subtitle: 'Coming soon · sister car · max 1 per member',
        description:
          'The winning team’s sister car in white with red flashes. Add it to your wishlist to be notified when the drop opens.',
      },
      'zh-CN': {
        name: 'Comet LMP Hybrid #8',
        subtitle: '即将发售｜姊妹车・每人限购 1 台',
        description:
          '冠军车队的姊妹车，白色车身与红色斜纹。开卖前可先加入愿望清单，开卖时收到通知。',
      },
    },
  },
  {
    slug: 'vortex-gt3-r-24-1-18',
    sku: 'PL-18-024',
    brand: 'pit-lane-collectibles',
    category: 'endurance',
    scale: '1:18',
    price: 8800,
    stock: 40,
    saleType: 'PRE_ORDER',
    releaseInHours: -48,
    preorderClosesInDays: 30,
    expectedShipInDays: 120,
    purchaseLimit: 1,
    specs: { ...RESIN_18, edition: '300 pcs', features: 'Numbered certificate' },
    art: {
      style: 'gt',
      body: '#f2c014',
      livery: 'race',
      accent: '#111111',
      number: 24,
      rim: '#111111',
    },
    copy: {
      'zh-TW': {
        name: 'Vortex GT3 R #24 1:18',
        subtitle: '預購｜大比例耐力賽車・全球 300 台',
        description:
          '亮黃車身配黑色斜紋，1:18 樹脂車身與完整座艙細節。預購名額有限，預計 4 個月後出貨。',
      },
      en: {
        name: 'Vortex GT3 R #24 1:18',
        subtitle: 'Pre-order · large-scale endurance racer · 300 pcs',
        description:
          'Bright yellow with black flashes, a 1:18 resin body and full cockpit detail. Limited pre-order allocation, shipping in about four months.',
      },
      'zh-CN': {
        name: 'Vortex GT3 R #24 1:18',
        subtitle: '预购｜大比例耐力赛车・全球 300 台',
        description:
          '亮黄车身配黑色斜纹，1:18 树脂车身与完整座舱细节。预购名额有限，预计 4 个月后出货。',
      },
    },
  },
  {
    slug: 'comet-lmp-2-1-64',
    sku: 'PL-64-002',
    brand: 'pit-lane-collectibles',
    category: 'endurance',
    scale: '1:64',
    price: 590,
    stock: 26,
    specs: { ...DIECAST_64, edition: 'Regular' },
    art: {
      style: 'racer',
      body: '#0b3d91',
      livery: 'race',
      accent: '#ffffff',
      number: 2,
      wing: true,
    },
    copy: {
      'zh-TW': {
        name: 'Comet LMP #2 1:64',
        subtitle: '入門價格的原型賽車',
        description: '深藍車身與白色斜紋，原型賽車的低趴線條縮小到 1:64，入門耐力賽收藏的好選擇。',
      },
      en: {
        name: 'Comet LMP #2 1:64',
        subtitle: 'A prototype racer at an entry-level price',
        description:
          'Deep blue with white flashes — prototype racer lines shrunk to 1:64, an easy way into endurance collecting.',
      },
      'zh-CN': {
        name: 'Comet LMP #2 1:64',
        subtitle: '入门价格的原型赛车',
        description: '深蓝车身与白色斜纹，原型赛车的低趴线条缩小到 1:64，入门耐力赛收藏的好选择。',
      },
    },
  },

  // ── Formosa Diecast ──
  {
    slug: 'formosa-taxi-95',
    sku: 'FD-64-001',
    brand: 'formosa-diecast',
    category: 'city',
    scale: '1:64',
    price: 399,
    stock: 120,
    isFeatured: true,
    specs: { ...DIECAST_64, edition: 'Regular' },
    art: { style: 'sedan', body: '#f3c623', livery: 'taxi' },
    copy: {
      'zh-TW': {
        name: "Formosa Taxi '95",
        subtitle: '台灣街頭最熟悉的小黃',
        description:
          '黃色車身、黑白格紋與車頂燈，九〇年代的台灣小黃。放在桌上，好像隨時會有人揮手攔車。',
      },
      en: {
        name: "Formosa Taxi '95",
        subtitle: 'The yellow cab of every Taiwanese street',
        description:
          'Yellow paint, a checkered band and a roof sign — the 90s Taiwanese taxi. Put it on your desk and someone will try to hail it.',
      },
      'zh-CN': {
        name: "Formosa Taxi '95",
        subtitle: '台湾街头最熟悉的小黄',
        description:
          '黄色车身、黑白格纹与车顶灯，九〇年代的台湾小黄。放在桌上，好像随时会有人挥手拦车。',
      },
    },
  },
  {
    slug: 'formosa-night-market-food-truck',
    sku: 'FD-64-010',
    brand: 'formosa-diecast',
    category: 'city',
    scale: '1:64',
    price: 429,
    stock: 55,
    specs: { ...DIECAST_64, edition: 'Regular' },
    art: { style: 'van', body: '#c8102e', livery: 'two-tone', accent: '#f4d35e', rim: '#d6d8dc' },
    copy: {
      'zh-TW': {
        name: '夜市餐車',
        subtitle: '紅黃配色的宵夜回憶',
        description:
          '紅色車身配上暖黃下半部，像極了巷口那台賣雞排的餐車。台灣在地題材，送外國朋友也很適合。',
      },
      en: {
        name: 'Night Market Food Truck',
        subtitle: 'Red & yellow late-night memories',
        description:
          'Red over warm yellow — just like the fried-chicken truck around the corner. A Taiwanese icon and a great gift for friends abroad.',
      },
      'zh-CN': {
        name: '夜市餐车',
        subtitle: '红黄配色的宵夜回忆',
        description:
          '红色车身配上暖黄下半部，像极了巷口那台卖鸡排的餐车。台湾在地题材，送外国朋友也很适合。',
      },
    },
  },
  {
    slug: 'formosa-kei-truck-hualien',
    sku: 'FD-64-020',
    brand: 'formosa-diecast',
    category: 'trucks',
    scale: '1:64',
    price: 369,
    stock: 0,
    specs: { ...DIECAST_64, edition: 'Regular' },
    art: { style: 'pickup', body: '#7fb069', rim: '#d6d8dc' },
    copy: {
      'zh-TW': {
        name: '花東小貨卡',
        subtitle: '果農的好夥伴・已售完',
        description: '草綠色小貨卡，載過無數箱文旦與鳳梨。第一批已售完，第二批生產中。',
      },
      en: {
        name: 'East Coast Kei Truck',
        subtitle: "A fruit farmer's best friend · sold out",
        description:
          'A grass-green kei truck that has hauled countless crates of pomelos and pineapples. First batch sold out; the second is in production.',
      },
      'zh-CN': {
        name: '花东小货卡',
        subtitle: '果农的好伙伴・已售完',
        description: '草绿色小货卡，载过无数箱文旦与凤梨。第一批已售完，第二批生产中。',
      },
    },
  },
  {
    slug: 'formosa-taxi-gift-box',
    sku: 'FD-SET-001',
    brand: 'formosa-diecast',
    category: 'sets',
    scale: '1:64',
    price: 899,
    compareAtPrice: 998,
    stock: 15,
    specs: { ...DIECAST_64, edition: 'Gift box', features: '2 cars & city backdrop card' },
    art: { style: 'sedan', body: '#f3c623', livery: 'taxi', background: ['#fbf6e4', '#efe2b6'] },
    copy: {
      'zh-TW': {
        name: '台灣小黃紀念禮盒',
        subtitle: '兩台計程車＋城市街景背卡',
        description: '收錄新舊兩代計程車，附台北街景背卡，是最有台灣味的收藏禮物。',
      },
      en: {
        name: 'Taiwan Taxi Gift Box',
        subtitle: 'Two taxis + a city backdrop card',
        description:
          'Two generations of taxi with a Taipei street-scene backdrop — the most Taiwanese gift in our range.',
      },
      'zh-CN': {
        name: '台湾小黄纪念礼盒',
        subtitle: '两台出租车＋城市街景背卡',
        description: '收录新旧两代出租车，附台北街景背卡，是最有台湾味的收藏礼物。',
      },
    },
  },
  {
    slug: 'formosa-taxi-95-1-43',
    sku: 'FD-43-001',
    brand: 'formosa-diecast',
    category: 'city',
    scale: '1:43',
    price: 1880,
    stock: 150,
    saleType: 'PRE_ORDER',
    releaseInHours: -6,
    preorderClosesInDays: 25,
    expectedShipInDays: 60,
    specs: { ...DIECAST_43, edition: 'Pre-order', features: 'Light-up roof sign' },
    art: { style: 'sedan', body: '#f3c623', livery: 'taxi', background: ['#fbf6e4', '#efe2b6'] },
    copy: {
      'zh-TW': {
        name: "Formosa Taxi '95 1:43",
        subtitle: '預購｜車頂燈可發光',
        description: '人氣小黃推出 1:43 大比例，車頂燈內建 LED 可發光，預計兩個月後出貨。',
      },
      en: {
        name: "Formosa Taxi '95 1:43",
        subtitle: 'Pre-order · light-up roof sign',
        description:
          'Our best-selling taxi in 1:43, with an LED roof sign that lights up. Ships in about two months.',
      },
      'zh-CN': {
        name: "Formosa Taxi '95 1:43",
        subtitle: '预购｜车顶灯可发光',
        description: '人气小黄推出 1:43 大比例，车顶灯内建 LED 可发光，预计两个月后出货。',
      },
    },
  },

  // ── Nordline Scale ──
  {
    slug: 'nordic-arrow-roadster-silver',
    sku: 'NS-43-001',
    brand: 'nordline-scale',
    category: 'euro',
    scale: '1:43',
    price: 1980,
    stock: 9,
    specs: { ...DIECAST_43, edition: '2,000 pcs' },
    art: { style: 'coupe', body: '#c0c4c8', rim: '#8a8f96' },
    copy: {
      'zh-TW': {
        name: 'Nordic Arrow Roadster（極地銀）',
        subtitle: '北歐極簡的優雅',
        description: '極地銀烤漆搭配灰色輪框，沒有多餘裝飾，只有乾淨俐落的線條。',
      },
      en: {
        name: 'Nordic Arrow Roadster — Arctic Silver',
        subtitle: 'Nordic minimalism, elegantly done',
        description:
          'Arctic silver with grey wheels — no decoration, just clean and confident lines.',
      },
      'zh-CN': {
        name: 'Nordic Arrow Roadster（极地银）',
        subtitle: '北欧极简的优雅',
        description: '极地银烤漆搭配灰色轮框，没有多余装饰，只有干净利落的线条。',
      },
    },
  },
  {
    slug: 'stella-turbo-72-tangerine',
    sku: 'NS-64-072',
    brand: 'nordline-scale',
    category: 'euro',
    scale: '1:64',
    price: 460,
    stock: 33,
    specs: { ...DIECAST_64, edition: 'Regular' },
    art: { style: 'coupe', body: '#f28c28', livery: 'side-stripe', accent: '#111111' },
    copy: {
      'zh-TW': {
        name: "Stella Turbo '72（橘子橙）",
        subtitle: '70 年代渦輪跑車',
        description: '飽和的橘子橙車身與黑色腰線，70 年代渦輪時代最有活力的配色。',
      },
      en: {
        name: "Stella Turbo '72 — Tangerine",
        subtitle: 'A 70s turbo coupe',
        description:
          'Saturated tangerine with a black pinstripe — the most energetic colourway of the early turbo era.',
      },
      'zh-CN': {
        name: "Stella Turbo '72（橘子橙）",
        subtitle: '70 年代涡轮跑车',
        description: '饱和的橘子橙车身与黑色腰线，70 年代涡轮时代最有活力的配色。',
      },
    },
  },
  {
    slug: 'fjord-estate-86',
    sku: 'NS-64-086',
    brand: 'nordline-scale',
    category: 'euro',
    scale: '1:64',
    price: 430,
    stock: 27,
    specs: { ...DIECAST_64, edition: 'Regular' },
    art: { style: 'sedan', body: '#2d6a4f', rim: '#c9ccd1' },
    copy: {
      'zh-TW': {
        name: "Fjord Estate '86（森林綠）",
        subtitle: '北歐家庭的移動客廳',
        description: '森林綠四門房車，方正可靠的造型，是許多北歐家庭的共同回憶。',
      },
      en: {
        name: "Fjord Estate '86 — Forest Green",
        subtitle: 'The Nordic family living room on wheels',
        description:
          'A forest-green four-door — boxy, dependable and a shared memory for many Nordic families.',
      },
      'zh-CN': {
        name: "Fjord Estate '86（森林绿）",
        subtitle: '北欧家庭的移动客厅',
        description: '森林绿四门房车，方正可靠的造型，是许多北欧家庭的共同回忆。',
      },
    },
  },
  {
    slug: 'stella-turbo-72-rally-5',
    sku: 'NS-64-075',
    brand: 'nordline-scale',
    category: 'rally',
    scale: '1:64',
    price: 480,
    stock: 0,
    specs: { ...DIECAST_64, edition: 'Regular' },
    art: {
      style: 'coupe',
      body: '#f2f2ef',
      livery: 'race',
      accent: '#005baa',
      number: 5,
      wing: true,
    },
    copy: {
      'zh-TW': {
        name: "Stella Turbo '72 Rally #5",
        subtitle: '雪地拉力版・已售完',
        description:
          '白藍拉力彩繪加上尾翼，北歐雪地拉力賽的經典畫面。已售完，可加入願望清單等待補貨。',
      },
      en: {
        name: "Stella Turbo '72 Rally #5",
        subtitle: 'Snow rally edition · sold out',
        description:
          'White and blue rally livery with a rear wing — a classic Nordic snow-stage image. Sold out; wishlist it for restock news.',
      },
      'zh-CN': {
        name: "Stella Turbo '72 Rally #5",
        subtitle: '雪地拉力版・已售完',
        description:
          '白蓝拉力彩绘加上尾翼，北欧雪地拉力赛的经典画面。已售完，可加入愿望清单等待补货。',
      },
    },
  },
  {
    slug: 'scandinavian-classics-set',
    sku: 'NS-SET-001',
    brand: 'nordline-scale',
    category: 'sets',
    scale: '1:64',
    price: 1280,
    compareAtPrice: 1370,
    stock: 2,
    specs: { ...DIECAST_64, edition: 'Gift box', features: '3 cars' },
    art: { style: 'sedan', body: '#2d6a4f', background: ['#eef3ef', '#d4e0d7'] },
    copy: {
      'zh-TW': {
        name: '北歐經典三車組',
        subtitle: '房車、跑車、旅行車一次收齊',
        description: '一次收齊 Nordline 最受歡迎的三款北歐經典，附可回收紙材展示盒。最後兩組。',
      },
      en: {
        name: 'Scandinavian Classics 3-Car Set',
        subtitle: 'Sedan, coupe and estate in one box',
        description:
          "Nordline's three most-loved Nordic classics in one recyclable display box. Only two sets left.",
      },
      'zh-CN': {
        name: '北欧经典三车组',
        subtitle: '房车、跑车、旅行车一次收齐',
        description: '一次收齐 Nordline 最受欢迎的三款北欧经典，附可回收纸材展示盒。最后两组。',
      },
    },
  },

  // ── 後台示範：草稿與已下架 ──
  {
    slug: 'shiden-rs-coupe-racing-blue',
    sku: 'KZ-64-003',
    brand: 'kaze-models',
    category: 'jdm',
    scale: '1:64',
    price: 420,
    stock: 0,
    status: 'DRAFT',
    specs: { ...DIECAST_64, edition: 'Regular' },
    art: { style: 'coupe', body: '#1f4fa3', rim: '#d6d8dc' },
    copy: {
      'zh-TW': {
        name: 'Shiden RS Coupe（賽道藍）',
        subtitle: '草稿：明年第一季上市',
        description: '新配色規劃中。',
      },
      en: {
        name: 'Shiden RS Coupe — Racing Blue',
        subtitle: 'Draft: planned for Q1',
        description: 'New colourway in planning.',
      },
      'zh-CN': {
        name: 'Shiden RS Coupe（赛道蓝）',
        subtitle: '草稿：明年第一季上市',
        description: '新配色规划中。',
      },
    },
  },
  {
    slug: 'kaminari-type-s-sunset-orange',
    sku: 'KZ-64-011',
    brand: 'kaze-models',
    category: 'jdm',
    scale: '1:64',
    price: 380,
    stock: 0,
    status: 'ARCHIVED',
    specs: { ...DIECAST_64, edition: 'Regular' },
    art: { style: 'hatch', body: '#f28c28', rim: '#d6d8dc' },
    copy: {
      'zh-TW': {
        name: 'Kaminari Type-S（夕陽橘）',
        subtitle: '已停產',
        description: '此配色已停產。',
      },
      en: {
        name: 'Kaminari Type-S — Sunset Orange',
        subtitle: 'Discontinued',
        description: 'This colourway has been discontinued.',
      },
      'zh-CN': {
        name: 'Kaminari Type-S（夕阳橘）',
        subtitle: '已停产',
        description: '此配色已停产。',
      },
    },
  },
];
