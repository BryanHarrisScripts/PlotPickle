export function versionAtLeast(actual, minimum) {
  const tuple = (value) => String(value || "").split(".").slice(0, 3).map((item) => Number(item) || 0);
  const left = tuple(actual);
  const right = tuple(minimum);
  for (let index = 0; index < 3; index += 1) {
    if (left[index] > right[index]) return true;
    if (left[index] < right[index]) return false;
  }
  return true;
}
