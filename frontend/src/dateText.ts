const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const MILLISECONDS_PER_DAY = 86_400_000;

export function formatDate(isoDateTime: string): string {
  return isoDateTime.slice(0, 10);
}

interface DateParts {
  year: string;
  monthName: string;
  day: number;
}

function splitDate(isoDateTime: string): DateParts {
  const [year = "", month = "1", day = "1"] = formatDate(isoDateTime).split("-");
  return { year, monthName: MONTH_NAMES[Number(month) - 1] ?? "", day: Number(day) };
}

export function formatEpochDates(startDateTime: string, endDateTime: string): string {
  const start = splitDate(startDateTime);
  const end = splitDate(endDateTime);
  const startText = `${start.day} ${start.monthName}`;
  const endText = `${end.day} ${end.monthName} ${end.year}`;
  return start.year === end.year
    ? `${startText} – ${endText}`
    : `${startText} ${start.year} – ${endText}`;
}

export function formatShortDate(isoDateTime: string): string {
  const { day, monthName } = splitDate(isoDateTime);
  return `${day} ${monthName}`;
}

export function utcMilliseconds(isoDateTime: string): number {
  return Date.parse(isoDateTime.endsWith("Z") ? isoDateTime : `${isoDateTime}Z`);
}

export function daysBetween(earlierMilliseconds: number, laterMilliseconds: number): number {
  return (laterMilliseconds - earlierMilliseconds) / MILLISECONDS_PER_DAY;
}

const MODIFIED_JULIAN_DATE_OF_UNIX_EPOCH = 40587;

export function toModifiedJulianDate(isoDateTime: string): number {
  return utcMilliseconds(isoDateTime) / MILLISECONDS_PER_DAY + MODIFIED_JULIAN_DATE_OF_UNIX_EPOCH;
}

export function formatModifiedJulianDate(modifiedJulianDate: number): string {
  const unixMilliseconds =
    (modifiedJulianDate - MODIFIED_JULIAN_DATE_OF_UNIX_EPOCH) * MILLISECONDS_PER_DAY;
  return new Date(unixMilliseconds).toISOString().slice(0, 10);
}

export function formatShortDateWithYear(isoDateTime: string): string {
  return `${formatShortDate(isoDateTime)} ${splitDate(isoDateTime).year}`;
}
