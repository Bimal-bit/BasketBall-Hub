import type { Game } from './api';

export function formatIndianTime(date: Date) {
  return date.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatIndianDate(date: Date, options: Intl.DateTimeFormatOptions = {}) {
  return date.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...options,
  });
}

export function getIndianDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function gameStatusInIndia(game: Game) {
  if (game.status === 'live') return game.status_text || `Q${game.quarter}`;
  if (game.status === 'final') return game.status_text || 'Final';

  const status = game.status_text;
  if (!status || status === 'TBD') return 'TBD';

  const match = status.match(/(\d{1,2}):(\d{2})\s*([ap])m\s*ET/i);
  if (!match) return status.replace(/\s*ET\b/i, ' IST');

  const [, hourText, minuteText, meridiem] = match;
  let hour = Number(hourText);
  const minute = Number(minuteText);

  if (meridiem.toLowerCase() === 'p' && hour !== 12) hour += 12;
  if (meridiem.toLowerCase() === 'a' && hour === 12) hour = 0;

  const [year, month, day] = (game.game_date || '').split('-').map(Number);
  if (!year || !month || !day) return status;

  const utcTime = Date.UTC(year, month - 1, day, hour - easternOffsetHours(year, month, day), minute);

  return `${new Date(utcTime).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })} IST`;
}

function easternOffsetHours(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  const dstStart = nthWeekdayOfMonthUtc(year, 2, 0, 2);
  const dstEnd = nthWeekdayOfMonthUtc(year, 10, 0, 1);
  return date >= dstStart && date < dstEnd ? -4 : -5;
}

function nthWeekdayOfMonthUtc(year: number, monthIndex: number, weekday: number, n: number) {
  const date = new Date(Date.UTC(year, monthIndex, 1));
  const offset = (weekday - date.getUTCDay() + 7) % 7;
  return new Date(Date.UTC(year, monthIndex, 1 + offset + (n - 1) * 7));
}
