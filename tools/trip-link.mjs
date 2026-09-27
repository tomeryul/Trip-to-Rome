#!/usr/bin/env node
// Builds and reads the private trip link. The trip itself never goes into this repo:
// it lives only inside the link (after "#", which browsers never send to the server)
// and in each phone's local storage.
//
//   node tools/trip-link.mjs encode private/trip.json   → prints a new link (newer than any earlier one)
//   node tools/trip-link.mjs decode '<link>' > trip.json → turns a link back into editable JSON
//
// trip.json looks like: { "trip": { ...lo"z, hotel, flights... }, "vault": { "hotel": "12345", ... } }

import { readFileSync } from 'node:fs';
import { deflateRawSync, inflateRawSync } from 'node:zlib';

const BASE = process.env.TRIP_BASE_URL || 'https://tomeryul.github.io/Trip-to-Rome/';
const [cmd, arg] = process.argv.slice(2);

if (cmd === 'encode' && arg) {
  const { trip, vault = {} } = JSON.parse(readFileSync(arg, 'utf8'));
  const ts = Date.now();
  const kv = { trip: [trip, ts] };
  for (const [k, v] of Object.entries(vault)) kv[`vault:${k}`] = [v, ts];
  const code = 'z' + deflateRawSync(JSON.stringify({ v: 1, kv }), { level: 9 }).toString('base64url');
  console.log(`${BASE}#import=${code}`);
} else if (cmd === 'decode' && arg) {
  const code = arg.slice(arg.indexOf('import=') + 7).trim();
  const bytes = Buffer.from(code.slice(1), 'base64url');
  const { kv } = JSON.parse(code[0] === 'z' ? inflateRawSync(bytes).toString('utf8') : bytes.toString('utf8'));
  const vault = {};
  for (const [k, e] of Object.entries(kv)) if (k.startsWith('vault:') && e[0] != null) vault[k.slice(6)] = e[0];
  console.log(JSON.stringify({ trip: kv.trip?.[0], vault }, null, 2));
} else {
  console.error('usage: node tools/trip-link.mjs encode <trip.json> | decode <link>');
  process.exit(1);
}
