import type { DragEventHandler } from "react";
import FileIcon from "./FileIcon";
export default function FileTab({
  name,
  active,
  select,
  close,
  disabled = false,
  drag,
  dragging = false,
}: {
  name: string;
  active: boolean;
  select: () => void;
  close: () => void;
  disabled?: boolean;
  dragging?: boolean;
  drag?: {
    start: DragEventHandler<HTMLSpanElement>;
    end: DragEventHandler<HTMLSpanElement>;
    over: DragEventHandler<HTMLSpanElement>;
    leave: DragEventHandler<HTMLSpanElement>;
    drop: DragEventHandler<HTMLSpanElement>;
  };
}) {
  return (
    <span
      className={`file-tab ${active ? "active" : ""} ${dragging ? "drop-target" : ""}`}
      draggable={Boolean(drag) && !disabled}
      onDragStart={drag?.start}
      onDragEnd={drag?.end}
      onDragOver={drag?.over}
      onDragLeave={drag?.leave}
      onDrop={drag?.drop}
    >
      <button
        className="tab-select"
        draggable={Boolean(drag) && !disabled}
        title={name}
        aria-label={`Apri ${name}`}
        aria-current={active ? "page" : undefined}
        onClick={select}
        disabled={disabled}
      >
        <FileIcon name={name} />
        <span className="tab-title">{name}</span>
      </button>
      <button
        className="tab-close"
        aria-label={`Chiudi ${name}`}
        disabled={disabled}
        onClick={close}
      >
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16">
          <path
            d="M4 4l8 8M12 4l-8 8"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </span>
  );
}
