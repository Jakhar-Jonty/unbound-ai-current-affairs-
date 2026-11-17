'use strict';
const config = require('../config');

/** Returns YYYY-MM-DD for `date` in the app timezone (IST by default). */
function localDateString(date = new Date(), timeZone = config.timezone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

module.exports = { localDateString };
