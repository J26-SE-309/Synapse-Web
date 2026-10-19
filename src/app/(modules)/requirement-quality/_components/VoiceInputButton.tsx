"use client";

import { useEffect, useRef, useState } from "react";

type VoiceInputButtonProps = {
  onTranscription: (text: string) => void;
  disabled?: boolean;
};

const MAX_RECORDING_MS = 60_000;

export function VoiceInputButton({
  onTranscription,
  disabled = false,
}: VoiceInputButtonProps) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(false);
  const busyRef = useRef(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") recorder.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function stopRecording() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }

  async function startRecording() {
    if (busyRef.current || disabled) return;
    busyRef.current = true;
    setError(null);

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Audio recording is unavailable. Use localhost or HTTPS and a supported browser.");
      busyRef.current = false;
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mountedRef.current || disabled) {
        stream.getTracks().forEach((track) => track.stop());
        busyRef.current = false;
        return;
      }
      streamRef.current = stream;
      const mimeType = [
        "audio/webm;codecs=opus",
        "audio/mp4",
        "audio/webm",
        "audio/ogg;codecs=opus",
      ].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      chunksRef.current = [];
      let recordingFailed = false;

      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        recordingFailed = true;
        if (mountedRef.current) setError("Recording failed. Please try again.");
        stopRecording();
      };
      recorder.onstop = async () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = null;
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        if (!mountedRef.current) return;
        setIsRecording(false);
        if (recordingFailed) {
          busyRef.current = false;
          return;
        }
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (!blob.size) {
          setError("No audio was recorded. Please try again.");
          busyRef.current = false;
          return;
        }
        setIsTranscribing(true);
        try {
          const extension = blob.type.includes("mp4")
            ? "mp4"
            : blob.type.includes("ogg")
              ? "ogg"
              : "webm";
          const formData = new FormData();
          formData.append("audio", blob, `requirement.${extension}`);
          const response = await fetch("/requirement-quality/api/speech-to-text", {
            method: "POST",
            body: formData,
          });
          const data: { text?: string; error?: string } = await response.json();
          if (!response.ok) throw new Error(data.error || "Transcription failed.");
          if (!data.text?.trim()) throw new Error("No speech was detected.");
          if (mountedRef.current) onTranscription(data.text.trim());
        } catch (cause) {
          if (mountedRef.current) {
            setError(cause instanceof Error ? cause.message : "Unable to transcribe audio.");
          }
        } finally {
          busyRef.current = false;
          if (mountedRef.current) setIsTranscribing(false);
        }
      };
      recorder.start();
      setIsRecording(true);
      timerRef.current = setTimeout(stopRecording, MAX_RECORDING_MS);
    } catch {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      busyRef.current = false;
      if (mountedRef.current) setError("Microphone access failed. Check browser permissions.");
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={disabled || isTranscribing}
        onClick={isRecording ? stopRecording : startRecording}
        className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
          isRecording ? "bg-red-600 hover:bg-red-700" : "bg-zinc-900 hover:bg-zinc-700"
        }`}
      >
        <span aria-hidden="true">{isRecording ? "■" : "🎤"}</span>
        {isRecording ? "Stop recording" : isTranscribing ? "Converting speech..." : "Speak requirement"}
      </button>
      {isRecording && (
        <p role="status" className="text-sm text-red-600">
          Recording... Speak clearly. Recording stops automatically after 60 seconds.
        </p>
      )}
      {isTranscribing && (
        <p role="status" className="text-sm text-zinc-600">Converting your speech into text...</p>
      )}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
