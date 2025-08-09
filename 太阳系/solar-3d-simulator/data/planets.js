// 实际天文数值（近似或标准值），以及渲染所用的缩放因子。
// 说明：
// - distanceKm: 轨道半长轴（到太阳的平均距离），单位 km
// - radiusKm: 赤道半径，单位 km
// - periodDays: 公转周期，单位 日（地球日）
// 缩放策略在 README 中详述：距离缩放 1e-6，半径缩放 1e-3；太阳额外乘以 0.25 以改善可视视野。

export const SCALE = {
  distance: 1e-6,       // 距离缩放因子：1,000,000:1
  radius: 1e-3,         // 半径缩放因子：1,000:1
  sunRadiusMultiplier: 0.25, // 太阳再缩小 0.25 倍（避免遮挡内轨道）
};

export const SUN = {
  name: '太阳',
  radiusKm: 696340,
  color: '#FDB813',
  infoText: '太阳是太阳系的中心恒星，质量占太阳系总质量的 99.86%。',
  imageUrl: 'auto',
  wikiUrl: 'https://zh.wikipedia.org/wiki/%E5%A4%AA%E9%98%B3',
};

export const PLANETS = [
  {
    name: '水星',
    radiusKm: 2439.7,
    distanceKm: 57909227,
    periodDays: 87.969,
    color: '#b1b1b1',
    infoText: '最内侧、最小的行星，表面布满陨石坑。',
    imageUrl: 'auto',
    wikiUrl: 'https://zh.wikipedia.org/wiki/%E6%B0%B4%E6%98%9F',
  },
  {
    name: '金星',
    radiusKm: 6051.8,
    distanceKm: 108209475,
    periodDays: 224.701,
    color: '#e1c16e',
    infoText: '与地球相似大小，厚重大气导致强烈温室效应。',
    imageUrl: 'auto',
    wikiUrl: 'https://zh.wikipedia.org/wiki/%E9%87%91%E6%98%9F',
  },
  {
    name: '地球',
    radiusKm: 6371.0,
    distanceKm: 149598262,
    periodDays: 365.256,
    color: '#3b82f6',
    infoText: '人类的家园，表面 71% 为海洋覆盖。',
    imageUrl: 'auto',
    wikiUrl: 'https://zh.wikipedia.org/wiki/%E5%9C%B0%E7%90%83',
  },
  {
    name: '火星',
    radiusKm: 3389.5,
    distanceKm: 227943824,
    periodDays: 686.980,
    color: '#ef4444',
    infoText: '红色星球，可能的过去液态水痕迹。',
    imageUrl: 'auto',
    wikiUrl: 'https://zh.wikipedia.org/wiki/%E7%81%AB%E6%98%9F',
  },
  {
    name: '木星',
    radiusKm: 69911,
    distanceKm: 778340821,
    periodDays: 4332.59,
    color: '#d1b185',
    infoText: '太阳系质量最大的行星，拥有著名的大红斑。',
    imageUrl: 'auto',
    wikiUrl: 'https://zh.wikipedia.org/wiki/%E6%9C%A8%E6%98%9F',
  },
  {
    name: '土星',
    radiusKm: 58232,
    distanceKm: 1426666422,
    periodDays: 10759.22,
    color: '#f1d8a7',
    infoText: '拥有壮观的环系统。',
    imageUrl: 'auto',
    wikiUrl: 'https://zh.wikipedia.org/wiki/%E5%9C%9F%E6%98%9F',
  },
  {
    name: '天王星',
    radiusKm: 25362,
    distanceKm: 2870658186,
    periodDays: 30688.5,
    color: '#60a5fa',
    infoText: '自转轴倾角接近 98°，几乎“横躺”绕日公转。',
    imageUrl: 'auto',
    wikiUrl: 'https://zh.wikipedia.org/wiki/%E5%A4%A9%E7%8E%8B%E6%98%9F',
  },
  {
    name: '海王星',
    radiusKm: 24622,
    distanceKm: 4498396441,
    periodDays: 60182,
    color: '#3b82f6',
    infoText: '风速极高的外侧巨行星。',
    imageUrl: 'auto',
    wikiUrl: 'https://zh.wikipedia.org/wiki/%E6%B5%B7%E7%8E%8B%E6%98%9F',
  },
  // 可选：冥王星（非八大行星）
  // {
  //   name: '冥王星',
  //   radiusKm: 1188.3,
  //   distanceKm: 5906440628,
  //   periodDays: 90560,
  //   color: '#cbd5e1',
  //   infoText: '矮行星，柯伊伯带成员。',
  //   imageUrl: 'auto',
  //   wikiUrl: 'https://zh.wikipedia.org/wiki/%E5%86%A5%E7%8E%8B%E6%98%9F',
  // },
];
