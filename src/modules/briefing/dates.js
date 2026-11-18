'use strict';
const config = require('../../config');

/** "Thursday, 19 November" / "गुरुवार, 19 नवंबर" in the app timezone. */
function formatLongDateIn(lang, date = new Date()) {
  return new Intl.DateTimeFormat(lang === 'hi' ? 'hi-IN' : 'en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: config.timezone, numberingSystem: 'latn',
  }).format(date);
}

module.exports = { formatLongDateIn };
