export function formatHash(hash: string, prefix = 6, suffix = 4) {
  if (!hash) return "";
  return `${hash.slice(0, prefix)}…${hash.slice(-suffix)}`;
}

export function formatDate(date: string | Date) {
  return new Date(date).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
