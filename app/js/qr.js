/* =========================================================
   مولّد QR داخلي (من غير مكتبات ولا إنترنت) — Byte mode, ECC L/M/Q/H, Versions 1–40
   مبني على خوارزمية Project Nayuki (MIT)
   ========================================================= */
const QR = (() => {
  const ECC = { L: [1, 0], M: [0, 1], Q: [3, 2], H: [2, 3] }; // [formatBits, tableIndex]
  const CW = [
    [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
    [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30]];
  const NB = [
    [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
    [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
    [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
    [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81]];
  const rawModules = (v) => { let r = (16 * v + 128) * v + 64; if (v >= 2) { const n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; } return r; };
  const dataCW = (v, e) => Math.floor(rawModules(v) / 8) - CW[e][v] * NB[e][v];
  const mul = (x, y) => { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11d); z ^= ((y >>> i) & 1) * x; } return z & 0xff; };
  const divisor = (deg) => { const r = new Array(deg).fill(0); r[deg - 1] = 1; let root = 1; for (let i = 0; i < deg; i++) { for (let j = 0; j < r.length; j++) { r[j] = mul(r[j], root); if (j + 1 < r.length) r[j] ^= r[j + 1]; } root = mul(root, 0x02); } return r; };
  const remainder = (data, div) => { const r = div.map(() => 0); for (const b of data) { const f = b ^ r.shift(); r.push(0); div.forEach((c, i) => (r[i] ^= mul(c, f))); } return r; };

  function encode(text, ecl = 'M') {
    const bytes = Array.from(new TextEncoder().encode(String(text)));
    const [fmt, e] = ECC[ecl] || ECC.M;
    let ver = 1, cap;
    for (; ver <= 40; ver++) { cap = dataCW(ver, e) * 8; const need = 4 + (ver <= 9 ? 8 : 16) + bytes.length * 8; if (need <= cap) break; }
    if (ver > 40) throw new Error('QR: data too long');
    const bits = []; const put = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    put(4, 4); put(bytes.length, ver <= 9 ? 8 : 16); bytes.forEach((b) => put(b, 8));
    put(0, Math.min(4, cap - bits.length)); put(0, (8 - (bits.length % 8)) % 8);
    for (let p = 0xec; bits.length < cap; p ^= 0xec ^ 0x11) put(p, 8);
    const data = []; for (let i = 0; i < bits.length; i += 8) { let b = 0; for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j]; data.push(b); }
    // ECC + interleave
    const nb = NB[e][ver], ecLen = CW[e][ver], raw = Math.floor(rawModules(ver) / 8), nShort = nb - (raw % nb), shortLen = Math.floor(raw / nb);
    const div = divisor(ecLen); const blocks = [];
    for (let i = 0, k = 0; i < nb; i++) { const dat = data.slice(k, k + shortLen - ecLen + (i < nShort ? 0 : 1)); k += dat.length; const ec = remainder(dat, div); if (i < nShort) dat.push(0); blocks.push(dat.concat(ec)); }
    const all = []; for (let i = 0; i < blocks[0].length; i++) blocks.forEach((b, j) => { if (i !== shortLen - ecLen || j >= nShort) all.push(b[i]); });
    // matrix
    const size = ver * 4 + 17; const M = Array.from({ length: size }, () => new Array(size).fill(false)); const F = Array.from({ length: size }, () => new Array(size).fill(false));
    const set = (x, y, d) => { M[y][x] = d; F[y][x] = true; };
    for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    const finder = (x, y) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const d = Math.max(Math.abs(dx), Math.abs(dy)), xx = x + dx, yy = y + dy; if (xx >= 0 && xx < size && yy >= 0 && yy < size) set(xx, yy, d !== 2 && d !== 4); } };
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    const al = (() => { if (ver === 1) return []; const n = Math.floor(ver / 7) + 2; const step = ver === 32 ? 26 : Math.floor((ver * 4 + n * 2 + 1) / (n * 2 - 2)) * 2; const r = [6]; for (let p = size - 7; r.length < n; p -= step) r.splice(1, 0, p); return r; })();
    al.forEach((ax, i) => al.forEach((ay, j) => { if ((i === 0 && j === 0) || (i === 0 && j === al.length - 1) || (i === al.length - 1 && j === 0)) return; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1); }));
    const drawFormat = (mask) => {
      const d = (fmt << 3) | mask; let r = d; for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537); const b = ((d << 10) | r) ^ 0x5412; const bit = (i) => ((b >>> i) & 1) !== 0;
      for (let i = 0; i <= 5; i++) set(8, i, bit(i)); set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8)); for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
      for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i)); for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i)); set(8, size - 8, true);
    };
    drawFormat(0);
    if (ver >= 7) { let r = ver; for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25); const b = (ver << 12) | r; for (let i = 0; i < 18; i++) { const bt = ((b >>> i) & 1) !== 0, a = size - 11 + (i % 3), c = Math.floor(i / 3); set(a, c, bt); set(c, a, bt); } }
    // data placement
    let i = 0; for (let right = size - 1; right >= 1; right -= 2) { if (right === 6) right = 5; for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) { const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert; if (!F[y][x] && i < all.length * 8) { M[y][x] = ((all[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0; i++; } } }
    const maskFn = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x) => x % 3 === 0, (x, y) => (x + y) % 3 === 0, (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0, (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0];
    const applyMask = (k) => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!F[y][x] && maskFn[k](x, y)) M[y][x] = !M[y][x]; };
    const penalty = () => {
      let p = 0;
      const runs = (get) => { for (let a = 0; a < size; a++) { let c = get(a, 0), n = 1; for (let b = 1; b < size; b++) { const v = get(a, b); if (v === c) { n++; if (n === 5) p += 3; else if (n > 5) p++; } else { c = v; n = 1; } } } };
      runs((a, b) => M[a][b]); runs((a, b) => M[b][a]);
      for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) { const c = M[y][x]; if (c === M[y][x + 1] && c === M[y + 1][x] && c === M[y + 1][x + 1]) p += 3; }
      const pat = [true, false, true, true, true, false, true]; const chk = (get) => { for (let a = 0; a < size; a++) for (let b = 0; b + 6 < size; b++) { let ok = true; for (let k = 0; k < 7 && ok; k++) ok = get(a, b + k) === pat[k]; if (!ok) continue; const before = b >= 4 && [1, 2, 3, 4].every((k) => !get(a, b - k)); const after = b + 10 < size && [7, 8, 9, 10].every((k) => !get(a, b + k)); if (before || after) p += 40; } };
      chk((a, b) => M[a][b]); chk((a, b) => M[b][a]);
      let dark = 0; M.forEach((r) => r.forEach((c) => c && dark++)); const total = size * size; p += Math.ceil(Math.abs(dark * 20 - total * 10) / total - 1) * 10;
      return p;
    };
    let best = 0, bestP = Infinity;
    for (let k = 0; k < 8; k++) { applyMask(k); drawFormat(k); const p = penalty(); if (p < bestP) { bestP = p; best = k; } applyMask(k); }
    applyMask(best); drawFormat(best);
    return { size, get: (x, y) => M[y][x] };
  }
  function svg(text, { color = '#000', bg = '#fff', border = 2, ecl = 'M', px = 0, logo = '' } = {}) {
    const q = encode(text, ecl); const n = q.size + border * 2; let d = '';
    for (let y = 0; y < q.size; y++) for (let x = 0; x < q.size; x++) if (q.get(x, y)) d += `M${x + border},${y + border}h1v1h-1z`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" ${px ? `width="${px}" height="${px}"` : ''} shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="${bg}"/><path d="${d}" fill="${color}"/>${logo}</svg>`;
  }
  function dataURL(text, size = 200, opts = {}) {
    const q = encode(text, opts.ecl || 'M'); const b = opts.border ?? 2; const n = q.size + b * 2; const sc = Math.max(1, Math.floor(size / n));
    const c = document.createElement('canvas'); c.width = c.height = n * sc; const x = c.getContext('2d');
    x.fillStyle = opts.bg || '#fff'; x.fillRect(0, 0, c.width, c.height); x.fillStyle = opts.color || '#000';
    for (let yy = 0; yy < q.size; yy++) for (let xx = 0; xx < q.size; xx++) if (q.get(xx, yy)) x.fillRect((xx + b) * sc, (yy + b) * sc, sc, sc);
    return c.toDataURL('image/png');
  }
  return { encode, svg, dataURL };
})();
