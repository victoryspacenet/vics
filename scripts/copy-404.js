#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const src = path.join(__dirname, '../dist/index.html')
const dest = path.join(__dirname, '../dist/404.html')
if (fs.existsSync(src)) {
  fs.copyFileSync(src, dest)
  console.log('Created dist/404.html for SPA fallback')
}
