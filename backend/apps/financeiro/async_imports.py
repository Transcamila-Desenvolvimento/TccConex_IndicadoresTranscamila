import os
import uuid
from pathlib import Path

from django.conf import settings


def celery_enabled() -> bool:
    return getattr(settings, 'USE_CELERY', False)


def import_tmp_dir() -> Path:
    directory = Path(settings.BASE_DIR) / 'tmp' / 'imports'
    directory.mkdir(parents=True, exist_ok=True)
    return directory


def save_upload(file_bytes: bytes, filename: str) -> Path:
    safe_name = Path(filename).name or 'upload.bin'
    path = import_tmp_dir() / f'{uuid.uuid4().hex}_{safe_name}'
    path.write_bytes(file_bytes)
    return path


def remove_upload(path: str | Path) -> None:
    try:
        Path(path).unlink(missing_ok=True)
    except OSError:
        pass
