import type {SelectionAnchor} from './v16/Discussion';
import type { FileRecord } from '../../../packages/contracts/src/index';
import type { Role } from '../../../packages/domain/src/index';
import type { CollaborationClient } from '../../../packages/collaboration-client/src/index';
import type { RichOp } from '../../../packages/rich-text/src/index';
export type EditorProps={relatedFiles?:FileRecord[];openRelated?:(file:Pick<FileRecord,'id'|'project_id'>,anchor?:SelectionAnchor,line?:number)=>void;selectionChanged?:(anchor:SelectionAnchor)=>void;jumpSelection?:SelectionAnchor;file:FileRecord;userId:string;role:Role;initialText?:string;initialDelta?:RichOp[];clearInitial:()=>void;clientChanged:(client:CollaborationClient|null)=>void;localText?:string;localDelta?:RichOp[];contentChanged?:(text:string)=>void;localChanged?:(text:string,delta?:RichOp[])=>void};
