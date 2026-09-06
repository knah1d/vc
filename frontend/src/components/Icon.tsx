import type { CSSProperties } from "react";

const paths = {
  chat: "M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z",
  phone: "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.8 2.1Z",
  video: "m23 7-7 5 7 5V7ZM3 5h11a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z",
  send: "m22 2-7 20-4-9-9-4 20-7ZM22 2 11 13",
  plus: "M12 5v14M5 12h14",
  search: "m21 21-4.3-4.3M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
  arrow: "M19 12H5m7-7-7 7 7 7",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14 5-5-5-5M21 12H9",
  close: "m18 6-12 12M6 6l12 12",
  spark: "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z",
  mic: "M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3ZM5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8",
} as const;

export default function Icon({ name, size = 20 }: { name: keyof typeof paths; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}

export function Avatar({ name, large = false, small = false }: { name: string; large?: boolean; small?: boolean }) {
  const hue = [...name].reduce((value, char) => value + char.charCodeAt(0), 0) % 360;
  return <span className={`inline-flex shrink-0 items-center justify-center border border-white/70 bg-[linear-gradient(140deg,hsl(var(--avatar-hue)_44%_93%),hsl(var(--avatar-hue)_38%_83%))] font-display font-bold text-[hsl(var(--avatar-hue)_22%_35%)] shadow-[inset_0_1px_1px_#fff9] ${large ? "size-21 rounded-[29px] text-2xl" : small ? "size-8 rounded-xl text-[10px]" : "size-11 rounded-2xl text-sm"}`} style={{ "--avatar-hue": hue } as CSSProperties}>{name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?"}</span>;
}
