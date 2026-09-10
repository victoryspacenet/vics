import sharp from '../netlify/node_modules/sharp/lib/index.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const src = path.join(root, 'public', 'logo.png')
const outDir = path.join(root, 'public')

async function icon(size, paddingRatio, filename) {
  const inner = Math.round(size * (1 - paddingRatio * 2))
  const logo = await sharp(src)
    .resize(inner, inner, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .png()
    .toBuffer()

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: logo, gravity: 'centre' }])
    .png()
    .toFile(path.join(outDir, filename))
}

await icon(192, 0.12, 'pwa-192.png')
await icon(512, 0.12, 'pwa-512.png')
await icon(512, 0.22, 'pwa-512-maskable.png')
await icon(180, 0.1, 'apple-touch-icon.png')
console.log('wrote pwa-192.png pwa-512.png pwa-512-maskable.png apple-touch-icon.png')
