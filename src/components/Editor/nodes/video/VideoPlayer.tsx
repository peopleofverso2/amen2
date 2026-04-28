import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, IconButton } from '@mui/material';
import { Fullscreen, FullscreenExit } from '@mui/icons-material';
import ReactPlayer from 'react-player';
import ButtonOverlay from '../button/ButtonOverlay';

export interface VideoPlayerHandle {
  seekTo: (amount: number, type?: 'seconds' | 'fraction') => void;
  getCurrentTime: () => number;
  getInternalPlayer: () => unknown;
}

interface VideoPlayerProps {
  url: string;
  isPlaybackMode?: boolean;
  showControls?: boolean;
  muted?: boolean;
  mediaIn?: number;
  mediaOut?: number;
  applyMediaBounds?: boolean;
  playing?: boolean;
  playerRef?: (player: VideoPlayerHandle | null) => void;
  onReady?: () => void;
  onSeek?: (seconds: number) => void;
  onProgress?: (state: { playedSeconds: number }) => void;
  progressInterval?: number;
  onDuration?: (duration: number) => void;
  onEnded?: () => void;
  onError?: () => void;
  buttons?: Array<{
    id: string;
    label: string;
    targetNodeId?: string;
    onClick: () => void;
  }>;
  showButtons?: boolean;
}

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  msFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
  msExitFullscreen?: () => Promise<void> | void;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
  msRequestFullscreen?: () => Promise<void> | void;
};

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  url,
  isPlaybackMode,
  showControls,
  muted = false,
  mediaIn,
  mediaOut,
  applyMediaBounds = false,
  playing,
  playerRef,
  onReady,
  onSeek,
  onProgress,
  progressInterval,
  onDuration,
  onEnded,
  onError,
  buttons = [],
  showButtons = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const reactPlayerRef = useRef<ReactPlayer | null>(null);
  const nativeVideoRef = useRef<HTMLVideoElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const updateFullscreenState = useCallback(() => {
    const doc = document as FullscreenDocument;
    const fullscreenElement =
      doc.fullscreenElement || doc.webkitFullscreenElement || doc.msFullscreenElement;
    setIsFullscreen(Boolean(fullscreenElement));
  }, []);

  useEffect(() => {
    document.addEventListener('fullscreenchange', updateFullscreenState);
    document.addEventListener('webkitfullscreenchange', updateFullscreenState as EventListener);
    document.addEventListener('MSFullscreenChange', updateFullscreenState as EventListener);

    return () => {
      document.removeEventListener('fullscreenchange', updateFullscreenState);
      document.removeEventListener('webkitfullscreenchange', updateFullscreenState as EventListener);
      document.removeEventListener('MSFullscreenChange', updateFullscreenState as EventListener);
    };
  }, [updateFullscreenState]);

  const toggleFullscreen = useCallback(async () => {
    const doc = document as FullscreenDocument;
    const element = containerRef.current as FullscreenElement | null;
    if (!element) {
      return;
    }

    const fullscreenElement =
      doc.fullscreenElement || doc.webkitFullscreenElement || doc.msFullscreenElement;

    if (fullscreenElement) {
      if (doc.exitFullscreen) {
        await doc.exitFullscreen();
      } else if (doc.webkitExitFullscreen) {
        await doc.webkitExitFullscreen();
      } else if (doc.msExitFullscreen) {
        await doc.msExitFullscreen();
      }
      return;
    }

    if (element.requestFullscreen) {
      await element.requestFullscreen();
    } else if (element.webkitRequestFullscreen) {
      await element.webkitRequestFullscreen();
    } else if (element.msRequestFullscreen) {
      await element.msRequestFullscreen();
    }
  }, []);

  const effectiveShowControls =
    typeof showControls === 'boolean' ? showControls : !isPlaybackMode;
  const useNativeFilePlayer = useMemo(() => {
    const normalizedUrl = String(url || '').toLowerCase();
    const isUploaded = normalizedUrl.startsWith('/uploads/') || normalizedUrl.includes('/uploads/');
    const looksLikeFile = /\.(mp4|webm|mov|m4v|ogg)(\?.*)?$/.test(normalizedUrl);
    return !isPlaybackMode && (isUploaded || looksLikeFile);
  }, [url, isPlaybackMode]);

  useEffect(() => {
    if (!playerRef) {
      return;
    }

    if (useNativeFilePlayer) {
      const nativeHandle: VideoPlayerHandle = {
        seekTo: (amount, type = 'seconds') => {
          const player = nativeVideoRef.current;
          if (!player || !Number.isFinite(amount)) {
            return;
          }
          const nextTime = type === 'fraction' ? amount * (player.duration || 0) : amount;
          player.currentTime = Math.max(0, nextTime);
        },
        getCurrentTime: () => nativeVideoRef.current?.currentTime || 0,
        getInternalPlayer: () => nativeVideoRef.current,
      };
      playerRef(nativeHandle);
      return () => playerRef(null);
    }

    const reactHandle: VideoPlayerHandle = {
      seekTo: (amount, type = 'seconds') => {
        reactPlayerRef.current?.seekTo(amount, type);
      },
      getCurrentTime: () => reactPlayerRef.current?.getCurrentTime() || 0,
      getInternalPlayer: () => reactPlayerRef.current?.getInternalPlayer(),
    };
    playerRef(reactHandle);
    return () => playerRef(null);
  }, [playerRef, useNativeFilePlayer]);

  useEffect(() => {
    if (!useNativeFilePlayer) {
      return;
    }
    const player = nativeVideoRef.current;
    if (!player) {
      return;
    }
    if (playing) {
      const playAttempt = player.play();
      if (playAttempt && typeof playAttempt.catch === 'function') {
        void playAttempt.catch(() => undefined);
      }
      return;
    }
    player.pause();
  }, [playing, useNativeFilePlayer, url]);

  return (
    <Box ref={containerRef} sx={{ position: 'relative', width: '100%', pb: '56.25%' }}>
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
        }}
      >
        {useNativeFilePlayer ? (
          <video
            ref={nativeVideoRef}
            src={url}
            controls={effectiveShowControls}
            muted={muted}
            playsInline
            preload="metadata"
            controlsList="nodownload"
            onLoadedMetadata={(event) => {
              const duration = event.currentTarget.duration;
              if (Number.isFinite(duration) && duration > 0) {
                onDuration?.(duration);
              }
              onReady?.();
            }}
            onSeeked={(event) => {
              onSeek?.(event.currentTarget.currentTime || 0);
            }}
            onTimeUpdate={(event) => {
              onProgress?.({ playedSeconds: event.currentTarget.currentTime || 0 });
            }}
            onEnded={onEnded}
            onError={onError}
            style={{ width: '100%', height: '100%', display: 'block' }}
          />
        ) : (
          <ReactPlayer
            ref={(player) => {
              reactPlayerRef.current = player;
            }}
            url={url}
            width="100%"
            height="100%"
            controls={effectiveShowControls}
            muted={muted}
            playing={Boolean(playing)}
            onReady={onReady}
            onSeek={onSeek}
            onProgress={onProgress}
            progressInterval={progressInterval}
            onDuration={onDuration}
            onEnded={onEnded}
            onError={onError}
            config={{
              youtube: {
                playerVars: {
                  showinfo: 1,
                  rel: 0,
                  playsinline: 1,
                  ...(applyMediaBounds && mediaIn && mediaIn > 0
                    ? { start: Math.floor(mediaIn) }
                    : {}),
                  ...(applyMediaBounds && mediaOut && mediaOut > 0
                    ? { end: Math.floor(mediaOut) }
                    : {}),
                },
              },
              file: {
                attributes: {
                  controlsList: 'nodownload',
                  playsInline: true,
                  preload: 'metadata',
                },
              },
            }}
          />
        )}

        {isPlaybackMode && (
          <IconButton
            size="small"
            onClick={(event) => {
              event.stopPropagation();
              void toggleFullscreen();
            }}
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              color: 'white',
              bgcolor: 'rgba(0,0,0,0.5)',
              zIndex: 3,
              '&:hover': {
                bgcolor: 'rgba(0,0,0,0.7)',
              },
            }}
            title={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
          >
            {isFullscreen ? <FullscreenExit fontSize="small" /> : <Fullscreen fontSize="small" />}
          </IconButton>
        )}

        <ButtonOverlay buttons={buttons} visible={showButtons} />
      </Box>
    </Box>
  );
};

export default VideoPlayer;
