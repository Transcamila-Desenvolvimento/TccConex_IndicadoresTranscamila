from pathlib import Path


class PathAccessError(PermissionError):
    """Raised when a path is outside the allowed home directory."""


def get_home_dir() -> str:
    return str(Path.home().resolve())


def resolve_safe_path(raw_path: str | None) -> Path:
    """Resolve a path and ensure it stays under the user's home directory."""
    home = Path.home().resolve()
    if not raw_path:
        return home

    target = Path(raw_path).expanduser().resolve()

    try:
        target.relative_to(home)
    except ValueError as exc:
        raise PathAccessError('Acesso negado: caminho fora do diretório permitido.') from exc

    return target
