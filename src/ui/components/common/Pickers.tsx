import { useState } from 'react';

export function IconPicker({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" className="btn btn-outline" onClick={() => setOpen(!open)} style={{ fontSize: 24, width: 64, height: 56 }}>
        {value || '😀'}
      </button>
      {open && (
        <div
          className="card"
          style={{
            marginTop: 8,
            padding: 10,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(44px, 1fr))',
            gap: 6,
            maxHeight: 180,
            overflowY: 'auto',
          }}
        >
          {options.map((icon) => (
            <button
              key={icon}
              type="button"
              className={value === icon ? 'icon-btn' : 'icon-btn'}
              style={{
                fontSize: 22,
                background: value === icon ? 'var(--primary-soft)' : undefined,
                border: value === icon ? '2px solid var(--primary)' : undefined,
              }}
              onClick={() => {
                onChange(icon);
                setOpen(false);
              }}
            >
              {icon}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ColorPicker({ value, onChange, colors }: { value: string; onChange: (v: string) => void; colors: string[] }) {
  return (
    <div className="row" style={{ flexWrap: 'wrap' }}>
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          aria-label={c}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: c,
            border: value === c ? '3px solid #0f172a' : '2px solid transparent',
            boxShadow: value === c ? '0 0 0 3px rgba(37,99,235,.3)' : undefined,
          }}
        />
      ))}
    </div>
  );
}