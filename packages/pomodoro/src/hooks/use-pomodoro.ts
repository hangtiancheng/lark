import { useState, useEffect, useRef, useCallback } from 'react';
import type { TimerConfig, TimerMode } from '../types/index.js';

export const DEFAULT_CONFIG: TimerConfig = {
  work: 25,
  shortBreak: 5,
  longBreak: 15,
};

export const usePomodoro = () => {
  const [config, setConfig] = useState<TimerConfig>(DEFAULT_CONFIG);
  const [mode, setMode] = useState<TimerMode>('work');
  const [timeLeft, setTimeLeft] = useState(config.work * 60);
  const [isActive, setIsActive] = useState(false);
  const [cyclesCompleted, setCyclesCompleted] = useState(0);
  const [notification, setNotification] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const switchMode = useCallback(() => {
    let nextMode: TimerMode = 'work';
    let message = '';

    if (mode === 'work') {
      const nextCycles = cyclesCompleted + 1;
      setCyclesCompleted(nextCycles);

      if (nextCycles > 0 && nextCycles % 4 === 0) {
        nextMode = 'longBreak';
        message = '4 cycles done! Take a 15 minutes break!';
      } else {
        nextMode = 'shortBreak';
        message = 'Good job! Take a 5 minutes break!';
      }
    } else if (mode === 'longBreak') {
      nextMode = 'work';
      setCyclesCompleted(0);
      message = 'Long break is over. Fresh start!';
    } else {
      nextMode = 'work';
      message = 'Break is over. Focus time!';
    }

    setMode(nextMode);
    setTimeLeft(config[nextMode] * 60);
    setIsActive(false);

    // Trigger notification
    setNotification(message);
    setTimeout(() => setNotification(null), 3000);
  }, [mode, cyclesCompleted, config]);

  useEffect(() => {
    if (isActive && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive, timeLeft]);

  useEffect(() => {
    if (timeLeft === 0 && isActive) {
      const timeoutId = setTimeout(() => {
        setIsActive(false);
        switchMode();
      }, 0);
      return () => clearTimeout(timeoutId);
    }
    return undefined;
  }, [timeLeft, isActive, switchMode]);

  const toggleTimer = () => setIsActive(!isActive);

  const resetTimer = () => {
    setIsActive(false);
    setTimeLeft(config[mode] * 60);
  };

  const updateConfig = (newConfig: TimerConfig) => {
    setConfig(newConfig);
    if (!isActive) {
      setTimeLeft(newConfig[mode] * 60);
    }
  };

  return {
    mode,
    timeLeft,
    isActive,
    cyclesCompleted,
    config,
    notification,
    toggleTimer,
    resetTimer,
    updateConfig,
  };
};
