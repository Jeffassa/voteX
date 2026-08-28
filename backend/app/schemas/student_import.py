from pydantic import BaseModel


class ImportRowResult(BaseModel):
    row: int
    matricule: str | None = None
    status: str  # "ok" | "skipped" | "error"
    message: str | None = None


class ImportReport(BaseModel):
    total: int
    created: int
    skipped: int  # déjà existants
    errors: int
    rows: list[ImportRowResult]
