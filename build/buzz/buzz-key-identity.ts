import { createECDH } from "node:crypto";

const BECH32_ALPHABET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";

function polymod(values: number[]) {
  let checksum = 1;
  for (const value of values) {
    const top = checksum >>> 25;
    checksum = ((checksum & 0x1ffffff) << 5) ^ value;
    if (top & 1) checksum ^= 0x3b6a57b2;
    if (top & 2) checksum ^= 0x26508e6d;
    if (top & 4) checksum ^= 0x1ea119fa;
    if (top & 8) checksum ^= 0x3d4233dd;
    if (top & 16) checksum ^= 0x2a1462b3;
  }
  return checksum >>> 0;
}

function hrpExpand(hrp: string) {
  return [
    ...[...hrp].map((character) => character.charCodeAt(0) >>> 5),
    0,
    ...[...hrp].map((character) => character.charCodeAt(0) & 31),
  ];
}

function convertFiveBitWords(words: number[]) {
  let accumulator = 0;
  let bits = 0;
  const output: number[] = [];
  for (const word of words) {
    if (word < 0 || word > 31) return null;
    accumulator = (accumulator << 5) | word;
    bits += 5;
    while (bits >= 8) {
      bits -= 8;
      output.push((accumulator >>> bits) & 0xff);
      accumulator &= (1 << bits) - 1;
    }
  }
  if (bits >= 5 || ((accumulator << (8 - bits)) & 0xff) !== 0) return null;
  return Buffer.from(output);
}

export function privateKeyHex(value: string) {
  const source = value.trim();
  if (/^[a-f0-9]{64}$/i.test(source)) return source.toLowerCase();
  if (!source.startsWith("nsec1") || source !== source.toLowerCase()) return "";
  const separator = source.lastIndexOf("1");
  if (separator !== 4 || source.length - separator - 1 < 7) return "";
  const hrp = source.slice(0, separator);
  const words: number[] = [];
  for (const character of source.slice(separator + 1)) {
    const valueIndex = BECH32_ALPHABET.indexOf(character);
    if (valueIndex < 0) return "";
    words.push(valueIndex);
  }
  if (polymod([...hrpExpand(hrp), ...words]) !== 1) return "";
  const decoded = convertFiveBitWords(words.slice(0, -6));
  return decoded?.length === 32 ? decoded.toString("hex") : "";
}

export function publicKeyFromPrivateKey(value: string) {
  const hex = privateKeyHex(value);
  if (!hex) return "";
  try {
    const identity = createECDH("secp256k1");
    identity.setPrivateKey(Buffer.from(hex, "hex"));
    return identity.getPublicKey("hex", "compressed").slice(2).toLowerCase();
  } catch {
    return "";
  }
}
