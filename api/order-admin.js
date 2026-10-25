// Vercel serverless function: POST /api/order-admin — status integracji, wiadomość testowa i dekoder Base64 (tylko zalogowany administrator).
const { createHandlers } = require("./_lib/order-core.js");
module.exports = createHandlers(() => process.env).admin;
