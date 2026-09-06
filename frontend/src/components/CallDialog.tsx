import { useEffect, useRef, type ReactNode } from "react";

export default function CallDialog({ children, labelledBy, onClose }: { children: ReactNode; labelledBy: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return <dialog ref={dialog} className="call-dialog fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none items-center justify-center border-0 bg-transparent p-3 text-ink open:flex sm:p-6" aria-labelledby={labelledBy} onCancel={(event) => { event.preventDefault(); onClose(); }}>{children}</dialog>;
}
