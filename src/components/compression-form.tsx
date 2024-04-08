import { Rabbit, Turtle, Bird, Dog } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectValue,
  SelectTrigger,
} from './ui/select';
import { invoke } from '@tauri-apps/api/core';
import { listen, once } from '@tauri-apps/api/event';

type VideoStats = {
  bit_rate: number;
  height: number;
  nb_packets: number;
  width: number;
};

export function CompressionOptions({ source }: { source: string | null }) {
  const initialWidth = 1920;
  const initialHeight = 1080;
  const [resolution, setResolution] = useState({
    width: initialWidth,
    height: initialHeight,
  });
  const [aspectRatioLinked, setAspectRatioLinked] = useState(true);
  const [cropVideo, setCropVideo] = useState(false);
  const [preset, setPreset] = useState('medium');
  const aspectRatio = useMemo(
    () => resolution.width / resolution.height,
    [resolution]
  );

  useEffect(() => {
    async function fetchVideoInfo() {
      if (!source) return;

      const res = await invoke<VideoStats[]>('get_video_stats', {
        url: source,
      });

      const videoInfo = res[0];
      setResolution({
        width: videoInfo.width,
        height: videoInfo.height,
      });
    }

    fetchVideoInfo();
  }, [source]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // Call to backend with parameters
    console.log('Processing video with parameters:', {
      resolution,
      preset,
      cropVideo,
    });

    const statsListener = await listen<{
      frame: number;
      fps: number;
      time: number;
    }>('video-processing-stats', (event) => {
      console.log('Progress:', event);
    });

    console.log('Listening for progress updates...');

    // Replace the following line with the actual Tauri invoke command
    await invoke('simple_video_processing', {
      url: source,
      resolution,
      preset,
      cropVideo,
    });

    let completed = false;
    while (!completed) {
      await once('video-processing-completed', () => {
        completed = true;
        console.log('Processing completed!');
        statsListener();
      });
    }
  };

  const handleWidthChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newWidth = event.target.valueAsNumber;
    setResolution((prev) => ({
      width: newWidth,
      height: aspectRatioLinked
        ? Math.round(newWidth / aspectRatio)
        : prev.height,
    }));
  };

  const handleHeightChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newHeight = event.target.valueAsNumber;
    setResolution((prev) => ({
      width: aspectRatioLinked
        ? Math.round(newHeight * aspectRatio)
        : prev.width,
      height: newHeight,
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 w-full h-full flex flex-col">
      <div className="mb-4">
        <label
          htmlFor="preset"
          className="block text-sm font-medium text-gray-700"
        >
          Preset
        </label>
        <Select>
          <SelectTrigger>
            <SelectValue>{preset}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              onSelect={() => setPreset('ultrafast')}
              value="ultrafast"
              className="cursor-pointer"
            >
              <span className="inline-flex gap-2 items-center">
                <Rabbit className="h-5 w-5" />
                UltraFast
              </span>
            </SelectItem>
            <SelectItem
              onSelect={() => setPreset('fast')}
              value="fast"
              className="cursor-pointer"
            >
              <span className="inline-flex gap-2 items-center">
                <Bird className="h-5 w-5" />
                Fast
              </span>
            </SelectItem>
            <SelectItem
              onSelect={() => setPreset('medium')}
              value="medium"
              className="cursor-pointer"
            >
              <span className="inline-flex gap-2 items-center">
                <Dog className="h-5 w-5" />
                Medium
              </span>
            </SelectItem>
            <SelectItem
              onSelect={() => setPreset('slow')}
              value="slow"
              className="cursor-pointer"
            >
              <span className="inline-flex gap-2 items-center">
                <Turtle className="h-5 w-5" />
                Slow
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mb-4 flex items-center">
        <label
          htmlFor="aspectRatioLink"
          className="block text-sm font-medium text-gray-700 mr-2"
        >
          Maintain Aspect Ratio
        </label>
        <input
          type="checkbox"
          id="aspectRatioLink"
          checked={aspectRatioLinked}
          onChange={(e) => setAspectRatioLinked(e.target.checked)}
          className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded"
        />
      </div>

      <div className="mb-4 flex items-center">
        <label
          htmlFor="cropVideo"
          className="block text-sm font-medium text-gray-700 mr-2"
        >
          Crop Video
        </label>
        <input
          type="checkbox"
          id="cropVideo"
          checked={cropVideo}
          onChange={(e) => setCropVideo(e.target.checked)}
          className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded"
          disabled={!aspectRatioLinked}
        />
      </div>

      <div className="mb-4">
        <label
          htmlFor="resolution"
          className="block text-sm font-medium text-gray-700"
        >
          Resolution
        </label>
        <div className="mt-1 flex gap-2 items-center">
          <input
            type="number"
            id="width"
            value={resolution.width}
            onChange={handleWidthChange}
            className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md text-black"
          />
          <span className="h-full w-8 flex items-center justify-center text-gray-700">
            x
          </span>
          <input
            type="number"
            id="height"
            value={resolution.height}
            onChange={handleHeightChange}
            className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md text-black"
          />
        </div>
      </div>

      <button
        type="submit"
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
      >
        Apply
      </button>
    </form>
  );
}
