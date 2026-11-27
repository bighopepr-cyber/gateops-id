export function calculateDurationSeconds(exitAt: Date, returnAt: Date): number {
  return Math.max(0, Math.floor((returnAt.getTime() - exitAt.getTime()) / 1000));
}
