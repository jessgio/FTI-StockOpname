import { timingSafeEqual } from "crypto";

/** Compare PINs in constant time (length must match for timingSafeEqual). */
export function pinsMatch(input: string, expected: string): boolean {
  const a = input.trim();
  const b = expected.trim();
  if (!a || !b) return false;
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
