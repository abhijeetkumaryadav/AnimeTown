"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

export default function PlayerPage() {
  const router = useRouter();

  // Read URL parameters directly from the browser (avoids useSearchParams)
  const getUrlParam = (key: string): string | null => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    return params.get(key);
  };

  const [url, setUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const urlParam = getUrlParam('url');
    if (urlParam) {
      try {
        const decoded = decodeURIComponent(urlParam);
        setUrl(decoded);
        setIsLoading(false);
      } catch (e) {
        setError('Invalid URL parameter');
        setIsLoading(false);
      }
    } else {
      setError('No URL provided');
      setIsLoading(false);
    }
  }, []);

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  const handleIframeError = () => {
    setError('Failed to load the video. The URL might be inaccessible or blocked.');
    setIsLoading(false);
  };

  const handleBack = () => {
    router.back();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-center">
          <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm text-zinc-400">Loading video player...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-white mb-2">Playback Error</h1>
          <p className="text-sm text-zinc-400 mb-4">{error}</p>
          <button
            onClick={handleBack}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black relative">
      {/* Back button */}
      <button
        onClick={handleBack}
        className="absolute top-4 left-4 z-50 bg-black/60 hover:bg-black/80 text-white text-sm font-bold px-4 py-2 rounded-lg backdrop-blur-sm transition-colors"
      >
        ← Back
      </button>

      {/* Full‑screen iframe */}
      <iframe
        ref={iframeRef}
        src={url}
        className="w-full h-screen border-0"
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        onLoad={handleIframeLoad}
        onError={handleIframeError}
        title="Video Player"
      />
    </div>
  );
}