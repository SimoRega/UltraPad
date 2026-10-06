import { useState } from "react";
const groups = {
  Visi: [
    "😀",
    "😃",
    "😊",
    "😍",
    "😎",
    "🤓",
    "🥳",
    "🤔",
    "🫡",
    "🤖",
    "👻",
    "👽",
  ],
  Natura: [
    "🐶",
    "🐱",
    "🦊",
    "🐼",
    "🐸",
    "🐝",
    "🌸",
    "🌻",
    "🌴",
    "🌱",
    "🍀",
    "🌍",
  ],
  Oggetti: [
    "🧪",
    "⚗️",
    "📚",
    "📝",
    "💻",
    "🎮",
    "🎨",
    "🎸",
    "📷",
    "🔬",
    "💡",
    "🔧",
    "📅",
    "📊",
    "🗂️",
    "💼",
  ],
  Viaggi: ["🚀", "✈️", "🚗", "🚐", "⛺", "🏔️", "🏠", "🏖️", "🗾", "🏯"],
  Simboli: ["❤️", "💜", "💙", "💚", "⭐", "🔥", "✨", "🎯", "✅", "🏐"],
};
export default function EmojiPicker({
  value,
  change,
}: {
  value: string;
  change: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="emoji-picker">
      <button
        type="button"
        aria-label="Scegli emoji del workspace"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {value || "☺"} <sup>+</sup>
      </button>
      {open && (
        <section aria-label="Emoji del workspace">
          <p>Emoji Android · Noto Color Emoji</p>
          {Object.entries(groups).map(([name, items]) => (
            <div key={name}>
              <h3>{name}</h3>
              <div className="emoji-grid">
                {items.map((e) => (
                  <button
                    key={e}
                    type="button"
                    aria-label={`Emoji ${e}`}
                    onClick={() => {
                      change(e);
                      setOpen(false);
                    }}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => {
              change("");
              setOpen(false);
            }}
          >
            Rimuovi emoji
          </button>
        </section>
      )}
    </div>
  );
}
