import type { ComponentProps, ReactNode } from "react";
import { Link } from "react-router-dom";
import Icon from "./Icon";

export function GlassPanel({ className = "", ...props }: ComponentProps<"div">) {
  return <div className={`glass-panel rounded-3xl ${className}`} {...props} />;
}

const buttonStyles = {
  primary: "border-white/30 bg-linear-to-br from-lavender-500 to-lavender-600 text-white shadow-button hover:brightness-105",
  secondary: "border-white/90 bg-white/65 text-lavender-700 hover:bg-white",
  danger: "border-rose-200/60 bg-rose-100 text-rose-700 hover:bg-rose-200/80",
  accept: "border-white/30 bg-linear-to-br from-mint-500 to-mint-600 text-white shadow-button hover:brightness-105",
};

export function Button({ variant = "primary", className = "", type = "button", ...props }: ComponentProps<"button"> & { variant?: keyof typeof buttonStyles }) {
  return <button type={type} className={`inline-flex shrink-0 items-center justify-center gap-2.5 rounded-xl border px-5 py-3 text-sm font-semibold transition enabled:active:translate-y-px ${buttonStyles[variant]} ${className}`} {...props} />;
}

export function IconButton({ label, className = "", type = "button", ...props }: ComponentProps<"button"> & { label: string }) {
  return <button type={type} title={label} aria-label={label} className={`inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/70 bg-white/45 text-lavender-700 transition hover:bg-white/90 ${className}`} {...props} />;
}

export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return <input className={`w-full min-w-0 rounded-xl border border-lavender-200/60 bg-white/65 px-4 py-3.5 text-sm text-ink outline-none placeholder:text-faint focus:border-lavender-400 focus:bg-white/90 focus:ring-3 focus:ring-lavender-200/40 ${className}`} {...props} />;
}

export function Brand() {
  return <Link to="/" aria-label="Hush home" className="inline-flex items-center font-display text-3xl font-extrabold tracking-[-1.8px] text-ink"><span className="mr-2.5 grid size-10 place-items-center rounded-[14px] bg-linear-to-br from-lavender-400 to-lavender-600 text-white shadow-button"><Icon name="chat" size={23} /></span>hush<span className="text-lavender-500">.</span></Link>;
}

export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`text-[10px] font-bold tracking-[.18em] text-muted ${className}`}>{children}</span>;
}

export function Notice({ children, tone = "info", className = "" }: { children: ReactNode; tone?: "error" | "info"; className?: string }) {
  return <div role={tone === "error" ? "alert" : "status"} className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-xs leading-relaxed wrap-anywhere ${tone === "error" ? "border-rose-200 bg-rose-50/95 text-rose-800" : "border-lavender-200/70 bg-lavender-50/95 text-lavender-800"} ${className}`}>{children}</div>;
}

export function StatusDot({ online }: { online: boolean }) {
  return <i aria-hidden="true" className={`inline-block size-1.5 shrink-0 rounded-full ring-3 ${online ? "bg-mint-500 ring-mint-400/15" : "bg-amber-500 ring-amber-400/15"}`} />;
}
