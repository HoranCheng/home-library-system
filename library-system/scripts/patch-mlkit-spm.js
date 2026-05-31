#!/usr/bin/env node
/**
 * Patch @capacitor-mlkit/barcode-scanning with a Package.swift
 * so Capacitor 8 SPM can pick it up.
 *
 * Capawesome haven't published an official Package.swift as of v8.1.0.
 * This script copies our patched version into node_modules after install.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PATCH = path.join(__dirname, '..', 'ios', 'patches', 'mlkit-barcode-scanning-Package.swift');
const TARGET_DIR = path.join(__dirname, '..', 'node_modules', '@capacitor-mlkit', 'barcode-scanning');
const TARGET_FILE = path.join(TARGET_DIR, 'Package.swift');

try {
  if (!fs.existsSync(TARGET_DIR)) {
    console.log('[patch-mlkit-spm] target plugin not installed; skip');
    process.exit(0);
  }
  if (!fs.existsSync(PATCH)) {
    console.warn('[patch-mlkit-spm] patch file missing:', PATCH);
    process.exit(0);
  }
  fs.copyFileSync(PATCH, TARGET_FILE);
  console.log('[patch-mlkit-spm] Package.swift installed ->', TARGET_FILE);
} catch (e) {
  console.warn('[patch-mlkit-spm] failed:', e.message);
  process.exit(0);
}
