"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Hls from "hls.js";

type ErrorInfo = {
  message: string;
  detail?: string;
  fatal: boolean;
};

const MAX_MANIFEST_RETRIES = 4;
const MAX_MEDIA_ERROR_RECOVERIES = 3;
const MAX_NETWORK_RETRIES = 4;

export default function PlayerPage() {
  const searchParams = useSearchParams();
  const rawUrl = searchParams.get("url");

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const manifestRetryCount = useRef(0);
  const mediaErrorRecoveryCount = useRef(0);
  const networkRetryCount = useRef(0);
  const retryTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stallCheckInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPlaybackTime = useRef(0);

  const [error, setError] = useState<ErrorInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusText, setStatusText] = useState("Connecting…");
  const [retryKey, setRetryKey] = useState(0);

  const clearTimers = useCallback(() => {
    if (retryTimeout.current) {
      clearTimeout(retryTimeout.current);
      retryTimeout.current = null;
    }
    if (stallCheckInterval.current) {
      clearInterval(stallCheckInterval.current);
      stallCheckInterval.current = null;
    }
  }, []);

  const backoffDelay = (attempt: number) => Math.min(500 * 2 ** attempt, 8000);

  // Helper to route any external URL through our CORS-bypass proxy
  const getProxiedUrl = (originalUrl: string) => {
    return `/api/proxy?url=${encodeURIComponent(originalUrl)}`;
  };

  useEffect(() => {
    if (!rawUrl) {
      setError({ message: "No video URL provided", fatal: true });
      setLoading(false);
      return;
    }

    let url: string;
    try {
      url = new URL(rawUrl).href;
    } catch {
      setError({ message: "Invalid video URL", fatal: true });
      setLoading(false);
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    manifestRetryCount.current = 0;
    mediaErrorRecoveryCount.current = 0;
    networkRetryCount.current = 0;
    lastPlaybackTime.current = 0;
    clearTimers();
    setError(null);
    setLoading(true);
    setStatusText("Connecting…");

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    video.removeAttribute("src");
    video.load();

    const isHls = url.includes(".m3u8");

    const giveUp = (message: string, detail?: string) => {
      clearTimers();
      setError({ message, detail, fatal: true });
      setLoading(false);
    };

    // ---------- Path 1: HLS via hls.js ----------
    if (isHls && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        manifestLoadingMaxRetry: MAX_MANIFEST_RETRIES,
        manifestLoadingRetryDelay: 500,
        manifestLoadingMaxRetryTimeout: 8000,
        levelLoadingMaxRetry: MAX_MANIFEST_RETRIES,
        levelLoadingRetryDelay: 500,
        fragLoadingMaxRetry: 6,
        fragLoadingRetryDelay: 500,
        fragLoadingMaxRetryTimeout: 8000,
        xhrSetup: (xhr) => {
          xhr.setRequestHeader("Accept", "*/*");
        },
      });
      hlsRef.current = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setLoading(false);
        setStatusText("");
        video.play().catch(() => {});
      });

      hls.on(Hls.Events.FRAG_BUFFERED, () => {
        if (error) setError(null);
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        console.warn("HLS event:", data.type, data.details, "fatal:", data.fatal);

        if (!data.fatal) {
          if (
            data.details === Hls.ErrorDetails.FRAG_LOAD_ERROR ||
            data.details === Hls.ErrorDetails.FRAG_PARSING_ERROR
          ) {
            setStatusText("Recovering a dropped segment…");
          }
          return;
        }

        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR: {
            if (networkRetryCount.current >= MAX_NETWORK_RETRIES) {
              giveUp(
                "Network error",
                "The stream could not be reached after several attempts. It may be offline or blocked."
              );
              return;
            }
            networkRetryCount.current += 1;
            const delay = backoffDelay(networkRetryCount.current);
            setStatusText(
              `Connection issue — retrying (${networkRetryCount.current}/${MAX_NETWORK_RETRIES})…`
            );

            retryTimeout.current = setTimeout(() => {
              if (
                data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR ||
                data.details === Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT ||
                data.details === Hls.ErrorDetails.LEVEL_LOAD_ERROR ||
                data.details === Hls.ErrorDetails.LEVEL_LOAD_TIMEOUT
              ) {
                manifestRetryCount.current += 1;
                if (manifestRetryCount.current > MAX_MANIFEST_RETRIES) {
                  giveUp(
                    "Could not load stream manifest",
                    "The playlist file did not load after multiple attempts."
                  );
                  return;
                }
                const bustUrl =
                  url + (url.includes("?") ? "&" : "?") + "_r=" + Date.now();
                // <--- CHANGED: Load the retry URL through the proxy
                hls.loadSource(getProxiedUrl(bustUrl));
              } else {
                hls.startLoad();
              }
            }, delay);
            break;
          }

          case Hls.ErrorTypes.MEDIA_ERROR: {
            if (mediaErrorRecoveryCount.current >= MAX_MEDIA_ERROR_RECOVERIES) {
              giveUp(
                "Media error",
                "The stream data appears corrupted or uses an unsupported format, and automatic recovery failed."
              );
              return;
            }
            mediaErrorRecoveryCount.current += 1;
            setStatusText("Recovering playback…");

            if (data.details === Hls.ErrorDetails.FRAG_PARSING_ERROR) {
              try {
                hls.swapAudioCodec();
              } catch {
                /* ignore */
              }
            }
            hls.recoverMediaError();
            break;
          }

          default:
            giveUp(
              "Playback error",
              data.details || "An unrecoverable player error occurred."
            );
            hls.destroy();
            break;
        }
      });

      // <--- CHANGED: Load the original URL through the proxy
      hls.loadSource(getProxiedUrl(url));
      hls.attachMedia(video);
    } else {
      // ---------- Path 2: Native playback ----------
      // <--- CHANGED: Set the video src to the proxied URL
      video.src = getProxiedUrl(url);
      video.load();
      video.play().catch(() => {});

      const nativeErrorHandler = () => {
        const videoError = video.error;
        if (!videoError) return;

        if (
          networkRetryCount.current < MAX_NETWORK_RETRIES &&
          (videoError.code === MediaError.MEDIA_ERR_NETWORK ||
            videoError.code === MediaError.MEDIA_ERR_DECODE)
        ) {
          networkRetryCount.current += 1;
          const delay = backoffDelay(networkRetryCount.current);
          setStatusText(
            `Connection issue — retrying (${networkRetryCount.current}/${MAX_NETWORK_RETRIES})…`
          );
          retryTimeout.current = setTimeout(() => {
            const bustUrl =
              url + (url.includes("?") ? "&" : "?") + "_r=" + Date.now();
            // <--- CHANGED: Retry using the proxied URL
            video.src = getProxiedUrl(bustUrl);
            video.load();
            video.play().catch(() => {});
          }, delay);
          return;
        }

        let message = "Video error";
        let detail = videoError.message;
        switch (videoError.code) {
          case MediaError.MEDIA_ERR_ABORTED:
            message = "Playback aborted";
            break;
          case MediaError.MEDIA_ERR_NETWORK:
            message = "Network error";
            detail = "The stream may be blocked, offline, or unreachable.";
            break;
          case MediaError.MEDIA_ERR_DECODE:
            message = "Decode error";
            detail = "The stream may be corrupted or use an unsupported codec.";
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            message = "Format not supported";
            detail = "This browser cannot play this stream directly.";
            break;
        }
        giveUp(message, detail);
      };

      video.addEventListener("error", nativeErrorHandler);
      video.addEventListener("loadeddata", () => {
        setLoading(false);
        setStatusText("");
      });

      return () => {
        clearTimers();
        video.removeEventListener("error", nativeErrorHandler);
      };
    }

    stallCheckInterval.current = setInterval(() => {
      if (video.paused || video.ended) return;
      if (video.currentTime === lastPlaybackTime.current) {
        setStatusText("Buffering seems stuck — nudging playback…");
        const hls = hlsRef.current;
        if (hls) {
          hls.startLoad();
        } else {
          video.currentTime = video.currentTime;
        }
      } else {
        lastPlaybackTime.current = video.currentTime;
      }
    }, 12000);

    return () => {
      clearTimers();
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawUrl, retryKey]);

  const handleRetry = () => {
    setRetryKey((k) => k + 1);
  };

  return (
    <div className="min-h-screen bg-[#040406] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <h1 className="text-white text-2xl font-bold mb-4">Direct Player</h1>

        {error ? (
          <div className="bg-red-900/50 border border-red-500 text-red-200 p-4 rounded-lg mb-4">
            <p className="font-semibold">{error.message}</p>
            {error.detail && (
              <p className="text-sm text-red-300 mt-1">{error.detail}</p>
            )}
            <button
              onClick={handleRetry}
              className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
            {loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-3">
                <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                {statusText && (
                  <p className="text-zinc-300 text-sm">{statusText}</p>
                )}
              </div>
            )}
            {!loading && statusText && (
              <div className="absolute top-2 left-2 bg-black/70 text-zinc-200 text-xs px-3 py-1.5 rounded-full">
                {statusText}
              </div>
            )}
            <video
              ref={videoRef}
              controls
              crossOrigin="anonymous"
              className="w-full h-full object-contain"
              playsInline
            />
          </div>
        )}

        <div className="mt-4 text-zinc-400 text-sm">
          <p className="truncate">
            URL:{" "}
            {rawUrl
              ? rawUrl.slice(0, 80) + (rawUrl.length > 80 ? "…" : "")
              : "No URL"}
          </p>
          <a href="/" className="text-red-400 hover:underline mt-2 inline-block">
            ← Back to Home
          </a>
        </div>
      </div>
    </div>
  );
}