import { useEffect, useRef } from "react";
export type MenuAction = { label: string; run: () => void; disabled?: boolean };
export default function ContextMenu({
  x,
  y,
  actions,
  close,
}: {
  x: number;
  y: number;
  actions: MenuAction[];
  close: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const menu = ref.current!;
    menu.style.left = `${Math.max(4, Math.min(x, innerWidth - menu.offsetWidth - 4))}px`;
    menu.style.top = `${Math.max(4, Math.min(y, innerHeight - menu.offsetHeight - 4))}px`;
    menu.querySelector<HTMLElement>("button:not(:disabled)")?.focus();
    const outside = (e: PointerEvent) => {
      if (!menu.contains(e.target as Node)) close();
    };
    window.addEventListener("pointerdown", outside);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", close);
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Azioni file"
      className="file-context-menu"
      style={{ left: x, top: y }}
      onKeyDown={(e) => {
        const buttons = Array.from(
          e.currentTarget.querySelectorAll<HTMLButtonElement>(
            "button:not(:disabled)",
          ),
        );
        const index = buttons.indexOf(
          document.activeElement as HTMLButtonElement,
        );
        if (e.key === "Escape" || e.key === "Tab") close();
        if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
          e.preventDefault();
          buttons[
            e.key === "Home"
              ? 0
              : e.key === "End"
                ? buttons.length - 1
                : (index + (e.key === "ArrowDown" ? 1 : -1) + buttons.length) %
                  buttons.length
          ]?.focus();
        }
      }}
    >
      {actions.map((action) => (
        <button
          role="menuitem"
          key={action.label}
          disabled={action.disabled}
          onClick={() => {
            close();
            action.run();
          }}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}
