const decoder = new TextDecoder("ascii");

function readAscii(bytes, offset, length) {
  return decoder.decode(bytes.slice(offset, offset + length)).replace(/\0/g, "").trim();
}

export function readRomMetadata(headerBuffer, fileSize) {
  const bytes = new Uint8Array(headerBuffer);

  if (fileSize < 512 || bytes.byteLength < 512) {
    return { valid: false, reason: "文件太小，不是完整的 MD ROM" };
  }

  const consoleName = readAscii(bytes, 0x100, 16);
  const domesticTitle = readAscii(bytes, 0x120, 48);
  const overseasTitle = readAscii(bytes, 0x150, 48);
  const serial = readAscii(bytes, 0x180, 14);
  const region = readAscii(bytes, 0x1f0, 16);

  if (!consoleName.startsWith("SEGA MEGA DRIVE")) {
    return { valid: false, reason: "未识别到 SEGA MEGA DRIVE 卡带头" };
  }

  if (serial !== "GM G-004122-00") {
    return { valid: false, reason: "这不是《幽游白书：魔强统一战》的 ROM" };
  }

  return {
    valid: true,
    consoleName,
    domesticTitle,
    overseasTitle,
    serial,
    region,
  };
}
