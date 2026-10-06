/**
 * Champ piège anti-robots (voir backend/app/core/antispam.py).
 *
 * Invisible à l'écran, hors de l'ordre de tabulation et ignoré des lecteurs
 * d'écran : un humain ne peut pas le remplir, un robot qui renseigne tous les
 * champs le fait. Pas de `display: none`, que certains robots savent éviter.
 */
export function Honeypot({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div
      aria-hidden="true"
      style={{ position: "absolute", left: "-10000px", top: "auto", width: 1, height: 1, overflow: "hidden" }}
    >
      <label>
        Site web (laisser vide)
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
    </div>
  );
}
