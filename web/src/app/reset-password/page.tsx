import { ResetForm } from "@/components/onboarding/reset-form";

export const metadata = { title: "Reset your password" };

/**
 * The landing point for the emailed reset link.
 *
 * Better Auth validates the token at /api/auth/reset-password/:token and
 * redirects here with ?token=<token> on success, or ?error=INVALID_TOKEN when
 * the link is expired, already used, or malformed. Without this page the
 * redirect landed on /login, which ignored the token, so the flow was
 * impossible to complete even with working email.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
  const error = Array.isArray(params.error) ? params.error[0] : params.error;

  return (
    <div className="onboard">
      <ResetForm token={token ?? null} initialError={error ?? null} />
    </div>
  );
}