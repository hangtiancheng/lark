export type TimerMode = 'work' | 'shortBreak' | 'longBreak';

export interface TimerConfig {
  work: number;
  shortBreak: number;
  longBreak: number;
}

export interface PomodoroState {
  mode: TimerMode;
  timeLeft: number;
  isActive: boolean;
  cyclesCompleted: number;
}
