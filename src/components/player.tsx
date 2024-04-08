import { useRef, useState } from 'react';
import ReactPlayer from 'react-player';

export interface PlayerProps {
  source: string;
}

export function Player({ source }: PlayerProps) {
  const playerRef = useRef<ReactPlayer>(null);
  const [playing, setPlaying] = useState(false);
  const [volume] = useState(0.8);
  const [muted] = useState(true);
  const [, setDuration] = useState(0);

  return (
    <div
      className="relative rounded-lg"
      style={{ width: '85%', margin: '0 auto' }}
    >
      <ReactPlayer
        url={source}
        playing={playing}
        volume={volume}
        muted={muted}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onDuration={(state) => setDuration(state)}
        ref={playerRef}
        width="100%"
        height="auto"
        style={{
          zIndex: 20,
          position: 'relative',
          borderRadius: '0.5rem',
        }}
        config={{
          file: {
            attributes: {
              crossOrigin: 'anonymous',
            },
          },
        }}
        controls
      />
    </div>
  );
}
