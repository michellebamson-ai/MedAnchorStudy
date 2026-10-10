/** Password strength meter, shared by sign-up and password reset. */
export function strengthOf(pw: string): { label: string; pct: number } {
  if (!pw) return { label: "", pct: 0 };
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (pw.length >= 12) score += 1;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score += 1;
  if (/\d/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;
  if (score <= 2) return { label: "Weak", pct: 33 };
  if (score <= 3) return { label: "Okay", pct: 66 };
  return { label: "Strong", pct: 100 };
}