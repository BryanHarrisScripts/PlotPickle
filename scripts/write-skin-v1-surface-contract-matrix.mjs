#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  SURFACE_CONTRACT_MATRIX_DOC,
  writeSkinV1SurfaceContractMatrix,
} from "../lib/verification/skin-v1/surface-contracts.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

writeSkinV1SurfaceContractMatrix({ root, target: SURFACE_CONTRACT_MATRIX_DOC })
  .then((result) => {
    console.log(`Skin V1 Surface Contract Matrix: ${result.path} (${result.surfaces} surfaces)`);
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
