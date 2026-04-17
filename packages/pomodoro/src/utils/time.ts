export const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  const m = minutes < 10 ? `0${minutes}` : minutes.toString();
  const s =
    remainingSeconds < 10
      ? `0${remainingSeconds}`
      : remainingSeconds.toString();
  return `${m}:${s}`;
};
