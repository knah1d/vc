import { useEffect, useState } from "react";
import { LiveKitRoom, ControlBar, RoomAudioRenderer, GridLayout, ParticipantTile, useTracks, useConnectionState, useRemoteParticipants } from "@livekit/components-react";
import { Track, ConnectionState } from "livekit-client";
import "@livekit/components-styles";
import type { CallMode } from "../lib/calls";
import { callError } from "../lib/calls";
import Icon, { Avatar } from "./Icon";
import CallDialog from "./CallDialog";

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

  return <><div className="call-status" role="status"><i className={together ? "status-dot online" : "status-dot"} />{status}</div>
    {mode === "voice" ? <div className="voice-stage"><div className={`voice-orbit ${together ? "is-connected" : ""}`}><Avatar name={otherName} large /></div><h2>{otherName}</h2><p>Just the two of you. All ears.</p><div className="voice-label"><Icon name="mic" size={16} />Voice call · Camera off</div></div> : <GridLayout tracks={tracks} className="video-stage"><ParticipantTile /></GridLayout>}
    <RoomAudioRenderer />
    <ControlBar variation="minimal" saveUserChoices={false} controls={{ microphone: true, camera: mode === "video", screenShare: mode === "video", chat: false, leave: true }} onDeviceError={({ error }) => onError(callError(error))} />
  </>;
}

export default function CallModal({ token, serverUrl, mode, otherName, onLeave, onError }: CallModalProps) {
  const [deviceWarning, setDeviceWarning] = useState<string | null>(null);
  return <CallDialog labelledBy="active-call-title" onClose={onLeave}><section className={`active-call glass ${mode}-call`}><header className="call-heading"><span className="brand-mark"><Icon name={mode === "voice" ? "phone" : "video"} /></span><div><span className="eyebrow">A LITTLE CLOSER</span><h2 id="active-call-title">{mode === "voice" ? "Voice" : "Video"} call with {otherName}</h2></div><button autoFocus className="icon-button" aria-label="End call" title="End call" onClick={onLeave}><Icon name="close" /></button></header>
    {deviceWarning && <p className="notice error" role="alert">{deviceWarning}</p>}
    <LiveKitRoom token={token} serverUrl={serverUrl} connect video={mode === "video"} audio onDisconnected={onLeave} onError={(error) => onError(`Could not connect the call: ${callError(error)}`)} onMediaDeviceFailure={(failure, kind) => setDeviceWarning(`Couldn't access your ${kind === "videoinput" ? "camera" : "microphone"} (${failure || "device unavailable"}). Check browser permissions and your device.`)} className="livekit-room" data-lk-theme="default">
      <CallStage mode={mode} otherName={otherName} onError={setDeviceWarning} />
    </LiveKitRoom>
  </section></CallDialog>;
}
