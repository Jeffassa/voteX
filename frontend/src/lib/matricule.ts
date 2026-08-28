/**
 * Validation client-side du format matricule ESATIC.
 *
 * Format : `XX-ESATICNNNNAA`
 * - XX : 2 chiffres (année)
 * - -ESATIC : littéral
 * - NNNN : 4 chiffres
 * - AA : 2 lettres majuscules
 */

export const MATRICULE_REGEX = /^\d{2}-ESATIC\d{4}[A-Z]{2}$/;
export const MATRICULE_FORMAT_HUMAN = "XX-ESATICNNNNAA ";

export function isValidMatricule(value: string): boolean {
  if (!value) return false;
  return MATRICULE_REGEX.test(value.trim());
}

export function normalizeMatricule(value: string): string {
  return (value || "").trim().toUpperCase();
}
