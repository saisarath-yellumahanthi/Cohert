import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';
import { formatAudioDuration, getNextPlaybackSpeed } from '../utils/validation';

interface AudioMessagePlayerProps {
  audioUrl: string;
  duration?: number;
  isMine?: boolean;
}

const WAVEFORM_BARS = [35, 65, 45, 80, 55, 90, 40, 75, 60, 85, 50, 70, 95, 45, 65, 80, 50, 60, 75, 40, 55, 70, 45, 35];

export const AudioMessagePlayer: React.FC<AudioMessagePlayerProps> = ({
  audioUrl,
  duration = 0,
  isMine = false,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState<number>(duration > 0 ? duration : 0);
  const [playbackRate, setPlaybackRate] = useState<1 | 1.5 | 2>(1);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (duration > 0 && (!totalDuration || !Number.isFinite(totalDuration))) {
      setTotalDuration(duration);
    }
  }, [duration, totalDuration]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio || hasError) return;

    try {
      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
      } else {
        audio.playbackRate = playbackRate;
        await audio.play();
        setIsPlaying(true);
      }
    } catch {
      setIsPlaying(false);
    }
  };

  const handleSpeedToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextSpeed = getNextPlaybackSpeed(playbackRate);
    setPlaybackRate(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    const effectiveDuration = totalDuration || duration || 1;
    if (!audio || effectiveDuration <= 0) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const ratio = rect.width > 0 ? clickX / rect.width : 0;
    const nextTime = ratio * effectiveDuration;
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const effectiveDuration = totalDuration > 0 ? totalDuration : duration;
  const progressRatio =
    effectiveDuration > 0 ? Math.min(1, Math.max(0, currentTime / effectiveDuration)) : 0;

  return (
    <div
      className={`flex items-center gap-2.5 min-w-[210px] sm:min-w-[240px] max-w-[280px] py-1 select-none ${
        isMine ? 'text-white' : 'text-[#262626] dark:text-[#F5F5F5]'
      }`}
    >
      <audio
        ref={audioRef}
        src={audioUrl}
        preload="metadata"
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) {
            setTotalDuration(d);
          }
        }}
        onTimeUpdate={(e) => {
          setCurrentTime(e.currentTarget.currentTime);
        }}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onError={() => {
          setHasError(true);
          setIsPlaying(false);
        }}
      />

      <button
        type="button"
        onClick={togglePlay}
        disabled={hasError}
        aria-label={isPlaying ? 'Pause voice message' : 'Play voice message'}
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 ${
          isMine
            ? 'bg-white text-[#E1306C] shadow-xs'
            : 'bg-cohert-gradient text-white shadow-xs'
        } disabled:opacity-50`}
      >
        {isPlaying ? (
          <Pause className="w-3.5 h-3.5 fill-current" />
        ) : (
          <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
        )}
      </button>

      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div
          onClick={handleSeek}
          role="slider"
          aria-label="Audio progress"
          aria-valuemin={0}
          aria-valuemax={Math.round(effectiveDuration)}
          aria-valuenow={Math.round(currentTime)}
          tabIndex={0}
          className="h-6 flex items-center gap-[2px] cursor-pointer"
        >
          {WAVEFORM_BARS.map((heightPct, idx) => {
            const barRatio = (idx + 1) / WAVEFORM_BARS.length;
            const isActive = barRatio <= progressRatio;
            return (
              <div
                key={idx}
                className={`flex-1 rounded-full transition-colors ${
                  isMine
                    ? isActive
                      ? 'bg-white'
                      : 'bg-white/40'
                    : isActive
                    ? 'bg-[#E1306C]'
                    : 'bg-[#8E8E8E]/40 dark:bg-[#A8A8A8]/40'
                }`}
                style={{ height: `${Math.max(20, Math.round(heightPct * 0.22))}px` }}
              />
            );
          })}
        </div>

        <div className="flex items-center justify-between text-[10px] leading-none">
          <span
            className={`font-medium tabular-nums ${
              isMine ? 'text-white/90' : 'text-[#8E8E8E] dark:text-[#A8A8A8]'
            }`}
          >
            {hasError
              ? 'Audio unavailable'
              : isPlaying || currentTime > 0
              ? `${formatAudioDuration(currentTime)} / ${formatAudioDuration(effectiveDuration)}`
              : formatAudioDuration(effectiveDuration)}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={handleSpeedToggle}
        title="Change playback speed"
        className={`px-2 py-1 rounded-full text-[10px] font-bold tracking-tight shrink-0 transition-opacity hover:opacity-90 ${
          isMine
            ? 'bg-white/20 text-white border border-white/25'
            : 'bg-white dark:bg-[#1E1E1E] text-[#262626] dark:text-[#F5F5F5] border border-[#DBDBDB] dark:border-[#363636]'
        }`}
      >
        {playbackRate}x
      </button>
    </div>
  );
};
