// Date helpers that use LOCAL timezone (not UTC)

/** Returns today's date as YYYY-MM-DD in local timezone */
export function getLocalToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Returns a Date's date portion as YYYY-MM-DD in local timezone */
export function toLocalDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Get the day of week key for a date string */
export function getDayKey(dateStr: string): string {
  const dayNames = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
  const d = new Date(dateStr + 'T12:00:00');
  return dayNames[d.getDay()];
}

/** Get next day as YYYY-MM-DD */
export function getNextDay(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + 1);
  return toLocalDateStr(d);
}

/** Get Monday of the week containing the given date (week = Mon-Sun) */
export function getWeekStartDate(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon...6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Get dates for each day of the week starting from a Monday */
export function getDayDates(weekStart: Date): Record<string, string> {
  const days = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'];
  const result: Record<string, string> = {};
  days.forEach((day, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    result[day] = toLocalDateStr(d);
  });
  return result;
}
