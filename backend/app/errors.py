class ArchiveError(Exception):
    """The archive could not be reached or returned an unusable response."""

    def __init__(self, http_status: int, message: str):
        super().__init__(message)
        self.http_status = http_status
        self.message = message
