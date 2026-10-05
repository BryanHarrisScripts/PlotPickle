export type MediaRouteIntegerBounds = Readonly<{
  minimum: number;
  maximum: number;
}>;

export function readMediaRouteInteger(value: unknown, bounds: MediaRouteIntegerBounds) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed)) return null;
  return parsed >= bounds.minimum && parsed <= bounds.maximum ? parsed : null;
}
