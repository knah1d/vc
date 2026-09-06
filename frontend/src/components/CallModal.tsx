import { LiveKitRoom, VideoConference } from "@livekit/components-react";
import "@livekit/components-styles";

interface CallModalProps {
  token: string;
  serverUrl: string;
  onLeave: () => void;
}

export default function CallModal({ token, serverUrl, onLeave }: CallModalProps) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#000",
        zIndex: 1000,
      }}
    >
      <LiveKitRoom
        token={token}
        serverUrl={serverUrl}
        connect
        video
        audio
        onDisconnected={onLeave}
        style={{ height: "100%" }}
      >
        <VideoConference />
      </LiveKitRoom>
    </div>
  );
}
