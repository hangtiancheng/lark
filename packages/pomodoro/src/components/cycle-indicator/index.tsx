interface CycleIndicatorProps {
  completed: number;
  total: number;
}

export const CycleIndicator = ({ completed, total }: CycleIndicatorProps) => {
  return (
    <view className="flex flex-col items-center mt-2 text-gray-500 text-sm">
      <text className="mb-3 uppercase tracking-wider text-xs font-semibold text-gray-400">
        Cycles
      </text>
      <view className="flex flex-row gap-3">
        {new Array(total).fill(0).map((_: any, i: number) => (
          <view
            key={i}
            className={`w-3 h-3 rounded-full transition-all duration-500 ease-in-out ${
              i < completed
                ? 'bg-red-500 scale-125 shadow-md shadow-red-500/30'
                : 'bg-gray-200'
            }`}
          />
        ))}
      </view>
      <text className="mt-4 text-xs font-medium text-gray-400">
        {`${completed}/${total} Pomodoros`}
      </text>
    </view>
  );
};
