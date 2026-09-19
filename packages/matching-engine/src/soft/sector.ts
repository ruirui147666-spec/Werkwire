export function scoreSector(blockedSectors: string[], jobSector: string): number {
  return blockedSectors.includes(jobSector) ? 0.0 : 1.0;
}
