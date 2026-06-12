import { useState, useRef, useEffect } from "react";
import { Mic, Square, Loader2 } from "lucide-react";

interface AudioRecorderProps {
  onRecorded: (blob: Blob) => void;
  onClose: () => void;
}

export function AudioRecorder({ onRecorded, onClose }: AudioRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    startRecording();
    return () => {
      mediaRef.current?.stop();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      mediaRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        onRecorded(blob);
      };

      recorder.start();
      setRecording(true);

      timerRef.current = setInterval(() => {
        setDuration((d) => {
          if (d >= 30) {
            stopRecording();
            return d;
          }
          return d + 1;
        });
      }, 1000);
    } catch {
      onClose();
    }
  };

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRef.current?.stop();
    setRecording(false);
  };

  return (
    <div className="flex items-center gap-3 p-3 border-t bg-muted/30">
      {recording ? (
        <>
          <div className="flex items-center gap-2 text-destructive">
            <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
            <span className="text-sm font-medium">Enregistrement...</span>
          </div>
          <span className="text-sm text-muted-foreground">{duration}s / 30s</span>
          <button
            onClick={stopRecording}
            className="ml-auto p-2 rounded-md bg-destructive text-destructive-foreground"
          >
            <Square size={16} />
          </button>
        </>
      ) : (
        <>
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm text-muted-foreground">Preparation...</span>
        </>
      )}
    </div>
  );
}
