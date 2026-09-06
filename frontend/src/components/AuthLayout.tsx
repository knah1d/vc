import type { ReactNode } from "react";
import Icon from "./Icon";
import { Brand, Eyebrow, GlassPanel } from "./ui";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[460px] flex-col gap-7 px-6 py-8 md:grid md:max-w-[1220px] md:grid-cols-[1.15fr_1fr] md:items-center md:gap-12 md:px-10 md:py-12 lg:gap-20">
      <div className="flex w-full flex-col justify-between md:min-h-[660px]">
        <Brand />
        <div className="mt-8 md:my-12">
          <Eyebrow className="hidden md:inline">A LITTLE CLOSER, EVEN FROM HERE</Eyebrow>
          <h1 className="my-4 text-3xl leading-[1.3] font-semibold tracking-[-1.5px] lg:text-[44px]">Good conversations.<br /><span className="text-lavender-600">Closer connections.</span></h1>
          <p className="hidden max-w-sm text-sm leading-8 text-muted md:block">A space for your people. Drop a message, hear a familiar voice, or catch up face to face.</p>
          <div className="relative mt-9 hidden h-56 w-full max-w-[400px] md:block" aria-hidden="true">
            <div className="absolute top-3 left-2 h-44 w-75 -rotate-18 rounded-[50%] border border-lavender-300/25" />
            <div className="absolute top-8 left-2 h-36 w-78 rotate-24 rounded-[50%] border border-lavender-300/25" />
            <div className="glass-panel absolute top-5 left-0 flex -rotate-5 items-center gap-3 rounded-2xl rounded-bl-sm p-5 text-sm text-lavender-700">
              <Icon name="chat" size={28} /><span>Hey, you around?</span><span className="self-end text-[9px] text-muted">Just now</span>
            </div>
            <div className="glass-panel absolute right-0 bottom-8 flex rotate-5 items-center gap-3 rounded-2xl rounded-br-sm bg-lavender-200/60 p-5 text-lavender-700">
              <span className="flex h-11 items-center gap-[3px]">{Array.from({ length: 17 }, (_, i) => <b key={i} className="w-[3px] rounded bg-lavender-400" style={{ height: `${12 + (i * 13 % 30)}px` }} />)}</span>
              <Icon name="mic" /><span className="text-xs">Always.</span>
            </div>
            <span className="absolute top-2 right-2 text-mint-500"><Icon name="spark" size={32} /></span>
          </div>
        </div>
        <p className="hidden text-xs tracking-wide text-muted md:block">Less distance. More you.</p>
      </div>
      <GlassPanel className="w-full p-7 lg:p-10">{children}</GlassPanel>
    </main>
  );
}
