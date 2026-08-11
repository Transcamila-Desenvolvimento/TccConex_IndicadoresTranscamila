import React, { useMemo, useRef, useState } from 'react';
import UserAvatar from './UserAvatar';
import type { UserDirectoryEntry } from '../types/domain';

type MentionCommentInputProps = {
  team: UserDirectoryEntry[];
  value: string;
  onChange: (value: string) => void;
  mencoes: string[];
  onMencoesChange: (ids: string[]) => void;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder?: string;
};

const MentionCommentInput: React.FC<MentionCommentInputProps> = ({
  team,
  value,
  onChange,
  mencoes,
  onMencoesChange,
  onSubmit,
  disabled,
  placeholder = 'Escreva um comentário... Use @ para mencionar',
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);

  const mentionOptions = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return team.filter((m) => m.name.toLowerCase().includes(q)).slice(0, 6);
  }, [mentionQuery, team]);

  const handleChange = (next: string) => {
    onChange(next);
    const match = next.match(/@([\wÀ-ú\s]*)$/);
    setMentionQuery(match ? match[1].trim() : null);
  };

  const pickMention = (member: UserDirectoryEntry) => {
    const firstName = member.name.split(' ')[0];
    const replaced = value.replace(/@[\wÀ-ú\s]*$/, `@${firstName} `);
    onChange(replaced);
    if (!mencoes.includes(member.id)) {
      onMencoesChange([...mencoes, member.id]);
    }
    setMentionQuery(null);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && mentionOptions.length === 0) {
      e.preventDefault();
      onSubmit();
    }
    if (e.key === 'Escape') setMentionQuery(null);
  };

  return (
    <div className="mkt-mention-input-wrap">
      {mentionQuery !== null && mentionOptions.length > 0 && (
        <ul className="mkt-mention-dropdown" role="listbox">
          {mentionOptions.map((member) => (
            <li key={member.id}>
              <button type="button" onClick={() => pickMention(member)}>
                <UserAvatar name={member.name} photo={member.googlePicture} size="sm" />
                <span>{member.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        ref={inputRef}
        className="form-input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
      />
    </div>
  );
};

export default MentionCommentInput;

export function renderCommentText(texto: string, mencoes: UserDirectoryEntry[] = []) {
  if (!mencoes.length) return texto;
  const parts: React.ReactNode[] = [];
  let remaining = texto;
  let key = 0;
  const names = mencoes.map((m) => m.name.split(' ')[0]).sort((a, b) => b.length - a.length);

  while (remaining.length > 0) {
    let found = false;
    for (const name of names) {
      const token = `@${name}`;
      const idx = remaining.indexOf(token);
      if (idx >= 0) {
        if (idx > 0) parts.push(<span key={key++}>{remaining.slice(0, idx)}</span>);
        parts.push(<strong key={key++} className="mkt-mention">{token}</strong>);
        remaining = remaining.slice(idx + token.length);
        found = true;
        break;
      }
    }
    if (!found) {
      parts.push(<span key={key++}>{remaining}</span>);
      break;
    }
  }
  return parts;
}
