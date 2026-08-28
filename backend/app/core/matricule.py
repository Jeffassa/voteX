"""Validation du format des matricules ESATIC.

Format officiel : `XX-ESATICNNNNAA` où :
- XX   : 2 chiffres (année d'entrée à l'ESATIC, ex: 22 pour 2022)
- -ESATIC : littéral
- NNNN : 4 chiffres
- AA   : 2 lettres majuscules

Exemple : `22-ESATIC0273DN`

Les matricules existants en base (pré-import, comptes admin de bootstrap) ne sont
PAS soumis à cette validation. Elle ne s'applique qu'aux nouveaux flux :
- import Excel admin (chaque ligne validée)
- inscription étudiant (matricule saisi)
"""

import re
import unicodedata


MATRICULE_PATTERN = re.compile(r"^\d{2}-ESATIC\d{4}[A-Z]{2}$")
MATRICULE_FORMAT_HUMAN = "XX-ESATICNNNNAA — ex: 22-ESATIC0273DN"


def is_valid_matricule(value: str) -> bool:
    if not value or not isinstance(value, str):
        return False
    return bool(MATRICULE_PATTERN.match(value.strip()))


def validate_matricule(value: str) -> str:
    cleaned = (value or "").strip().upper()
    # On normalise un peu : "22-esatic0273dn" → "22-ESATIC0273DN"
    if not MATRICULE_PATTERN.match(cleaned):
        raise ValueError(
            f"Matricule '{value}' invalide. Format attendu : {MATRICULE_FORMAT_HUMAN}"
        )
    return cleaned


def normalize_name(name: str) -> str:
    """Pour comparer deux noms en ignorant casse, espaces et accents.

    'Aïcha N'Guessan' → 'aichanguessan'
    """
    if not name:
        return ""
    decomposed = unicodedata.normalize("NFD", name)
    no_accents = "".join(c for c in decomposed if unicodedata.category(c) != "Mn")
    return "".join(c.lower() for c in no_accents if c.isalnum())


def names_match(a: str, b: str) -> bool:
    def get_words(s: str):
        return [normalize_name(w) for w in s.split() if normalize_name(w)]
    
    return set(get_words(a)) == set(get_words(b))
