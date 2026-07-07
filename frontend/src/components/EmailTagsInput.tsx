import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { GoogleContact } from '../types/domain';

export interface EmailTagValue {
  email: string;
  name?: string;
}

interface EmailTagsInputProps {
  id: string;
  label: string;
  value: EmailTagValue[];
  onChange: (value: EmailTagValue[]) => void;
  contacts?: GoogleContact[];
  disabled?: boolean;
  placeholder?: string;
  hint?: string;
  required?: boolean;
}

const isValidEmail = (raw: string): boolean => raw.includes('@') && raw.includes('.');

const ContactAvatar: React.FC<{ name: string; photo: string | null }> = ({ name, photo }) => {
  const [photoFailed, setPhotoFailed] = useState(false);
  const initial = name.charAt(0).toUpperCase() || '?';

  if (!photo || photoFailed) {
    return (
      <span className="email-tags-autocomplete-initial" aria-hidden="true">
        {initial}
      </span>
    );
  }

  return (
    <img
      src={photo}
      alt=""
      className="email-tags-autocomplete-photo"
      onError={() => setPhotoFailed(true)}
    />
  );
};

const EmailTagsInput: React.FC<EmailTagsInputProps> = ({
  id,
  label,
  value,
  onChange,
  contacts = [],
  disabled = false,
  placeholder = 'Adicionar e-mail...',
  hint,
  required = false,
}) => {
  const listId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const selectedEmails = useMemo(() => new Set(value.map((tag) => tag.email.toLowerCase())), [value]);

  const suggestions = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];

    return contacts
      .filter((contact) => {
        if (selectedEmails.has(contact.email.toLowerCase())) return false;
        return (
          contact.name.toLowerCase().includes(term)
          || contact.email.toLowerCase().includes(term)
        );
      })
      .slice(0, 20);
  }, [contacts, query, selectedEmails]);

  const addTag = useCallback(
    (email: string, name?: string) => {
      const normalized = email.trim().toLowerCase();
      if (!isValidEmail(normalized) || selectedEmails.has(normalized)) {
        return;
      }
      onChange([...value, { email: normalized, name: name?.trim() || undefined }]);
      setQuery('');
      setOpen(false);
      setActiveIndex(-1);
    },
    [onChange, selectedEmails, value],
  );

  const removeTag = useCallback(
    (email: string) => {
      onChange(value.filter((tag) => tag.email !== email));
    },
    [onChange, value],
  );

  useEffect(() => {
    if (!open) setActiveIndex(-1);
    else if (activeIndex >= suggestions.length) setActiveIndex(suggestions.length - 1);
  }, [activeIndex, open, suggestions.length]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!open && suggestions.length > 0) setOpen(true);
      setActiveIndex((prev) => (prev + 1) % Math.max(suggestions.length, 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open && suggestions.length > 0) setOpen(true);
      setActiveIndex((prev) => {
        if (suggestions.length === 0) return -1;
        if (prev <= 0) return suggestions.length - 1;
        return prev - 1;
      });
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      if (open && activeIndex >= 0 && suggestions[activeIndex]) {
        const contact = suggestions[activeIndex];
        addTag(contact.email, contact.name);
        return;
      }
      if (isValidEmail(query.trim())) {
        addTag(query.trim());
      }
      return;
    }

    if (event.key === 'Backspace' && query === '' && value.length > 0) {
      onChange(value.slice(0, -1));
    }

    if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className="form-group email-tags-field">
      <label htmlFor={id}>{label}</label>
      <div className="email-tags-autocomplete" ref={wrapperRef}>
        <div
          className="email-tags-input-wrapper"
          onClick={() => {
            if (!disabled) inputRef.current?.focus();
          }}
        >
          {value.map((tag) => (
            <div key={tag.email} className="email-tag" data-email={tag.email}>
              <span>{tag.name || tag.email}</span>
              {!disabled && (
                <button
                  type="button"
                  className="email-tag-remove"
                  aria-label={`Remover ${tag.email}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    removeTag(tag.email);
                  }}
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <input
            ref={inputRef}
            id={id}
            type="text"
            value={query}
            autoComplete="off"
            placeholder={value.length === 0 ? placeholder : ''}
            disabled={disabled}
            required={required && value.length === 0}
            onChange={(event) => {
              const next = event.target.value;
              setQuery(next);
              setOpen(next.trim().length > 0);
              setActiveIndex(-1);
            }}
            onFocus={() => {
              if (query.trim()) setOpen(true);
            }}
            onKeyDown={handleKeyDown}
            aria-expanded={open && suggestions.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
          />
        </div>

        {open && suggestions.length > 0 && (
          <div id={listId} className="email-tags-autocomplete-list" role="listbox">
            {suggestions.map((contact, index) => (
              <button
                key={contact.email}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                className={`email-tags-autocomplete-item${index === activeIndex ? ' email-tags-autocomplete-item--active' : ''}`}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => addTag(contact.email, contact.name)}
              >
                <ContactAvatar name={contact.name} photo={contact.photo} />
                <span className="email-tags-autocomplete-info">
                  <span className="email-tags-autocomplete-name">{contact.name}</span>
                  <span className="email-tags-autocomplete-email">{contact.email}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      {hint && <span className="gerencial-email-hint">{hint}</span>}
    </div>
  );
};

export default EmailTagsInput;
