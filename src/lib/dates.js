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

/** Minutes the timezone is ahead of UTC at `date` (e.g. +330 for IST). */
function tzOffsetMinutes(date, timeZone = config.timezone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date).map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

/** Monday 00:00 to next Monday 00:00 (app timezone) for the week containing `date`, as UTC Dates. */
function weekRange(date = new Date(), timeZone = config.timezone) {
  const today = localDateString(date, timeZone);
  const dayIndex = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
  const mondayUtcMidnight = Date.parse(`${today}T00:00:00Z`) - dayIndex * 86400000;
  const start = new Date(mondayUtcMidnight - tzOffsetMinutes(new Date(mondayUtcMidnight), timeZone) * 60000);
  const end = new Date(start.getTime() + 7 * 86400000);
  return { start, end, startDate: localDateString(start, timeZone) };
}

/** Midnight today in the app timezone, as a UTC Date. */
function dayStart(date = new Date(), timeZone = config.timezone) {
  const today = localDateString(date, timeZone);
  const midnightUtc = Date.parse(`${today}T00:00:00Z`);
  return new Date(midnightUtc - tzOffsetMinutes(new Date(midnightUtc), timeZone) * 60000);
}

module.exports = { localDateString, tzOffsetMinutes, weekRange, dayStart };
