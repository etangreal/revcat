import { GRAIN, type Grain } from "@shared/types";

function getMonday(date: Date): void {
  const dayOfWeek = date.getUTCDay() || 7; // Sunday (0) becomes 7
  date.setUTCDate(date.getUTCDate() - (dayOfWeek - 1)); // Move to Monday
}

export function truncateDate(
  date: Date,
  grain: Grain
): string {
    const d = new Date(date);

    if (grain === GRAIN.month) {
      d.setUTCDate(1);
    } else if (grain === GRAIN.week) {
      getMonday(d);
    }

    d.setUTCHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
}

// Helper: Generate date series
export function generateSeries(
	from: string,
	to: string,
	grain: Grain
): string[] {
  const result: string[] = [];
  const current = new Date(from);
  const end = new Date(to);

  while (current < end) {
    result.push(
			current.toISOString().slice(0, 10) // YYYY-MM-DD
		);

    if (grain === GRAIN.day) {
      current.setUTCDate(current.getUTCDate() + 1); // Next day
    } else if (grain === GRAIN.week) {
      current.setUTCDate(current.getUTCDate() + 7); // Next week
    } else {
      current.setUTCMonth(current.getUTCMonth() + 1); // Next month
    }
  }

  return result;
}