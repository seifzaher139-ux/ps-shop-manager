export interface Clock {
  now(): number;
}
export const clock: Clock = { now: () => Date.now() };
export interface FileSaver {
  saveFile(name: string, blob: Blob): Promise<void>;
}
export const fileSaver: FileSaver = {
  async saveFile(name, blob) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  },
};
export function safeFilename(s: string) {
  return Array.from(s)
    .filter((c) => c.charCodeAt(0) > 31)
    .join('')
    .replace(/[<>:"/\\|?*]/g, '-')
    .slice(0, 180);
}
