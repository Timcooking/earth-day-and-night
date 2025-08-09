// 时间与地理辅助
export function toISODateTimeLocal(date) {
  // 转成 yyyy-MM-ddTHH:mm:ss 方便填入 datetime-local
  const pad = (n) => String(n).padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const H = pad(date.getHours());
  const M = pad(date.getMinutes());
  const S = pad(date.getSeconds());
  return `${y}-${m}-${d}T${H}:${M}:${S}`;
}

export function listIanaTimeZones() {
  // 简化：列常见时区；若浏览器支持 Intl.supportedValuesOf('timeZone') 则使用
  const fallback = [
    'UTC','Europe/London','Europe/Paris','Europe/Moscow','Africa/Cairo',
    'Asia/Dubai','Asia/Tehran','Asia/Karachi','Asia/Kolkata','Asia/Bangkok',
    'Asia/Shanghai','Asia/Tokyo','Australia/Sydney','Pacific/Auckland',
    'America/Sao_Paulo','America/New_York','America/Chicago','America/Denver','America/Los_Angeles'
  ];
  try {
    if (Intl.supportedValuesOf) {
      const v = Intl.supportedValuesOf('timeZone');
      if (v && v.length) return v;
    }
  } catch (e) {}
  return fallback;
}

export function dateWithTimeZone(date, timeZone) {
  // 将本地 Date 映射到指定 IANA 时区的对应“墙上时间”，返回新的 Date（保持同一绝对时刻）
  // 实现：用格式化后的各字段回构 Date
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });
  const parts = fmt.formatToParts(date).reduce((acc, p) => (acc[p.type] = p.value, acc), {});
  const y = parseInt(parts.year, 10);
  const m = parseInt(parts.month, 10);
  const d = parseInt(parts.day, 10);
  const H = parseInt(parts.hour, 10);
  const M = parseInt(parts.minute, 10);
  const S = parseInt(parts.second, 10);
  // 这个时间的“字面值”在本地时区构造，再用时区偏移差异换算回原瞬时
  const local = new Date(y, m - 1, d, H, M, S);
  // local 表示本地时区的该“字面”时刻；我们要找到与 timeZone 显示一致的 UTC
  // 差值 = local 在本地与 date 在 timeZone 的显示差异，但更简单的方式：
  // 使用同样 formatter 对 local 进行格式化若等于原 parts，则 local 对应的绝对时刻就是期望
  // 在不同实现中可能存在夏令时边界复杂性，这里选择近似：返回 new Date(Date.UTC(y, m-1, d, H, M, S))
  // 因为 datetime-local 无时区，后续计算太阳向量以 UTC 为准。
  return new Date(Date.UTC(y, m - 1, d, H, M, S));
}

// 太阳方向估算（简化版）：给定 UTC Date，返回太阳在地心坐标中的方向单位向量。
// 参考 NOAA 简化公式，足够用于实时日夜 terminator 可视化。
export function sunDirectionECI(date) {
  // 计算儒略日
  const JD = (date.getTime() / 86400000) + 2440587.5;
  const T = (JD - 2451545.0) / 36525.0;
  // 太阳平均黄经和均近点角（度）
  const L0 = (280.46646 + 36000.76983 * T + 0.0003032 * T*T) % 360;
  const M = 357.52911 + 35999.05029 * T - 0.0001537 * T*T;
  const Mrad = M * Math.PI / 180;
  // 偏心率修正方程（太阳真黄经）
  const C = (1.914602 - 0.004817 * T - 0.000014 * T*T) * Math.sin(Mrad)
          + (0.019993 - 0.000101 * T) * Math.sin(2*Mrad)
          + 0.000289 * Math.sin(3*Mrad);
  const trueLong = L0 + C; // 太阳真黄经（度）
  // 黄赤交角
  const epsilon = 23.439291 - 0.0130042 * T; // 度
  const eps = epsilon * Math.PI/180;
  const lam = trueLong * Math.PI/180;
  // 单位向量（黄道->赤道）
  const x = Math.cos(lam);
  const y = Math.cos(eps) * Math.sin(lam);
  const z = Math.sin(eps) * Math.sin(lam);
  return { x, y, z };
}

// 将经纬转为三维坐标，半径 r
export function latLonToVec3(lat, lon, r) {
  const phi = (90 - lat) * Math.PI/180;
  const theta = (lon + 180) * Math.PI/180;
  return {
    x: -r * Math.sin(phi) * Math.cos(theta),
    y:  r * Math.cos(phi),
    z:  r * Math.sin(phi) * Math.sin(theta)
  };
}
