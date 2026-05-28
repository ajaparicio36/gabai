export function roundToGrid(coord: number): number {
  return Math.round(coord * 200) / 200;
}

export function getAreaKey(lat: number, lng: number, radiusM: number): string {
  const latKey = roundToGrid(lat);
  const lngKey = roundToGrid(lng);
  return `${latKey}_${lngKey}_${radiusM}`;
}
