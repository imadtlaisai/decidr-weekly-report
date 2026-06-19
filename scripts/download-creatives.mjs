// One-off: download Meta creative images locally so the report is self-contained
// (signed FB/IG CDN URLs expire). Run: node scripts/download-creatives.mjs
// Then resize with sips and they get base64-inlined by generate.mjs at build time.
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const DIR = 'assets/creatives/week-24';
mkdirSync(resolve(DIR), { recursive: true });

const items = [
  { file: 'ad1-video.jpg',       url: 'https://scontent-bru2-1.cdninstagram.com/v/t51.71878-15/702500971_1725173595496201_4900066576060890609_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=102&ccb=7-5&_nc_sid=18de74&efg=eyJlZmdfdGFnIjoiQUQuYmVzdF9pbWFnZV91cmxnZW4uQzMifQ%3D%3D&_nc_ohc=qLgkgRb9DCQQ7kNvwE9HNQr&_nc_oc=AdqvMornffS4G_q8hJ3VrL484oPkRVWTi_4xUcnuSIAp7e7WBGZF_bMNMEg1KqeLn5I&_nc_zt=23&_nc_ht=scontent-bru2-1.cdninstagram.com&edm=AIZKd-4EAAAA&_nc_gid=PgpZm0JYgANvGusmjvHijA&_nc_tpa=Q5bMBQHcAE18Dc_jjXFSyIjAItb5k6DVTjp8nQBNK3hBJQUKgl4_L3IrWtnBHvuUpjU05F3HllQeJNMK&oh=00_Af8nD1xqQKD1ta337YEZ3uX1fAQBpaHlpNOvQYaftSY4nA&oe=6A390A07' },
  { file: 'ad2-ae-ad4.jpg',      url: 'https://scontent-bru2-1.cdninstagram.com/v/t51.71878-15/721441152_991332570531776_9156989729477813037_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=111&ccb=7-5&_nc_sid=18de74&efg=eyJlZmdfdGFnIjoiQUQuYmVzdF9pbWFnZV91cmxnZW4uQzMifQ%3D%3D&_nc_ohc=E-6CCX_ayYUQ7kNvwFlAaa0&_nc_oc=AdpqPph6dX6c8Dm4TlTBtBYVem7qRPQ2f2MqmXNCvS76U-gN9MauvOjKI2K3YIYFy6U&_nc_zt=23&_nc_ht=scontent-bru2-1.cdninstagram.com&edm=AEQ6tj4EAAAA&_nc_gid=rX17sGXgXYLPFP3Y__KnKg&oh=00_Af81afff0iuDlI0WnQcjUdMtkagw_bPvo4uBfPShA65zhw&oe=6A391905' },
  { file: 'ad3-sg-ad2.jpg',      url: 'https://scontent-bru2-1.cdninstagram.com/v/t51.71878-15/701296022_1688948578925371_3659205097104523209_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=100&ccb=7-5&_nc_sid=18de74&efg=eyJlZmdfdGFnIjoiQUQuYmVzdF9pbWFnZV91cmxnZW4uQzMifQ%3D%3D&_nc_ohc=VwG15fk0yAsQ7kNvwFP1_dV&_nc_oc=AdouConw1pvAXxOS4TeiFx1dCpcaIb6Q9JskqFH5BvcRF-6UthqJwWdA73jQfhNxwTw&_nc_zt=23&_nc_ht=scontent-bru2-1.cdninstagram.com&edm=AEQ6tj4EAAAA&_nc_gid=5TaqFE5N3jnqy5PvdivINQ&oh=00_Af9pi5Qar6pn4QMnl0bTBlks8kJJeO53WLbWQTvbrYkgXg&oe=6A3912A5' },
  { file: 'ad4-ae-ad9.jpg',      url: 'https://www.facebook.com/ads/image/?d=AQK752W1NlqkiJ9AyIT3klbTEoLo5KY_HCuM07CYNye3Y7hlLWSHGSy8WfuK05Ea64LtVFsbE0jZE4h53E4KzU-c1KHAexLf1iveibePti5_ch-abg-jQB6p6mJaT72ZVgCbLF_XXYnl0x8lNnGIb7Yn' },
  { file: 'ad5-usa-ad6.jpg',     url: 'https://scontent-bru2-1.cdninstagram.com/v/t51.71878-15/689175866_1513076400288501_9025682100505852970_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=104&ccb=7-5&_nc_sid=18de74&efg=eyJlZmdfdGFnIjoiQUQuYmVzdF9pbWFnZV91cmxnZW4uQzMifQ%3D%3D&_nc_ohc=0YhVHC_Y-vkQ7kNvwHe0xb1&_nc_oc=AdoCA9bHv0mCpvEFiI77C5-nb13ri8O6GI9wcrZs3UtCQMOwHWrf17HdTFeCxuDa9Zs&_nc_zt=23&_nc_ht=scontent-bru2-1.cdninstagram.com&edm=AIZKd-4EAAAA&_nc_gid=9Otjon750NJB8NTHhHuLOg&oh=00_Af-hdH0lUYBjlatbJPTXPhOO71ikBhg2jH-KC1KTkd8ihQ&oe=6A39240A' },
  { file: 'ad6-mercha-v6.jpg',   url: 'https://scontent-bru2-1.cdninstagram.com/v/t51.71878-15/696741112_1011770631190249_833902249176726516_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=101&ccb=7-5&_nc_sid=18de74&efg=eyJlZmdfdGFnIjoiQUQuYmVzdF9pbWFnZV91cmxnZW4uQzMifQ%3D%3D&_nc_ohc=9YZsxWLCWAMQ7kNvwHPay_v&_nc_oc=AdpkflnW0zmMdkzr-Ek6H3VxBkelEZIZHz03_Xs0JiI4aVNEwJl6BFriGQJvAkmeStY&_nc_zt=23&_nc_ht=scontent-bru2-1.cdninstagram.com&edm=AEQ6tj4EAAAA&_nc_gid=-VlMeC4Iv5gz8muyEW3kmg&oh=00_Af9m3eFaMDMPnPiAzxMgxfWukCUw25rZJS9UwkGgav-FOQ&oe=6A390109' },
];

for (const it of items) {
  const res = await fetch(it.url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) { console.error(`✗ ${it.file}: HTTP ${res.status}`); continue; }
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(resolve(DIR, it.file), buf);
  console.log(`✓ ${it.file} (${(buf.length / 1024).toFixed(0)} KB)`);
}
