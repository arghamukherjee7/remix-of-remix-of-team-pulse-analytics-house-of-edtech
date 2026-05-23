// Billing cycle = 26th of month → 25th of next month
import { addMonths, format, isWithinInterval, parseISO } from "date-fns";

export interface CycleRange {
  start: Date;
  end: Date;
  label: string;
}

export function getCycleForDate(d: Date): CycleRange {
  const day = d.getDate();
  const month = d.getMonth();
  const year = d.getFullYear();

  // If day >= 26, cycle starts this month; else starts previous month
  const startBase = new Date(year, day >= 26 ? month : month - 1, 26);
  const endBase = new Date(startBase.getFullYear(), startBase.getMonth() + 1, 25);
  return {
    start: startBase,
    end: endBase,
    label: formatCycleLabel(startBase, endBase),
  };
}

export function formatCycleLabel(start: Date, end: Date): string {
  return `${format(start, "dd MMM yyyy")} → ${format(end, "dd MMM yyyy")}`;
}

export function getCurrentCycle(): CycleRange {
  return getCycleForDate(new Date());
}

export function nextCycle(c: CycleRange): CycleRange {
  const start = addMonths(c.start, 1);
  const end = addMonths(c.end, 1);
  return { start, end, label: formatCycleLabel(start, end) };
}

export function previousCycle(c: CycleRange): CycleRange {
  const start = addMonths(c.start, -1);
  const end = addMonths(c.end, -1);
  return { start, end, label: formatCycleLabel(start, end) };
}

export function isDateInCycle(date: string | Date, c: CycleRange) {
  const d = typeof date === "string" ? parseISO(date) : date;
  return isWithinInterval(d, { start: c.start, end: c.end });
}

// Slice a billing cycle into weekly buckets (Mon-Sun aligned to cycle start)
export function getWeeksInCycle(c: CycleRange): CycleRange[] {
  const weeks: CycleRange[] = [];
  let weekStart = new Date(c.start);
  while (weekStart <= c.end) {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    if (weekEnd > c.end) weekEnd.setTime(c.end.getTime());
    weeks.push({
      start: new Date(weekStart),
      end: new Date(weekEnd),
      label: `Week of ${format(weekStart, "dd MMM")}`,
    });
    weekStart.setDate(weekStart.getDate() + 7);
  }
  return weeks;
}

export function toISODate(d: Date): string {
  return format(d, "yyyy-MM-dd");
}
