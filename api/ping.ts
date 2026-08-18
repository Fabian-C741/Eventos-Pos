// @ts-nocheck
module.exports = function handler(_req, res) {
  res.statusCode = 200;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ ok: true, at: new Date().toISOString() }));
};