import { useEffect, useRef, useState, type ReactNode } from "react";
export default function ToolMenu({
  label,
  children,
  open: controlled,
  onToggle,
  className = "",
}: {
  label: string;
  children: ReactNode;
  open?: boolean;
  onToggle?: (value: boolean) => void;
  className?: string;
}) {
  const key = `ultrapad-pin:${label}`;
  const [pinned, setPinned] = useState(() => {
    try {
      return localStorage.getItem(key) === "true";
    } catch {
      return false;
    }
  });
  const [local, setLocal] = useState(false);
  const open = pinned || (controlled ?? local);
  const host = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const change = (value: boolean) => {
    setLocal(value);
    onToggle?.(value);
  };
  useEffect(() => {
    if (!open || pinned) return;
    const outside = (e: PointerEvent) => {
      if (!host.current?.contains(e.target as Node)) change(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        change(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open, pinned]);
  return (
    <div
      ref={host}
      className={`tool-menu ${pinned ? "pinned" : ""} ${className}`}
    >
      <button
        ref={trigger}
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => change(!open)}
      >
        {label} <span aria-hidden="true">⌄</span>
      </button>
      {open && (
        <div className="tool-popover" role="region" aria-label={label}>
          <button
            className="tool-pin"
            type="button"
            aria-label={`${pinned ? "Sblocca" : "Fissa"} ${label}`}
            aria-pressed={pinned}
            title={pinned ? "Sblocca barra" : "Fissa barra aperta"}
            onClick={() => {
              const next = !pinned;
              setPinned(next);
              change(next);
              try {
                localStorage.setItem(key, String(next));
              } catch {
                /* Preference optional. */
              }
            }}
          >
            <svg
              aria-hidden="true"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="m8 3 8 0-2 7 4 4H6l4-4-2-7ZM12 14v7" />
            </svg>
            {pinned ? "Sblocca barra" : "Fissa aperta"}
          </button>
          {children}
        </div>
      )}
    </div>
  );
}
