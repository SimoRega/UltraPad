import Ocr from "./Ocr";
import { useEffect, useState } from "react";
import { request } from "../api";
import { Modal, useConfirmation } from "../Dialogs";
import { download } from "../files";
import { encryptEntry, decryptEntry, findEntries } from "./vault";
type Entry = {
  id: string;
  title: string;
  body: string;
  image?: string;
  encrypted: boolean;
  version: number;
};
export default function Calderone({ close }: { close: () => void }) {
  const [rows, setRows] = useState<Entry[]>([]);
  const [query, setQuery] = useState("");
  const [edit, setEdit] = useState<Entry>();
  const [pass, setPass] = useState("");
  const [plain, setPlain] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { confirm, confirmation } = useConfirmation();
  async function load() {
    try {
      setRows(await request("/calderone"));
      setError("");
    } catch (e) {
      setRows([]);
      setPlain({});
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
    return () => setPass("");
  }, []);
  const matches = findEntries(
    rows.map((r) => ({
      ...r,
      body: r.encrypted ? (plain[r.id] ?? "") : r.body,
    })),
    query,
  );
  return (
    <Modal title="Calderone · privato" close={close}>
      <p>
        Raccogli note, link e immagini. Cerca usando le parole che ricordi,
        anche in una frase. La ricerca è locale, senza invio a servizi AI.
      </p>
      <input
        autoFocus
        aria-label="Cerca nel Calderone"
        placeholder="Dove ho salvato il link del progetto?"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <button
        onClick={() => {
          setPass("");
          setEdit({
            id: crypto.randomUUID(),
            title: "Nuova nota",
            body: "",
            encrypted: false,
            version: 0,
          });
        }}
      >
        + Aggiungi
      </button>
      <button
        onClick={() => {
          setPlain({});
          setPass("");
        }}
      >
        Blocca segreti
      </button>
      <button
        onClick={() =>
          download(
            "calderone.json",
            JSON.stringify(
              { format: "ultrapad-calderone", version: 1, entries: rows },
              null,
              2,
            ),
          )
        }
      >
        Esporta copie
      </button>
      <p className="muted">
        I segreti sono cifrati nel browser con una passphrase che scegli tu.
        Titolo e immagini non sono cifrati: evita informazioni sensibili nel
        titolo. Non possiamo recuperare una passphrase perduta.
      </p>
      <div className="cauldron-results">
        {matches.map((r) => (
          <article key={r.id}>
            <h3>
              {r.title}
              {r.encrypted ? " · segreto" : ""}
            </h3>
            {!r.encrypted || plain[r.id] ? (
              <p>{r.body}</p>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = new FormData(e.currentTarget);
                  void decryptEntry(
                    rows.find((x) => x.id === r.id)!.body,
                    String(form.get("pass")),
                  )
                    .then((text) => setPlain((v) => ({ ...v, [r.id]: text })))
                    .catch((e) => setError(e.message));
                }}
              >
                <input
                  name="pass"
                  type="password"
                  autoComplete="off"
                  required
                  minLength={12}
                  aria-label={`Passphrase per ${r.title}`}
                />
                <button>Sblocca per questa sessione</button>
              </form>
            )}
            {r.image && <img src={r.image} alt={r.title} />}
            <button
              disabled={r.encrypted && !plain[r.id]}
              onClick={() => {
                setPass("");
                setEdit({ ...r, body: r.encrypted ? plain[r.id] : r.body });
              }}
            >
              Modifica
            </button>
            <button
              disabled={busy}
              onClick={async () => {
                if (
                  !(await confirm(
                    "Eliminare definitivamente questa voce? Esporta prima una copia.",
                  ))
                )
                  return;
                setBusy(true);
                try {
                  await request("/calderone", {
                    ...rows.find((x) => x.id === r.id),
                    delete: true,
                  });
                  await load();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Elimina
            </button>
          </article>
        ))}
      </div>
      {edit && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setBusy(true);
            void (async () => {
              try {
                const body = edit.encrypted
                  ? await encryptEntry(edit.body, pass)
                  : edit.body;
                await request("/calderone", { ...edit, body });
                setEdit(undefined);
                setPass("");
                await load();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            })();
          }}
        >
          <h3>Voce del Calderone</h3>
          <label>
            Titolo
            <input
              required
              maxLength={120}
              value={edit.title}
              onChange={(e) => setEdit({ ...edit, title: e.target.value })}
            />
          </label>
          <label>
            Testo, link o trascrizione dell’immagine
            <textarea
              required
              maxLength={100000}
              value={edit.body}
              onChange={(e) => setEdit({ ...edit, body: e.target.value })}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={edit.encrypted}
              onChange={(e) =>
                setEdit({ ...edit, encrypted: e.target.checked })
              }
            />
            Cifra il testo sensibile
          </label>
          {edit.encrypted && (
            <label>
              Passphrase per la nuova copia
              <input
                type="password"
                autoComplete="off"
                minLength={12}
                required
                value={pass}
                onChange={(e) => setPass(e.target.value)}
              />
            </label>
          )}
          <label>
            Immagine PNG/JPEG/WebP, massimo 400 KiB
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (
                  f.size > 400 * 1024 ||
                  !["image/png", "image/jpeg", "image/webp"].includes(f.type)
                ) {
                  setError("Immagine non supportata o troppo grande.");
                  return;
                }
                const reader = new FileReader();
                reader.onload = () =>
                  setEdit({ ...edit, image: String(reader.result) });
                reader.readAsDataURL(f);
              }}
            />
          </label>
          {edit.image && (
            <Ocr
              image={edit.image}
              accept={(text) =>
                setEdit({ ...edit, body: edit.body + "\n" + text })
              }
            />
          )}
          <button disabled={busy}>Salva voce privata</button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setEdit(undefined);
              setPass("");
            }}
          >
            Annulla
          </button>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
      {confirmation}
    </Modal>
  );
}
