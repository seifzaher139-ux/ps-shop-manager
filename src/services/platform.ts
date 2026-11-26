export interface Clock {now():number;}
export const clock:Clock={now:()=>Date.now()};
export interface FileSaver {saveFile(name:string,blob:Blob):Promise<void>;}
export const fileSaver:FileSaver={async saveFile(name,blob){const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}};
export function safeFilename(s:string){return s.replace(/[<>:"/\\|?*\u0000-\u001f]/g,'-').slice(0,180);}
