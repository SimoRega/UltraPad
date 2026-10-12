import type { FileRecord } from "../../../../packages/contracts/src/index";
import { ancestors } from "./session";
export default function Breadcrumbs({
  workspace,
  project,
  file,
  files,
  home,
  openWorkspace,
  openProject,
  selectFolder,
}: {
  workspace?: { name: string };
  project?: { name: string };
  file?: FileRecord;
  files: FileRecord[];
  home: () => void;
  openWorkspace: () => void;
  openProject: () => void;
  selectFolder: (id: string) => void;
}) {
  return (
    <nav className="breadcrumbs" aria-label="Percorso">
      <button aria-label="Vai alla home" onClick={home}>
        UltraPad
      </button>
      {workspace && (
        <button
          aria-label={`Vai al workspace ${workspace.name}`}
          onClick={openWorkspace}
        >
          {workspace.name}
        </button>
      )}
      {project && (
        <button
          aria-label={`Vai al progetto ${project.name}`}
          onClick={openProject}
        >
          {project.name}
        </button>
      )}
      {file &&
        ancestors(file, files).map((f) => (
          <button key={f.id} onClick={() => selectFolder(f.id)}>
            {f.name}
          </button>
        ))}
      {file && <span aria-current="page">{file.name}</span>}
    </nav>
  );
}
