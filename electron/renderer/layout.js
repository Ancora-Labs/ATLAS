export function getDesktopLayoutMode(width) {
  const numericWidth = Number(width);
  if (!Number.isFinite(numericWidth) || numericWidth < 1100) {
    return "stacked";
  }
  return "split";
}
