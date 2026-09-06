import { useEffect, useState } from "react";
import { LiveKitRoom, ControlBar, RoomAudioRenderer, GridLayout, ParticipantTile, useTracks, useConnectionState, useRemoteParticipants } from "@livekit/components-react";
import { Track, ConnectionState } from "livekit-client";
import "@livekit/components-styles";
import type { CallMode } from "../lib/calls";
import { callError } from "../lib/calls";
import Icon, { Avatar } from "./Icon";
import CallDialog from "./CallDialog";
import { Eyebrow, GlassPanel, IconButton, Notice, StatusDot } from "./ui";

interface CallModalProps {
  token: string;
  serverUrl: string;
  mode: CallMode;
  otherName: string;
  onLeave: () => void;
  onError: (message: string) => void;
}

function CallStage({ mode, otherName, onError }: Pick<CallModalProps, "mode" | "otherName" | "onError">) {
  const connection = useConnectionState();
  const participants = useRemoteParticipants();
  const tracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }, { source: Track.Source.ScreenShare, withPlaceholder: false }]);
  const [seconds, setSeconds] = useState(0);
  const together = connection === ConnectionState.Connected && participants.length > 0;
  useEffect(() => {
    if (!together) return;
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [together]);
  const status = together ? `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}` : connection === ConnectionState.Connected ? "Waiting for the other person…" : connection === ConnectionState.Reconnecting ? "Reconnecting…" : "Connecting…";

  return <><div className="flex items-center justify-center gap-2 p-3 text-xs text-muted" role="status"><StatusDot online={together} />{status}</div>
    {mode === "voice" ? <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-8"><div className={`mb-8 rounded-full border border-lavender-200 p-6 ${together ? "animate-ring" : ""}`}><Avatar name={otherName} large /></div><h2 className="mt-2 text-2xl font-semibold">{otherName}</h2><p className="mt-2.5 mb-6 text-xs text-muted">Just the two of you. All ears.</p><div className="flex items-center gap-2 text-[10px] text-muted"><Icon name="mic" size={16} />Voice call · Camera off</div></div> : <GridLayout tracks={tracks} className="min-h-0 flex-1"><ParticipantTile /></GridLayout>}
    <RoomAudioRenderer />
    <ControlBar variation="minimal" saveUserChoices={false} controls={{ microphone: true, camera: mode === "video", screenShare: mode === "video", chat: false, leave: true }} onDeviceError={({ error }) => onError(callError(error))} />
  </>;
}

export default function CallModal({ token, serverUrl, mode, otherName, onLeave, onError }: CallModalProps) {
  const [deviceWarning, setDeviceWarning] = useState<string | null>(null);
  return (
    <CallDialog labelledBy="active-call-title" onClose={onLeave}>
      <GlassPanel className={`active-call flex w-full flex-col bg-lavender-50/95 p-4 sm:p-6 ${mode === "voice" ? "h-[min(630px,calc(100dvh-24px))] max-w-[530px]" : "h-[min(760px,calc(100dvh-24px))] max-w-[1000px]"}`}>
        <header className="flex items-center gap-3 pb-5">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-linear-to-br from-lavender-400 to-lavender-600 text-white"><Icon name={mode === "voice" ? "phone" : "video"} /></span>
          <div className="min-w-0 flex-1"><Eyebrow>A LITTLE CLOSER</Eyebrow><h2 id="active-call-title" className="mt-1 text-sm font-semibold wrap-anywhere">{mode === "voice" ? "Voice" : "Video"} call with {otherName}</h2></div>
          <IconButton autoFocus label="End call" onClick={onLeave}><Icon name="close" /></IconButton>
        </header>
        {deviceWarning && <Notice tone="error" className="mb-3">{deviceWarning}</Notice>}
        <LiveKitRoom token={token} serverUrl={serverUrl} connect video={mode === "video"} audio onDisconnected={onLeave} onError={(error) => onError(`Could not connect the call: ${callError(error)}`)} onMediaDeviceFailure={(failure, kind) => setDeviceWarning(`Couldn't access your ${kind === "videoinput" ? "camera" : "microphone"} (${failure || "device unavailable"}). Check browser permissions and your device.`)} className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl" data-lk-theme="default">
          <CallStage mode={mode} otherName={otherName} onError={setDeviceWarning} />
        </LiveKitRoom>
      </GlassPanel>
    </CallDialog>
  );
}
