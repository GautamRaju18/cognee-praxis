"""All cognee calls live in this file — nothing else imports cognee.

Verified against cognee 1.2.2 (see NOTES.md): the V1 pipeline API
(add / cognify / search) is used because cognify() accepts a custom
graph_model, which carries the Praxis ontology.
"""

from praxis.config import settings

_configured = False


def _cognee():
    """Import cognee lazily and point its storage at the project-local dirs."""
    global _configured
    import cognee

    if not _configured:
        cognee.config.data_root_directory(str(settings.cognee_data_root))
        cognee.config.system_root_directory(str(settings.cognee_system_root))
        _configured = True
    return cognee


async def cognee_health() -> str:
    """Cheap reachability check: import + version + storage config."""
    cognee = _cognee()
    return cognee.get_cognee_version()
