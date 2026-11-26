import sharp from 'sharp';
import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('public/icons', { recursive: true });
await mkdir('public/fonts', { recursive: true });
for (const size of [192, 512])
  await sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" rx="100" fill="#10182d"/><path d="M155 180h202q35 0 48 50l32 105q10 48-30 48-18 0-60-50H165q-42 50-60 50-40 0-30-48l32-105q13-50 48-50" fill="#9aff60"/><path d="M156 232v64m-32-32h64" stroke="#10182d" stroke-width="18"/><circle cx="342" cy="245" r="12" fill="#10182d"/><circle cx="374" cy="280" r="12" fill="#10182d"/></svg>`,
    ),
  )
    .resize(size)
    .png()
    .toFile(`public/icons/icon-${size}.png`);
for (const subset of ['arabic', 'latin'])
  await copyFile(
    `node_modules/@fontsource/cairo/files/cairo-${subset}-400-normal.woff2`,
    `public/fonts/cairo-${subset}.woff2`,
  );
await copyFile(
  'node_modules/@fontsource/cairo/LICENSE',
  'public/fonts/OFL.txt',
);
