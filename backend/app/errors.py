class DomainError(Exception):
    """A deliberate, public API error; never expose internal exception strings."""

    def __init__(self, detail: str, status_code: int = 422):
        self.detail = detail
        self.status_code = status_code
        super().__init__(detail)
