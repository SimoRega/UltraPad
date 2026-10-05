import type { FileRecord } from '../../../packages/contracts/src/index';
import type { Role } from '../../../packages/domain/src/index';
import type { CollaborationClient } from '../../../packages/collaboration-client/src/index';
import type { RichOp } from '../../../packages/rich-text/src/index';
export type EditorProps={file:FileRecord;userId:string;role:Role;initialText?:string;initialDelta?:RichOp[];clearInitial:()=>void;clientChanged:(client:CollaborationClient|null)=>void;localText?:string;localDelta?:RichOp[];contentChanged?:(text:string)=>void;localChanged?:(text:string,delta?:RichOp[])=>void};
