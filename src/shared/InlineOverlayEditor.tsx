import * as AntdIcons from '@ant-design/icons';
import { Checkbox, Input } from 'antd';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

export type ChoiceOption = { label: React.ReactNode; value: any; color?: string };

const iconEntries = Object.entries(AntdIcons).filter(
  ([name, component]) =>
    /(Outlined|Filled|TwoTone)$/.test(name) &&
    (typeof component === 'function' || (typeof component === 'object' && component !== null)),
) as Array<[string, React.ElementType]>;

type BaseOptions = {
  cell: HTMLElement;
  value: any;
  onSave: (value: any) => Promise<void>;
  onError: (error: any) => void;
};

function createHost(cell: HTMLElement) {
  const host = document.createElement('div');
  host.dataset.ningInlineEditor = 'true';
  host.style.cssText =
    'position:fixed;z-index:1400;box-sizing:border-box;background:#fff;border:1px solid #d9d9d9;border-radius:6px;box-shadow:0 6px 20px rgba(0,0,0,.16);overflow:hidden;';
  const position = () => {
    const rect = cell.getBoundingClientRect();
    const width = Math.max(120, rect.width);
    host.style.left = `${Math.min(Math.max(8, rect.left), window.innerWidth - width - 8)}px`;
    host.style.top = `${Math.min(rect.bottom + 4, window.innerHeight - 280)}px`;
    host.style.width = `${Math.min(width, window.innerWidth - 16)}px`;
  };
  document.body.appendChild(host);
  position();
  window.addEventListener('resize', position);
  window.addEventListener('scroll', position, true);
  return {
    host,
    destroy() {
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
      host.remove();
    },
  };
}

export function openChoiceEditor(
  options: BaseOptions & { choices: ChoiceOption[]; multiple: boolean },
) {
  const host = createHost(options.cell);
  const root = createRoot(host.host);
  const close = () => {
    root.unmount();
    host.destroy();
  };

  function Editor() {
    const [selected, setSelected] = useState<any[]>(
      Array.isArray(options.value) ? options.value : options.value == null ? [] : [options.value],
    );
    const selectedRef = useRef(selected);
    selectedRef.current = selected;
    const saving = useRef(false);

    const saveAndClose = async (value: any) => {
      if (saving.current) return;
      saving.current = true;
      try {
        await options.onSave(value);
        close();
      } catch (error) {
        saving.current = false;
        options.onError(error);
      }
    };

    useEffect(() => {
      const outside = (event: PointerEvent) => {
        if (host.host.contains(event.target as Node)) return;
        if (options.multiple) void saveAndClose(selectedRef.current);
        else close();
      };
      const escape = (event: KeyboardEvent) => event.key === 'Escape' && close();
      const timer = window.setTimeout(() => document.addEventListener('pointerdown', outside, true), 0);
      document.addEventListener('keydown', escape, true);
      return () => {
        window.clearTimeout(timer);
        document.removeEventListener('pointerdown', outside, true);
        document.removeEventListener('keydown', escape, true);
      };
    }, []);

    return (
      <div style={{ maxHeight: 260, overflow: 'auto', padding: 6 }}>
        {options.choices.map((choice, index) => {
          const checked = selected.some((value) => Object.is(value, choice.value));
          return (
            <div
              key={index}
              onClick={() => {
                if (!options.multiple) return void saveAndClose(choice.value);
                setSelected((current) =>
                  current.some((value) => Object.is(value, choice.value))
                    ? current.filter((value) => !Object.is(value, choice.value))
                    : [...current, choice.value],
                );
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, minHeight: 34, padding: '5px 8px',
                borderRadius: 4, cursor: 'pointer', background: checked ? '#e6f4ff' : '#fff',
              }}
            >
              {options.multiple && <Checkbox checked={checked} />}
              {choice.color && <span style={{ width: 8, height: 8, borderRadius: 8, background: choice.color }} />}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{choice.label}</span>
            </div>
          );
        })}
      </div>
    );
  }
  root.render(<Editor />);
}

export function openIconEditor(options: BaseOptions) {
  const host = createHost(options.cell);
  host.host.style.width = `${Math.max(320, options.cell.getBoundingClientRect().width)}px`;
  const root = createRoot(host.host);
  const close = () => {
    root.unmount();
    host.destroy();
  };

  function Editor() {
    const [query, setQuery] = useState('');
    const entries = useMemo(
      () => iconEntries.filter(([name]) => name.toLowerCase().includes(query.trim().toLowerCase())),
      [query],
    );
    useEffect(() => {
      const outside = (event: PointerEvent) => !host.host.contains(event.target as Node) && close();
      const timer = window.setTimeout(() => document.addEventListener('pointerdown', outside, true), 0);
      return () => {
        window.clearTimeout(timer);
        document.removeEventListener('pointerdown', outside, true);
      };
    }, []);
    return (
      <div style={{ padding: 10 }}>
        <Input.Search autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索图标" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 28px)', gap: 7, maxHeight: 250, overflow: 'auto', marginTop: 10 }}>
          {entries.map(([name, IconComponent]) => (
            <button
              key={name}
              title={name}
              onClick={async () => {
                try { await options.onSave(name); close(); } catch (error) { options.onError(error); }
              }}
              style={{ width: 28, height: 28, border: 0, borderRadius: 4, background: options.value === name ? '#e6f4ff' : '#fff', cursor: 'pointer' }}
            >
              <IconComponent />
            </button>
          ))}
        </div>
      </div>
    );
  }
  root.render(<Editor />);
}
