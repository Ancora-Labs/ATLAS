export function getDesktopLayoutMode(width) {
  const numericWidth = Number(width);
  if (!Number.isFinite(numericWidth) || numericWidth < 960) {
    return "stacked";
  }
  return "split";
}
