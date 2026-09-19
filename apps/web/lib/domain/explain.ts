/** "Match porque: X, Y e Z." -> ["X", "Y", "Z"] for bullet rendering. */
export function explanationToBullets(text: string): string[] {
  const body = text.replace(/^Match porque:\s*/i, "").replace(/\.\s*$/, "");
  const lastAndSplit = body.split(/,\s*(?=[^,]*$)/);
  const parts: string[] = [];
  for (const [i, chunk] of lastAndSplit.entries()) {
    if (i === lastAndSplit.length - 1 && chunk.includes(" e ")) {
      parts.push(...chunk.split(/\s+e\s+/));
    } else {
      parts.push(chunk);
    }
  }
  return parts.map((p) => p.trim()).filter(Boolean);
}

export function hoursUntil(isoDate: string): number {
  return Math.max(0, Math.round((new Date(isoDate).getTime() - Date.now()) / 3.6e6));
}
