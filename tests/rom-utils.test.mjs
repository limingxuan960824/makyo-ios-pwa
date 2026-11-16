import test from "node:test";
import assert from "node:assert/strict";
import { readRomMetadata } from "../rom-utils.js";

function makeHeader({ consoleName = "SEGA MEGA DRIVE", serial = "GM G-004122-00" } = {}) {
  const bytes = new Uint8Array(512);
  const encoder = new TextEncoder();
  bytes.set(encoder.encode(consoleName), 0x100);
  bytes.set(encoder.encode("YUYU HAKUSYO"), 0x120);
  bytes.set(encoder.encode("YUYU HAKUSYO"), 0x150);
  bytes.set(encoder.encode(serial), 0x180);
  bytes.set(encoder.encode("J"), 0x1f0);
  return bytes.buffer;
}

test("accepts the target Mega Drive ROM header", () => {
  const result = readRomMetadata(makeHeader(), 3 * 1024 * 1024);
  assert.equal(result.valid, true);
  assert.equal(result.serial, "GM G-004122-00");
  assert.equal(result.region, "J");
});

test("rejects another Mega Drive game", () => {
  const result = readRomMetadata(makeHeader({ serial: "GM OTHER-00000" }), 3 * 1024 * 1024);
  assert.equal(result.valid, false);
  assert.match(result.reason, /不是/);
});

test("rejects truncated input", () => {
  const result = readRomMetadata(new ArrayBuffer(128), 128);
  assert.equal(result.valid, false);
  assert.match(result.reason, /文件太小/);
});
