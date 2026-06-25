// Dimensiones de imagen leyendo solo la cabecera. El cron no tiene browser
// para medirlas (en la app las mide el cliente), y media.width/height son
// NOT NULL. Soporta JPEG/PNG/GIF/WebP, que cubre lo que sirve la web.
// ponytail: parser de cabecera, no decodificamos el pixel. Si no reconoce el
// formato devuelve null y el pipeline descarta la imagen.
export function imageSize(buf: Uint8Array): { width: number; height: number } | null {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)

  // PNG: IHDR width/height en offset 16/20 (big-endian)
  if (buf.length >= 24 && buf[0] === 0x89 && buf[1] === 0x50) {
    return { width: dv.getUint32(16), height: dv.getUint32(20) }
  }

  // GIF: width/height en offset 6/8 (little-endian)
  if (buf.length >= 10 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
    return { width: dv.getUint16(6, true), height: dv.getUint16(8, true) }
  }

  // WebP: RIFF....WEBP, tres variantes
  if (
    buf.length >= 30 &&
    buf[0] === 0x52 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    const fmt = String.fromCharCode(buf[12], buf[13], buf[14], buf[15])
    if (fmt === 'VP8 ') {
      return { width: dv.getUint16(26, true) & 0x3fff, height: dv.getUint16(28, true) & 0x3fff }
    }
    if (fmt === 'VP8L') {
      const b1 = buf[22]
      return {
        width: 1 + (((b1 & 0x3f) << 8) | buf[21]),
        height: 1 + (((buf[24] & 0x0f) << 10) | (buf[23] << 2) | ((b1 & 0xc0) >> 6)),
      }
    }
    if (fmt === 'VP8X') {
      return {
        width: 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16)),
        height: 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16)),
      }
    }
  }

  // JPEG: recorre segmentos hasta el marcador SOF (tiene alto/ancho)
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let o = 2
    while (o + 9 <= buf.length) {
      if (buf[o] !== 0xff) {
        o++
        continue
      }
      const m = buf[o + 1]
      // SOF0..SOF15, excluyendo DHT(C4), JPG(C8), DAC(CC)
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
        return { width: dv.getUint16(o + 7), height: dv.getUint16(o + 5) }
      }
      o += 2 + dv.getUint16(o + 2) // saltar segmento por su longitud
    }
  }

  return null
}
