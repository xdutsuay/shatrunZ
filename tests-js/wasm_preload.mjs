/**
 * Preload wasm before tests-js that construct `Game`.
 * Usage: node --import ./tests-js/wasm_preload.mjs --test ...
 */
import { initWasm } from '../frontend/shared/wasm_boot.js';

await initWasm();
