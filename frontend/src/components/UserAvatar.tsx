import React, { useMemo, useState } from 'react';

export type UserAvatarProps = {
  name: string;
  photo?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  title?: string;
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return (name.trim().charAt(0) || '?').toUpperCase();
}

const UserAvatar: React.FC<UserAvatarProps> = ({
  name,
  photo,
  size = 'md',
  className = '',
  title,
}) => {
  const [photoFailed, setPhotoFailed] = useState(false);
  const initials = useMemo(() => initialsFromName(name), [name]);
  const showPhoto = photo && !photoFailed;

  return (
    <span
      className={`user-avatar-chip user-avatar-chip--${size} ${className}`.trim()}
      title={title ?? name}
      aria-hidden={title ? undefined : true}
    >
      {showPhoto ? (
        <img
          src={photo}
          alt=""
          className="user-avatar-chip__photo"
          onError={() => setPhotoFailed(true)}
        />
      ) : (
        <span className="user-avatar-chip__initials">{initials}</span>
      )}
    </span>
  );
};

export default UserAvatar;
