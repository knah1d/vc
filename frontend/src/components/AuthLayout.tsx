import type { ReactNode } from "react";
import Icon from "./Icon";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <main className="auth-page">
    <div className="auth-story">
      <a href="/" className="brand"><span className="brand-mark"><Icon name="chat" size={24} /></span>hush<span className="brand-dot">.</span></a>
      <div className="auth-story-copy"><span className="eyebrow">A LITTLE CLOSER, EVEN FROM HERE</span><h1>Good conversations.<br /><em>Closer connections.</em></h1><p>A space for your people. Drop a message, hear a familiar voice, or catch up face to face.</p>
        <div className="connection-art" aria-hidden="true"><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><div className="art-bubble bubble-one"><Icon name="chat" size={28} /><span>Hey, you around?</span><i>Just now</i></div><div className="art-bubble bubble-two"><span className="waveform">{Array.from({ length: 17 }, (_, i) => <b key={i} style={{ height: `${12 + (i * 13 % 30)}px` }} />)}</span><Icon name="mic" /><span>Always.</span></div><span className="art-spark"><Icon name="spark" size={32} /></span></div>
      </div><p className="auth-footnote">Less distance. More you.</p>
    </div><section className="auth-card glass">{children}</section>
  </main>;
}
