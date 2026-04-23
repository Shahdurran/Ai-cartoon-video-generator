'use client';

/**
 * VoicePreviewCard -- selectable card that plays the ElevenLabs `preview_url`
 * sample when the user clicks play. One shared AudioContext ensures that only
 * a single preview plays at a time across the whole page.
 */

import { useEffect, useRef, useState } from 'react';
import type { Voice } from '@/lib/api';

type Props = {
  voice: Voice;
  selected: boolean;
  onSelect: () => void;
};

// Shared so that starting one preview stops whichever one is currently playing.
let currentlyPlaying: HTMLAudioElement | null = null;
const playingSubscribers = new Set<(a: HTMLAudioElement | null) => void>();

function setCurrentlyPlaying(audio: HTMLAudioElement | null) {
  currentlyPlaying = audio;
  playingSubscribers.forEach((cb) => cb(audio));
}

export function VoicePreviewCard({ voice, selected, onSelect }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onSomeoneElsePlays = (a: HTMLAudioElement | null) => {
      if (a !== audioRef.current && playing) {
        audioRef.current?.pause();
        setPlaying(false);
      }
    };
    playingSubscribers.add(onSomeoneElsePlays);
    return () => {
      playingSubscribers.delete(onSomeoneElsePlays);
    };
  }, [playing]);

  useEffect(() => {
    return () => {
      const el = audioRef.current;
      if (el) {
        el.pause();
        if (currentlyPlaying === el) setCurrentlyPlaying(null);
      }
    };
  }, []);

  async function togglePlay(e: React.MouseEvent) {
    e.stopPropagation();
    if (!voice.previewUrl) {
      setError('No preview available');
      return;
    }

    if (!audioRef.current) {
      const a = new Audio(voice.previewUrl);
      a.preload = 'metadata';
      a.addEventListener('timeupdate', () => {
        if (a.duration) setProgress((a.currentTime / a.duration) * 100);
      });
      a.addEventListener('ended', () => {
        setPlaying(false);
        setProgress(0);
        if (currentlyPlaying === a) setCurrentlyPlaying(null);
      });
      a.addEventListener('error', () => {
        setError('Could not load preview');
        setLoading(false);
        setPlaying(false);
      });
      audioRef.current = a;
    }

    const audio = audioRef.current;

    if (playing) {
      audio.pause();
      setPlaying(false);
      if (currentlyPlaying === audio) setCurrentlyPlaying(null);
      return;
    }

    if (currentlyPlaying && currentlyPlaying !== audio) {
      currentlyPlaying.pause();
    }

    try {
      setLoading(true);
      setError(null);
      await audio.play();
      setCurrentlyPlaying(audio);
      setPlaying(true);
    } catch (err: any) {
      setError(err?.message || 'Playback failed');
    } finally {
      setLoading(false);
    }
  }

  const labelBits = [voice.category, ...Object.values(voice.labels || {})]
    .filter(Boolean)
    .slice(0, 3);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative text-left rounded-2xl p-4 transition-all duration-200 border overflow-hidden ${
        selected
          ? 'border-brand-400/60 bg-white/[0.08]'
          : 'border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.06]'
      }`}
    >
      {selected && (
        <span className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-brand-400/40 animate-fade-in" />
      )}

      <div className="flex items-center gap-3">
        <div
          onClick={togglePlay}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              togglePlay(e as unknown as React.MouseEvent);
            }
          }}
          className={`shrink-0 flex items-center justify-center h-10 w-10 rounded-full text-white shadow-lg cursor-pointer transition-transform ${
            playing ? 'animate-glow' : 'hover:scale-105'
          }`}
          style={{
            backgroundImage:
              'linear-gradient(135deg, #FFA846 0%, #FF4689 100%)',
          }}
          aria-label={playing ? 'Pause preview' : 'Play preview'}
        >
          {loading ? (
            <span className="h-3 w-3 border-2 border-white/80 border-t-transparent rounded-full animate-spin" />
          ) : playing ? (
            <PauseIcon />
          ) : (
            <PlayIcon />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium text-white truncate">
              {voice.name}
            </div>
            {selected && (
              <span className="pill bg-brand-400/20 text-brand-100 border border-brand-400/30">
                selected
              </span>
            )}
          </div>
          {labelBits.length > 0 && (
            <div className="text-[11px] text-ink-200/70 truncate mt-0.5">
              {labelBits.join(' · ')}
            </div>
          )}
        </div>

        {playing && <WaveBars />}
      </div>

      {/* progress bar */}
      <div className="mt-3 h-1 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full transition-[width] duration-100"
          style={{
            width: `${progress}%`,
            backgroundImage:
              'linear-gradient(90deg, #FFA846 0%, #FF4689 100%)',
          }}
        />
      </div>

      {error && (
        <div className="mt-2 text-[11px] text-rose-300">{error}</div>
      )}
    </button>
  );
}

function PlayIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <path d="M7 5.5v13a1 1 0 0 0 1.53.85l11-6.5a1 1 0 0 0 0-1.7l-11-6.5A1 1 0 0 0 7 5.5z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
    </svg>
  );
}

function WaveBars() {
  return (
    <div className="flex items-end gap-[3px] h-6" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className="w-[3px] rounded-sm animate-wave"
          style={{
            background: 'linear-gradient(180deg, #FFA846, #FF4689)',
            height: '100%',
            animationDelay: `${i * 120}ms`,
            transformOrigin: 'bottom',
          }}
        />
      ))}
    </div>
  );
}
