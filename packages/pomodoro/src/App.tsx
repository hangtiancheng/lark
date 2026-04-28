import { usePomodoro } from './hooks/use-pomodoro.js';
import { TimerDisplay } from './components/timer-display/index.js';
import { Controls } from './components/controls/index.js';
import { CycleIndicator } from './components/cycle-indicator/index.js';
import { Settings } from './components/settings/index.js';
import type { TimerMode } from './types/index.js';
import './App.css';

const topGlowClasses: Record<TimerMode, string> = {
  work: 'bg-red-400 scale-100',
  shortBreak: 'bg-green-400 scale-110',
  longBreak: 'bg-blue-400 scale-125',
};

const bottomGlowClasses: Record<TimerMode, string> = {
  work: 'bg-orange-400 scale-100',
  shortBreak: 'bg-teal-400 scale-110',
  longBreak: 'bg-indigo-400 scale-125',
};

export function App() {
  const {
    mode,
    timeLeft,
    isActive,
    cyclesCompleted,
    config,
    notification,
    toggleTimer,
    resetTimer,
    updateConfig,
  } = usePomodoro();

  return (
    <view className="h-full w-full bg-gray-50 flex flex-col items-center justify-center p-4">
      <view className="w-full max-w-[420px] bg-white rounded-[32px] p-8 relative shadow-sm shadow-gray-200/50">
        {/* Decorative Background Glows */}
        <view
          className={`absolute -top-20 -right-20 w-56 h-56 rounded-full opacity-[0.15] transition-all duration-1000 ease-in-out ${topGlowClasses[mode]}`}
        />
        <view
          className={`absolute -bottom-20 -left-20 w-56 h-56 rounded-full opacity-[0.15] transition-all duration-1000 ease-in-out ${bottomGlowClasses[mode]}`}
        />

        {/* Toast Notification */}
        {notification && (
          <view className="absolute top-10 left-1/2 -translate-x-1/2 bg-gray-900 px-6 py-3 rounded-full z-50 shadow-xl">
            <text className="text-white text-sm font-medium tracking-wide">
              {notification}
            </text>
          </view>
        )}

        {/* Top Bar Controls */}
        <view className="relative flex flex-row justify-between items-center w-full mt-2 h-8 z-50">
          <view className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <text className="text-[28px] font-extrabold text-gray-800 tracking-tight">
              Pomodoro
            </text>
          </view>

          <view className="flex-1" />
          <Settings config={config} onUpdate={updateConfig} />
        </view>

        {/* Main Content */}
        <view className="relative z-10 flex flex-col items-center mt-6">
          <TimerDisplay timeLeft={timeLeft} mode={mode} />

          <Controls
            isActive={isActive}
            onToggle={toggleTimer}
            onReset={resetTimer}
            mode={mode}
          />

          <CycleIndicator completed={cyclesCompleted} total={4} />
        </view>
      </view>
    </view>
  );
}
