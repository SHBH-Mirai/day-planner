// Draws the two Teams app icons as PNGs with Node's built-in zlib (no dependencies).
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}
function png(size, pixel) {
  const rows = []
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4)
    for (let x = 0; x < size; x++) row.set(pixel(x, y, size), 1 + x * 4)
    rows.push(row)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 6 // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0)),
  ])
}

// A simple calendar: page outline, header bar, and a checkmark-free grid of dots.
const inCal = (x, y, s) => {
  const m = s * 0.2, t = s * 0.24, b = s * 0.82
  return x >= m && x < s - m && y >= t && y < b
}
const onCalLine = (x, y, s) => {
  const m = s * 0.2, t = s * 0.24, b = s * 0.82, w = Math.max(1, s * 0.07)
  const edge = inCal(x, y, s) && (x < m + w || x >= s - m - w || y < t + w || y >= b - w)
  const header = inCal(x, y, s) && y < s * 0.38
  const dot = inCal(x, y, s) && y > s * 0.45 && ((Math.floor((x - m) / (s * 0.15)) + Math.floor((y - s * 0.45) / (s * 0.12))) % 2 === 0) && (x - m) % (s * 0.15) < s * 0.08 && (y - s * 0.45) % (s * 0.12) < s * 0.07
  return edge || header || dot
}
const BLUE = [0x2f, 0x6f, 0xdb, 255], WHITE = [255, 255, 255, 255], CLEAR = [0, 0, 0, 0]
writeFileSync('teams-app/color.png', png(192, (x, y, s) => (onCalLine(x, y, s) ? WHITE : BLUE)))
writeFileSync('teams-app/outline.png', png(32, (x, y, s) => (onCalLine(x, y, s) ? WHITE : CLEAR)))
console.log('wrote teams-app/color.png and teams-app/outline.png')
