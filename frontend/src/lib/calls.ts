export type CallMode = "voice" | "video";
export interface CallInvite {
  callId: string;
  conversationId: string;
  callerId: string;
  calleeId: string;
  mode: CallMode;
}

export function callError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") return "Microphone or camera access was blocked. Allow access in your browser and try again.";
    if (error.name === "NotFoundError") return "No microphone or camera was found. Check your devices, or try a voice call.";
    if (error.name === "NotReadableError") return "Your microphone or camera is busy. Close other apps using it and try again.";
    return error.message;
  }
  return "The call could not connect. Please try again.";
}

export async function checkMedia(mode: CallMode) {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    throw new Error("Calls need a secure connection. Open this app on localhost or use HTTPS.");
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: mode === "video" });
  stream.getTracks().forEach((track) => track.stop());
}
