interface ControlsProps {
  isActive: boolean;
  onToggle: () => void;
  onReset: () => void;
  mode: string;
}

const modeColors: Record<string, string> = {
  work: 'bg-red-500 shadow-red-500/30',
  shortBreak: 'bg-green-500 shadow-green-500/30',
  longBreak: 'bg-blue-500 shadow-blue-500/30',
};

export const Controls = ({
  isActive,
  onToggle,
  onReset,
  mode,
}: ControlsProps) => {
  return (
    <view className="flex flex-row items-center justify-center gap-8 mt-6 mb-8">
      <view
        bindtap={onToggle}
        className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ease-out shadow-lg ${modeColors[mode]}`}
      >
        <text className="text-white text-2xl font-bold tracking-tighter">
          {isActive ? 'Pause' : 'Play'}
        </text>
      </view>

      <view
        bindtap={onReset}
        className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center transition-all duration-300 ease-out border border-gray-200"
      >
        <text className="text-gray-500 text-2xl font-bold">Reset</text>
      </view>
    </view>
  );
};
