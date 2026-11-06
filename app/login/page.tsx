"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Store,
  ShieldCheck,
  ArrowLeft,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { signOutClient } from "@/lib/auth/client-logout";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Estado para o segundo fator (MFA / TOTP) quando a conta possui 2FA ativo
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [verifyingMfa, setVerifyingMfa] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmedEmail = email.trim();

    // Validação no frontend: e-mail válido e senha mínima de 8 caracteres
    if (!trimmedEmail || !EMAIL_REGEX.test(trimmedEmail)) {
      setErrorMessage("Por favor, informe um endereço de e-mail válido.");
      return;
    }

    if (!password || password.length < 8) {
      setErrorMessage("A palavra-passe deve conter no mínimo 8 caracteres.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: trimmedEmail,
          password,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.status === 429) {
        setErrorMessage(
          data?.error ||
            "Demasiadas tentativas de acesso. Por favor, tente novamente após 15 minutos."
        );
        return;
      }

      if (!response.ok) {
        // Mensagem genérica estrita para qualquer erro de credenciais/autenticação
        setErrorMessage("E-mail ou palavra-passe incorretos.");
        return;
      }

      // Verifica se a conta possui fatores MFA ativos via getAuthenticatorAssuranceLevel()
      const supabase = createClient();
      const { data: aalData, error: aalError } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

      if (
        !aalError &&
        aalData &&
        aalData.currentLevel === "aal1" &&
        aalData.nextLevel === "aal2"
      ) {
        const { data: factorsData } = await supabase.auth.mfa.listFactors();
        const verifiedTotp = (factorsData?.totp ?? []).find(
          (f) => f.status === "verified"
        );

        if (verifiedTotp) {
          setMfaFactorId(verifiedTotp.id);
          setMfaCode("");
          setMfaRequired(true);
          return;
        }
      }

      // Conta sem MFA ativo: redireciona diretamente para /dashboard
      setSuccessMessage("Autenticado com sucesso! Redirecionando...");
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setErrorMessage("E-mail ou palavra-passe incorretos.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyMfa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (verifyingMfa || !mfaFactorId) return;

    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanCode = mfaCode.replace(/\D/g, "").trim();
    if (cleanCode.length !== 6) {
      setErrorMessage("Insira o código de verificação de 6 dígitos.");
      return;
    }

    setVerifyingMfa(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: mfaFactorId,
        code: cleanCode,
      });

      if (error) {
        setErrorMessage(
          "Código de verificação inválido ou expirado. Tente novamente."
        );
        return;
      }

      setSuccessMessage("Verificação concluída! Redirecionando...");
      window.location.href = "/dashboard";
    } catch {
      setErrorMessage(
        "Não foi possível validar o código de verificação. Tente novamente."
      );
    } finally {
      setVerifyingMfa(false);
    }
  }

  async function handleBackToLogin() {
    try {
      await signOutClient();
    } catch {
      // Ignora erro silenciosamente
    }
    setMfaRequired(false);
    setMfaFactorId(null);
    setMfaCode("");
    setErrorMessage(null);
    setSuccessMessage(null);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-500/25 to-amber-600/10 text-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.25)]">
            {mfaRequired ? (
              <ShieldCheck className="h-6 w-6" />
            ) : (
              <Store className="h-6 w-6" />
            )}
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-white">
            {mfaRequired
              ? "Verificação em Duas Etapas"
              : "Acesso ao Sistema"}
          </h1>
          <p className="mt-1 text-sm text-white/85">
            {mfaRequired
              ? "Digite o código de 6 dígitos do seu aplicativo autenticador"
              : "Entre com suas credenciais para acessar o painel"}
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-panel p-6 shadow-sm sm:p-8">
          {errorMessage && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div
              role="status"
              className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm text-emerald-700"
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
          )}

          {mfaRequired ? (
            <form onSubmit={handleVerifyMfa} className="space-y-5" noValidate>
              <div>
                <label
                  htmlFor="mfa-code"
                  className="block text-sm font-medium text-inkSoft"
                >
                  Código de Verificação de 6 dígitos
                </label>
                <input
                  id="mfa-code"
                  name="mfa-code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="one-time-code"
                  maxLength={6}
                  required
                  disabled={verifyingMfa}
                  value={mfaCode}
                  onChange={(e) =>
                    setMfaCode(e.target.value.replace(/\D/g, ""))
                  }
                  placeholder="000000"
                  className="mt-2 w-full rounded-xl border border-line bg-panelElevated py-3 text-center font-mono text-xl font-bold tracking-[0.4em] text-ink placeholder:text-inkMuted transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:bg-panelMuted"
                />
              </div>

              <button
                type="submit"
                disabled={verifyingMfa || mfaCode.length !== 6}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-black shadow-sm transition-colors hover:bg-brandStrong focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {verifyingMfa ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    A verificar código...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4" />
                    Confirmar Código
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleBackToLogin}
                disabled={verifyingMfa}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-line bg-panel px-4 py-2 text-xs font-medium text-inkSoft transition-colors hover:bg-panelElevated hover:text-ink"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Voltar para o login
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-inkSoft"
                >
                  E-mail
                </label>
                <div className="relative mt-1.5">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-inkMuted" />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    disabled={loading}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="w-full rounded-xl border border-line bg-panelElevated py-2.5 pl-10 pr-4 text-sm text-ink placeholder:text-inkMuted transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:bg-panelMuted disabled:opacity-70"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-inkSoft"
                >
                  Palavra-passe
                </label>
                <div className="relative mt-1.5">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-inkMuted" />
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    minLength={8}
                    disabled={loading}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo de 8 caracteres"
                    className="w-full rounded-xl border border-line bg-panelElevated py-2.5 pl-10 pr-10 text-sm text-ink placeholder:text-inkMuted transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:bg-panelMuted disabled:opacity-70"
                  />
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-inkMuted hover:text-inkSoft disabled:opacity-50"
                    aria-label={
                      showPassword
                        ? "Ocultar palavra-passe"
                        : "Mostrar palavra-passe"
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-black shadow-sm transition-colors hover:bg-brandStrong focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    A autenticar...
                  </>
                ) : (
                  "Entrar"
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
