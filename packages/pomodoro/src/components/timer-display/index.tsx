import { formatTime } from '../../utils/time.js';
import type { TimerMode } from '../../types/index.js';

interface TimerDisplayProps {
  timeLeft: number;
  mode: TimerMode;
}

const modeColors: Record<TimerMode, string> = {
  work: 'border-red-500 text-red-500',
  shortBreak: 'border-green-500 text-green-500',
  longBreak: 'border-blue-500 text-blue-500',
};

const modeLabels: Record<TimerMode, string> = {
  work: 'Focus Time',
  shortBreak: 'Short Break',
  longBreak: 'Long Break',
};

export const TimerDisplay = ({ timeLeft, mode }: TimerDisplayProps) => {
  return (
    <view className="relative flex flex-col items-center justify-center my-8">
      <view className="relative w-64 h-64 flex flex-col items-center justify-center">
        {/* Background Circle */}
        <view className="absolute top-2 left-2 w-60 h-60 rounded-full border-[12px] border-gray-100" />

        {/* Active Circle Border */}
        <view
          className={`absolute top-2 left-2 w-60 h-60 rounded-full border-[12px] transition-all duration-700 ease-in-out ${modeColors[mode].split(' ')[0]}`}
        />

        {/* Time Text */}
        <view className="absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-300">
          <text
            className={`text-lg font-bold mb-2 uppercase tracking-widest transition-colors duration-500 ${modeColors[mode].split(' ')[1]}`}
          >
            {modeLabels[mode]}
          </text>
          <text className="text-5xl font-black text-gray-800 tracking-tight leading-none">
            {formatTime(timeLeft)}
          </text>
        </view>
      </view>
    </view>
  );
};
