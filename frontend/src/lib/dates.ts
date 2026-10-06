/**
 * Dates lisibles pour l'administration : « 4 sept. → 5 sept. 2026 »,
 * « il y a 3 min », « encore 2 j ». Tout en français, à l'heure locale.
 */

const DAY = 86_400_000;

const dayMonth = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
const dayMonthYear = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });
const time = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
const longDay = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const longDayYear = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const relative = new Intl.RelativeTimeFormat("fr-FR", { numeric: "auto" });

/** Période d'un scrutin : l'année écrite une fois si elle ne change pas, la date une fois si le scrutin tient dans la journée. */
export function formatPeriod(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  if (s.toDateString() === e.toDateString()) return dayMonthYear.format(s);
  const first = s.getFullYear() === e.getFullYear() ? dayMonth.format(s) : dayMonthYear.format(s);
  return `${first} → ${dayMonthYear.format(e)}`;
}

/** Date et heure complètes, pour un attribut title ou un détail. */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${dayMonthYear.format(d)} à ${time.format(d)}`;
}

export function formatTime(iso: string): string {
  return time.format(new Date(iso));
}

/** « il y a 5 min », « hier », « il y a 3 jours ». */
export function timeAgo(iso: string, now = Date.now()): string {
  const diff = new Date(iso).getTime() - now;
  const abs = Math.abs(diff);
  if (abs < 60_000) return "à l'instant";
  if (abs < 3_600_000) return relative.format(Math.round(diff / 60_000), "minute");
  if (abs < DAY) return relative.format(Math.round(diff / 3_600_000), "hour");
  if (abs < 30 * DAY) return relative.format(Math.round(diff / DAY), "day");
  return dayMonthYear.format(new Date(iso));
}

/** Temps restant avant une échéance : « encore 2 j 4 h », « encore 35 min ». */
export function timeLeft(iso: string, now = Date.now()): string {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return "terminé";
  const days = Math.floor(ms / DAY);
  const hours = Math.floor((ms % DAY) / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  if (days > 0) return `encore ${days} j${hours ? ` ${hours} h` : ""}`;
  if (hours > 0) return `encore ${hours} h${minutes ? ` ${minutes} min` : ""}`;
  return `encore ${Math.max(minutes, 1)} min`;
}

/** Durée entre deux dates, pour le formulaire : « 2 jours et 3 heures ». */
export function formatDuration(ms: number): string {
  const days = Math.floor(ms / DAY);
  const hours = Math.floor((ms % DAY) / 3_600_000);
  const minutes = Math.round((ms % 3_600_000) / 60_000);
  const parts: string[] = [];
  if (days) parts.push(`${days} jour${days > 1 ? "s" : ""}`);
  if (hours) parts.push(`${hours} heure${hours > 1 ? "s" : ""}`);
  if (!days && minutes) parts.push(`${minutes} minute${minutes > 1 ? "s" : ""}`);
  return parts.join(" et ") || "moins d'une minute";
}

/** Titre d'un groupe de jours dans un journal : « Aujourd'hui », « Hier », « lundi 5 octobre ». */
export function dayLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(now) - startOf(d)) / DAY);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return "Hier";
  const label = (d.getFullYear() === now.getFullYear() ? longDay : longDayYear).format(d);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Clé de regroupement par jour local. */
export function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
