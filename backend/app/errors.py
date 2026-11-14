class NotFoundError(Exception):
    """Raised by services when a requested record does not exist. Mapped to HTTP 404."""
