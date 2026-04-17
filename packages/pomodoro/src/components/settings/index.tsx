import { useState } from 'react';
import type { TimerConfig } from '../../types/index.js';
import { DEFAULT_CONFIG } from '../../hooks/use-pomodoro.js';

interface SettingsProps {
  config?: TimerConfig;
  onUpdate: (newConfig: TimerConfig) => void;
}

export const Settings = ({
  config = DEFAULT_CONFIG,
  onUpdate,
}: SettingsProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [localConfig, setLocalConfig] = useState(config);

  const handleOpen = () => {
    setLocalConfig(config);
    setIsOpen(true);
  };

  const handleAdjust = (key: keyof TimerConfig, delta: number) => {
    setLocalConfig((prev) => {
      const newValue = prev[key] + delta;
      if (newValue > 0) {
        return { ...prev, [key]: newValue };
      }
      return prev;
    });
  };

  const handleSave = () => {
    onUpdate(localConfig);
    setIsOpen(false);
  };

  return (
    <>
      <view
        bindtap={handleOpen}
        className="w-20 h-8 rounded-full bg-gray-50 flex items-center justify-center shadow-sm"
      >
        <text className="text-gray-500 text-sm font-bold tracking-wider">
          Settings
        </text>
      </view>

      {isOpen && (
        <view className="fixed inset-0 flex items-center justify-center px-4 bg-black/50 z-50">
          <view className="relative w-full max-w-[320px] bg-white rounded-2xl p-6 shadow-2xl">
            <view className="flex flex-row justify-between items-center mb-6">
              <text className="text-xl font-bold text-gray-800">
                Timer Settings
              </text>
              <view bindtap={() => setIsOpen(false)} className="p-2">
                <text className="text-gray-400 text-xl font-bold">X</text>
              </view>
            </view>

            <view className="flex flex-col">
              <view className="flex flex-row justify-between items-center border-b border-gray-100 pb-4 mb-4">
                <text className="font-medium text-gray-600 text-base">
                  Focus Duration
                </text>
                <view className="flex flex-row items-center gap-2">
                  <view
                    bindtap={() => handleAdjust('work', -1)}
                    className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
                  >
                    <text className="text-gray-600 font-bold">-</text>
                  </view>
                  <text className="w-12 p-2 border border-gray-200 rounded-lg text-center text-base font-medium">
                    {localConfig.work}
                  </text>
                  <view
                    bindtap={() => handleAdjust('work', 1)}
                    className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
                  >
                    <text className="text-gray-600 font-bold">+</text>
                  </view>
                  <text className="text-gray-400 text-sm ml-1">min</text>
                </view>
              </view>

              <view className="flex flex-row justify-between items-center border-b border-gray-100 pb-4 mb-4">
                <text className="font-medium text-gray-600 text-base">
                  Short Break
                </text>
                <view className="flex flex-row items-center gap-2">
                  <view
                    bindtap={() => handleAdjust('shortBreak', -1)}
                    className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
                  >
                    <text className="text-gray-600 font-bold">-</text>
                  </view>
                  <text className="w-12 p-2 border border-gray-200 rounded-lg text-center text-base font-medium">
                    {localConfig.shortBreak}
                  </text>
                  <view
                    bindtap={() => handleAdjust('shortBreak', 1)}
                    className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
                  >
                    <text className="text-gray-600 font-bold">+</text>
                  </view>
                  <text className="text-gray-400 text-sm ml-1">min</text>
                </view>
              </view>

              <view className="flex flex-row justify-between items-center border-b border-gray-100 pb-4 mb-4">
                <text className="font-medium text-gray-600 text-base">
                  Long Break
                </text>
                <view className="flex flex-row items-center gap-2">
                  <view
                    bindtap={() => handleAdjust('longBreak', -1)}
                    className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
                  >
                    <text className="text-gray-600 font-bold">-</text>
                  </view>
                  <text className="w-12 p-2 border border-gray-200 rounded-lg text-center text-base font-medium">
                    {localConfig.longBreak}
                  </text>
                  <view
                    bindtap={() => handleAdjust('longBreak', 1)}
                    className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
                  >
                    <text className="text-gray-600 font-bold">+</text>
                  </view>
                  <text className="text-gray-400 text-sm ml-1">min</text>
                </view>
              </view>
            </view>

            <view className="mt-6 flex flex-row justify-end">
              <view
                bindtap={handleSave}
                className="px-6 py-3 bg-gray-900 rounded-xl"
              >
                <text className="text-white font-medium text-base">Save</text>
              </view>
            </view>
          </view>
        </view>
      )}
    </>
  );
};
