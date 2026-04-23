'use client';

/**
 * Small circular play/pause button for previewing short audio clips
 * (music tracks, voice samples, etc). Shares a single "currently playing"
 * reference so only one clip plays at a time.
 */

import { useEffect, useRef, useState } from 'react';

let currentlyPlaying: HTMLAudioElement | null = null;

export function AudioPreviewButton({
  src,
  size = 'md',
  className = '',
}: {
  src: string | null;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    return () => {
      const el = audioRef.current;
      if (el) {
        el.pause();
        if (currentlyPlaying === el) currentlyPlaying = null;
      }
    };
  }, []);

  if (!src) return null;

  const dimensions =
    size === 'sm' ? 'h-7 w-7' : 'h-9 w-9';
  const iconSize = size === 'sm' ? 10 : 12;

  async function toggle(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();

    if (!audioRef.current) {
      const a = new Audio(src!);
      a.preload = 'metadata';
      a.addEventListener('ended', () => {
        setPlaying(false);
        if (currentlyPlaying === a) currentlyPlaying = null;
      });
      a.addEventListener('error', () => {
        setLoading(false);
        setPlaying(false);
      });
      audioRef.current = a;
    }

    const audio = audioRef.current;

    if (playing) {
      audio.pause();
      setPlaying(false);
      if (currentlyPlaying === audio) currentlyPlaying = null;
      return;
    }

    if (currentlyPlaying && currentlyPlaying !== audio) {
      currentlyPlaying.pause();
    }

    try {
      setLoading(true);
      await audio.play();
      currentlyPlaying = audio;
      setPlaying(true);
    } catch (_) {
      /* autoplay blocked etc */
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={playing ? 'Pause preview' : 'Play preview'}
      className={`inline-flex items-center justify-center rounded-full text-white shadow-md transition-transform ${dimensions} ${
        playing ? 'animate-glow' : 'hover:scale-105'
      } ${className}`}
      style={{
        backgroundImage: 'linear-gradient(135deg, #FFA846 0%, #FF4689 100%)',
      }}
    >
      {loading ? (
        <span
          className="border-2 border-white/80 border-t-transparent rounded-full animate-spin"
          style={{ width: iconSize, height: iconSize }}
        />
      ) : playing ? (
        <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
        </svg>
      ) : (
        <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="currentColor">
          <path d="M7 5.5v13a1 1 0 0 0 1.53.85l11-6.5a1 1 0 0 0 0-1.7l-11-6.5A1 1 0 0 0 7 5.5z" />
        </svg>
      )}
    </button>
  );
}
