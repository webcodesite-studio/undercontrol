// Vercel serverless function: GET/POST /api/submit-order — przyjmuje koszyk i automatycznie wysyła kompletne zamówienie (Formspree / Discord).
// Sekrety są wyłącznie w zmiennych środowiskowych (patrz api/_lib/order-core.js). GET zwraca publiczny, niewrażliwy status (tryb, test, gotowość).
const { createHandlers } = require("./_lib/order-core.js");
module.exports = createHandlers(() => process.env).submit;
