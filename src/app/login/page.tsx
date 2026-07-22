import { getAllowedEmailsConfiguration } from "@/features/auth/allowed-emails";
import { getAuthErrorMessage } from "@/features/auth/auth-errors";
import { getSafeAuthRedirect } from "@/features/auth/auth-redirect";
import { LoginScreen } from "@/features/auth/components/login-screen";
import { isSupabaseConfigured } from "@/lib/env";

interface LoginPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function getFirstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const configured =
    isSupabaseConfigured() && getAllowedEmailsConfiguration().configured;
  const errorCode = configured
    ? getFirstValue(params.error)
    : "auth_configuration_missing";

  return (
    <LoginScreen
      configured={configured}
      errorMessage={getAuthErrorMessage(errorCode)}
      nextPath={getSafeAuthRedirect(getFirstValue(params.next))}
    />
  );
}
