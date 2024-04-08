import { useState } from 'react';
import { Player } from '../components/player';
import { open } from '@tauri-apps/plugin-dialog';
import { CompressionOptions } from '../components/compression-form';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';

export function Home() {
  const [source, setSource] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSelectFile = async () => {
    setLoading(true);
    const selected = await open({
      multiple: false,
      filters: [
        {
          name: 'Videos',
          extensions: ['mp4', 'webm', 'ogg', 'mov', 'avi', 'flv', 'mkv'],
        },
      ],
    });

    console.log(selected);

    if (selected === null) {
      return;
    }

    setSource(convertFileSrc(selected.path));
  };

  return (
    <div className="flex flex-col items-center justify-center h-full relative">
      <section
        id="editor-layout"
        className="flex flex-row w-full h-full p-2 z-10"
      >
        <div
          id="editor"
          className="w-3/4 h-full flex flex-col items-center justify-center relative"
        >
          <button
            type="button"
            className="absolute top-4 left-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded cursor-pointer"
            onClick={async () => {
              const version = await invoke('ffmpeg_version');
              alert(`ffmpeg version: ${version}`);
            }}
          >
            ffmpeg version
          </button>
          {!source && (
            <button
              type="button"
              className="mt-4 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
              onClick={handleSelectFile}
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Select Video'}
            </button>
          )}
          {source && <Player source={source} />}
        </div>
        <div
          id="options"
          className="w-1/4 h-full flex items-start justify-start flex-col p-2 z-10 text-white"
        >
          <h1 className="text-white text-2xl">Options</h1>
          {/* Compression and crop/resize options */}
          <CompressionOptions source={source} />
        </div>
      </section>
    </div>
  );
}
