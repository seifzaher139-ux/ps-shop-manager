import { readFile, readdir } from 'node:fs/promises';
const files = await readdir('dist/assets');
const text = (
  await Promise.all(
    files
      .filter((f) => f.endsWith('.js'))
      .map((f) => readFile('dist/assets/' + f, 'utf8')),
  )
).join('');
if (
  text.includes('demo-ps-shop-manager') ||
  !text.includes('ps-shop-manager-c47a5')
)
  throw new Error(
    'Production bundle must target the real Firebase project, never emulators',
  );
process.stdout.write('Production Firebase target verified.\n');
