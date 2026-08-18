// @ts-nocheck
// Entry serverless: re-exporta el bundle CJS auto-contenido (serverless/index.cjs).
// Vercel traza este require y copia el archivo; NO usa src/ (evita crash ESM en CJS).
module.exports = require('../serverless/index.cjs');