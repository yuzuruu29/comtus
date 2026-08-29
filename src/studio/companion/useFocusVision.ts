import { useCallback, useEffect, useRef, useState } from "react";
import { playSfx } from "./sfx";

export type FocusVisionStatus = "idle" | "focused" | "warning" | "alarm";

const WARNING_THRESHOLD_SEC = 15;
const ALARM_THRESHOLD_SEC = 30;
const SAMPLE_INTERVAL_MS = 500; // 2 FPS check to keep CPU usage negligible
const MOTION_DIFF_THRESHOLD = 18; // Pixel intensity change threshold

export function useFocusVision(sfxEnabled: boolean = true) {
  const [isActive, setIsActive] = useState<boolean>(false);
  const [status, setStatus] = useState<FocusVisionStatus>("idle");
  const [awaySeconds, setAwaySeconds] = useState<number>(0);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const prevFrameDataRef = useRef<Uint8ClampedArray | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<number | null>(null);
  const alarmIntervalRef = useRef<number | null>(null);
  const statusRef = useRef<FocusVisionStatus>("idle");
  statusRef.current = status;
  const awaySecondsRef = useRef<number>(0);
  awaySecondsRef.current = awaySeconds;

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (alarmIntervalRef.current) {
      clearInterval(alarmIntervalRef.current);
      alarmIntervalRef.current = null;
    }
    prevFrameDataRef.current = null;
    setStatus("idle");
    setAwaySeconds(0);
  }, []);

  const startStream = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setErrorMessage("Webcam API not supported in this browser");
      setHasPermission(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 160 },
          height: { ideal: 120 },
          facingMode: "user",
        },
        audio: false,
      });

      streamRef.current = stream;
      setHasPermission(true);
      setErrorMessage(null);
      setStatus("focused");
      setAwaySeconds(0);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    } catch (err) {
      console.warn("Focus vision camera permission denied or unavailable:", err);
      setHasPermission(false);
      setErrorMessage("Camera access was not granted");
      setIsActive(false);
    }
  }, []);

  // Toggle Focus Cam
  const toggleFocusCam = useCallback(() => {
    setIsActive((prev) => {
      const next = !prev;
      if (!next) {
        stopStream();
      }
      return next;
    });
  }, [stopStream]);

  useEffect(() => {
    if (isActive) {
      void startStream();
    } else {
      stopStream();
    }
    return () => {
      stopStream();
    };
  }, [isActive, startStream, stopStream]);

  // Frame processing loop — keyed on `isActive` only; the loop body waits for
  // the video element to actually receive frames, because getUserMedia resolves
  // asynchronously and streamRef is still null when this effect first runs.
  useEffect(() => {
    if (!isActive) return;

    const checkFrame = () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || !streamRef.current) return;

      let canvas = canvasRef.current;
      if (!canvas) {
        canvas = document.createElement("canvas");
        canvas.width = 64;
        canvas.height = 48;
        canvasRef.current = canvas;
      }

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, 64, 48);
      const frame = ctx.getImageData(0, 0, 64, 48);
      const data = frame.data;
      const prevData = prevFrameDataRef.current;

      let motionDetected = false;

      if (prevData && prevData.length === data.length) {
        let changedPixels = 0;
        const totalPixels = data.length / 4;

        // Sample every 4th pixel for speed
        for (let i = 0; i < data.length; i += 16) {
          const rDiff = Math.abs(data[i] - prevData[i]);
          const gDiff = Math.abs(data[i + 1] - prevData[i + 1]);
          const bDiff = Math.abs(data[i + 2] - prevData[i + 2]);
          const avgDiff = (rDiff + gDiff + bDiff) / 3;

          if (avgDiff > MOTION_DIFF_THRESHOLD) {
            changedPixels++;
          }
        }

        // If at least ~1.5% of sampled pixels shifted, motion/presence is confirmed
        if (changedPixels > totalPixels * 0.004) {
          motionDetected = true;
        }
      } else {
        // Initial baseline frame
        motionDetected = true;
      }

      prevFrameDataRef.current = new Uint8ClampedArray(data);

      // Classify first (pure), then apply state + side effects outside updaters —
      // StrictMode double-invokes updater functions, which would double-fire sfx.
      let alarmStart = false;
      setAwaySeconds((prevAway) => {
        if (motionDetected) return 0;
        const nextAway = prevAway + SAMPLE_INTERVAL_MS / 1000;
        if (nextAway >= ALARM_THRESHOLD_SEC && statusRef.current !== "alarm") {
          alarmStart = true;
        }
        return nextAway;
      });

      if (motionDetected) {
        if (statusRef.current === "alarm" || statusRef.current === "warning") {
          playSfx("focusResume", sfxEnabled);
        }
        setStatus("focused");
      } else if (alarmStart) {
        setStatus("alarm");
      } else {
        const elapsed = awaySecondsRef.current + SAMPLE_INTERVAL_MS / 1000;
        if (elapsed >= ALARM_THRESHOLD_SEC) {
          setStatus("alarm");
        } else if (elapsed >= WARNING_THRESHOLD_SEC && statusRef.current === "focused") {
          setStatus("warning");
        }
      }
    };

    intervalRef.current = window.setInterval(checkFrame, SAMPLE_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isActive, sfxEnabled]);

  // Alarm audio loop when in alarm state — an audible nudge, never a shake.
  useEffect(() => {
    if (status === "alarm") {
      playSfx("alarm", sfxEnabled);

      alarmIntervalRef.current = window.setInterval(() => {
        playSfx("alarm", sfxEnabled);
      }, 2400);
    } else {
      if (alarmIntervalRef.current) {
        clearInterval(alarmIntervalRef.current);
        alarmIntervalRef.current = null;
      }
    }
    return () => {
      if (alarmIntervalRef.current) {
        clearInterval(alarmIntervalRef.current);
        alarmIntervalRef.current = null;
      }
    };
  }, [status, sfxEnabled]);

  return {
    isActive,
    status,
    awaySeconds,
    hasPermission,
    errorMessage,
    videoRef,
    toggleFocusCam,
  };
}
