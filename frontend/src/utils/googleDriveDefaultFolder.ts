import type { GoogleDriveBreadcrumb, GoogleDriveDefaultFolder } from '../types/domain';

const STORAGE_PREFIX = 'prothon_mkt_drive_default_';

function isValidDefault(value: unknown): value is GoogleDriveDefaultFolder {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as GoogleDriveDefaultFolder;
  return Boolean(
    candidate.folderId
    && Array.isArray(candidate.breadcrumbs)
    && candidate.breadcrumbs.length > 0
    && candidate.breadcrumbs.every((crumb) => crumb.id && crumb.name),
  );
}

export function breadcrumbsMatch(
  left: GoogleDriveBreadcrumb[],
  right: GoogleDriveBreadcrumb[],
): boolean {
  if (left.length !== right.length) return false;
  return left.every((crumb, index) => {
    const other = right[index];
    return crumb.id === other.id && (crumb.driveId ?? null) === (other.driveId ?? null);
  });
}

export function getGoogleDriveDefaultFolder(userId: string): GoogleDriveDefaultFolder | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isValidDefault(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function setGoogleDriveDefaultFolder(
  userId: string,
  value: GoogleDriveDefaultFolder,
): void {
  localStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(value));
}

export function clearGoogleDriveDefaultFolder(userId: string): void {
  localStorage.removeItem(`${STORAGE_PREFIX}${userId}`);
}
