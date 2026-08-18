// @ts-nocheck
// Entry serverless: re-exporta el bundle CJS auto-contenido.
// Vercel traza este require y copia el archivo; no necesita bundlear src/.
module.exports = require('../serverless/index.cjs');