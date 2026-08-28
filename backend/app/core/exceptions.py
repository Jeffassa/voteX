"""Exceptions métier typées.

Les routers les attrapent via le handler global et les traduisent en réponses HTTP.
Ça évite de coupler la logique métier à FastAPI/HTTPException.
"""


class DomainError(Exception):
    status_code: int = 400

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


class NotFoundError(DomainError):
    status_code = 404


class ConflictError(DomainError):
    status_code = 409


class ForbiddenError(DomainError):
    status_code = 403


class UnauthorizedError(DomainError):
    status_code = 401


class ValidationError(DomainError):
    status_code = 400
