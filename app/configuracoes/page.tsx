"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  ShieldCheck,
  ShieldAlert,
  Smartphone,
  Copy,
  Check,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Trash2,
  KeyRound,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Navbar } from "@/components/navbar";
import { cn } from "@/lib/utils";

interface TotpEnrollmentState {
  factorId: string;
  uri: string;
  secret: string;
  qrCodeSvgDataUri?: string;
}

interface VerifiedFactor {
  id: string;
  friendly_name?: string;
  factor_type: string;
  status: string;
  created_at?: string;
}

export default function ConfiguracoesPage() {
  const [loadingFactors, setLoadingFactors] = useState(true);
  const [userEmail, setUserEmail] = useState<string>("");
  const [verifiedFactors, setVerifiedFactors] = useState<VerifiedFactor[]>([]);

  // Estado do fluxo de ativação (enroll)
  const [enrolling, setEnrolling] = useState(false);
  const [enrollmentData, setEnrollmentData] =
    useState<TotpEnrollmentState | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);

  // Estado para desativar MFA (unenroll)
  const [disablingId, setDisablingId] = useState<string | null>(null);

  // Feedback visual
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const loadMfaStatus = useCallback(async () => {
    setLoadingFactors(true);
    try {
      const supabase = createClient();
      const [userRes, factorsRes] = await Promise.all([
        supabase.auth.getUser(),
        supabase.auth.mfa.listFactors(),
      ]);

      if (userRes.data?.user?.email) {
        setUserEmail(userRes.data.user.email);
      }

      if (factorsRes.error) {
        setStatusMessage({
          type: "error",
          text: `Erro ao consultar fatores MFA: ${factorsRes.error.message}`,
        });
        return;
      }

      const totpVerified = (factorsRes.data?.totp ?? []).filter(
        (f) => f.status === "verified"
      );
      setVerifiedFactors(totpVerified);
    } catch {
      setStatusMessage({
        type: "error",
        text: "Não foi possível carregar as configurações de segurança.",
      });
    } finally {
      setLoadingFactors(false);
    }
  }, []);

  useEffect(() => {
    loadMfaStatus();
  }, [loadMfaStatus]);

  async function handleStartEnroll() {
    setStatusMessage(null);
    setEnrolling(true);

    try {
      const supabase = createClient();

      // Remove eventuais fatores não verificados pendentes de tentativas anteriores
      const { data: existingFactors } = await supabase.auth.mfa.listFactors();
      const unverifiedList = (existingFactors?.all ?? []).filter(
        (f) => f.status === "unverified"
      );
      for (const factor of unverifiedList) {
        await supabase.auth.mfa.unenroll({ factorId: factor.id });
      }

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `Controle de Pedidos (${new Date().toLocaleDateString("pt-BR")})`,
      });

      if (error || !data) {
        setStatusMessage({
          type: "error",
          text: error?.message || "Não foi possível iniciar a configuração do 2FA.",
        });
        return;
      }

      setEnrollmentData({
        factorId: data.id,
        uri: data.totp.uri,
        secret: data.totp.secret,
        qrCodeSvgDataUri: data.totp.qr_code,
      });
      setVerificationCode("");
    } catch {
      setStatusMessage({
        type: "error",
        text: "Erro inesperado ao gerar o código QR de verificação.",
      });
    } finally {
      setEnrolling(false);
    }
  }

  async function handleCancelEnroll() {
    if (enrollmentData?.factorId) {
      try {
        const supabase = createClient();
        await supabase.auth.mfa.unenroll({ factorId: enrollmentData.factorId });
      } catch {
        // Ignora erro ao descartar fator não verificado
      }
    }
    setEnrollmentData(null);
    setVerificationCode("");
  }

  async function handleVerifyAndActivate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enrollmentData) return;

    const cleanCode = verificationCode.replace(/\D/g, "").trim();
    if (cleanCode.length !== 6) {
      setStatusMessage({
        type: "error",
        text: "Insira o código numérico de 6 dígitos gerado pelo aplicativo autenticador.",
      });
      return;
    }

    setVerifyingCode(true);
    setStatusMessage(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: enrollmentData.factorId,
        code: cleanCode,
      });

      if (error) {
        setStatusMessage({
          type: "error",
          text: "Código de 6 dígitos inválido ou expirado. Verifique no seu aplicativo autenticador e tente novamente.",
        });
        return;
      }

      setEnrollmentData(null);
      setVerificationCode("");
      setStatusMessage({
        type: "success",
        text: "Verificação em Duas Etapas (2FA / MFA) ativada com sucesso!",
      });
      await loadMfaStatus();
    } catch {
      setStatusMessage({
        type: "error",
        text: "Não foi possível validar o código informado.",
      });
    } finally {
      setVerifyingCode(false);
    }
  }

  async function handleDisableMfa(factorId: string) {
    setDisablingId(factorId);
    setStatusMessage(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.mfa.unenroll({ factorId });

      if (error) {
        setStatusMessage({
          type: "error",
          text: `Não foi possível desativar o MFA: ${error.message}`,
        });
        return;
      }

      setStatusMessage({
        type: "success",
        text: "Verificação em Duas Etapas (2FA) desativada com sucesso.",
      });
      await loadMfaStatus();
    } catch {
      setStatusMessage({
        type: "error",
        text: "Erro inesperado ao desativar o MFA.",
      });
    } finally {
      setDisablingId(null);
    }
  }

  async function handleCopySecret() {
    if (!enrollmentData?.secret) return;
    try {
      await navigator.clipboard.writeText(enrollmentData.secret);
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2500);
    } catch {
      // Fallback silencioso
    }
  }

  const isMfaEnabled = verifiedFactors.length > 0;

  return (
    <div className="dark-gold-page min-h-screen bg-[#09090b] text-zinc-100">
      <Navbar />

      <main className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:pl-72 lg:pr-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-amber-400">
            Configurações de Segurança
          </h1>
          <p className="mt-1 text-sm text-white/85">
            Gerencie a proteção da sua conta e a Verificação em Duas Etapas (MFA / 2FA).
          </p>
        </div>

        {statusMessage && (
          <div
            role="alert"
            className={cn(
              "mb-6 flex items-start justify-between gap-3 rounded-xl border p-4 text-sm shadow-sm",
              statusMessage.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-red-200 bg-red-50 text-red-900"
            )}
          >
            <div className="flex items-start gap-2.5">
              {statusMessage.type === "success" ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
              )}
              <span className="font-medium">{statusMessage.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusMessage(null)}
              className="rounded-lg p-1 text-slate-400 hover:bg-black/5 hover:text-slate-600"
              aria-label="Fechar aviso"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-6 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3.5">
              <div
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
                  isMfaEnabled
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-100 text-slate-700"
                )}
              >
                {isMfaEnabled ? (
                  <ShieldCheck className="h-6 w-6" />
                ) : (
                  <ShieldAlert className="h-6 w-6" />
                )}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-lg font-bold text-slate-900">
                    Verificação em Duas Etapas (TOTP / 2FA)
                  </h2>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                      isMfaEnabled
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-600"
                    )}
                  >
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        isMfaEnabled ? "bg-emerald-500" : "bg-slate-400"
                      )}
                    />
                    {isMfaEnabled ? "Ativado" : "Opcional (Desativado)"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  Adicione uma camada extra de proteção exigindo um código de 6 dígitos do Google Authenticator ou Authy ao entrar.
                </p>
                {userEmail && (
                  <p className="mt-1 text-xs text-slate-400">
                    Conta conectada: <strong className="text-slate-600">{userEmail}</strong>
                  </p>
                )}
              </div>
            </div>

            {!loadingFactors && !isMfaEnabled && !enrollmentData && (
              <button
                type="button"
                onClick={handleStartEnroll}
                disabled={enrolling}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {enrolling ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Gerando QR Code...
                  </>
                ) : (
                  <>
                    <Smartphone className="h-4 w-4" />
                    Ativar Verificação em Duas Etapas
                  </>
                )}
              </button>
            )}
          </div>

          {loadingFactors ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin text-slate-700" />
              <p className="mt-2 text-sm">Verificando status do MFA...</p>
            </div>
          ) : isMfaEnabled ? (
            <div className="mt-6 space-y-4">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                <p className="text-sm font-medium text-emerald-900">
                  A sua conta está protegida com autenticação de dois fatores (TOTP).
                </p>
                <p className="mt-1 text-xs text-emerald-700">
                  Sempre que iniciar sessão com e-mail e palavra-passe, será solicitado o código de 6 dígitos do seu aplicativo autenticador.
                </p>
              </div>

              <div className="divide-y divide-slate-200 rounded-xl border border-slate-200">
                {verifiedFactors.map((factor) => (
                  <div
                    key={factor.id}
                    className="flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                        <KeyRound className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {factor.friendly_name || "Aplicativo Autenticador (TOTP)"}
                        </p>
                        <p className="text-xs text-slate-500">
                          Tipo: {factor.factor_type.toUpperCase()} • Status: Verificado
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDisableMfa(factor.id)}
                      disabled={disablingId === factor.id}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
                    >
                      {disablingId === factor.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      Desativar MFA
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : enrollmentData ? (
            /* Fluxo de Leitura do QR Code + Código Manual + Confirmação de 6 dígitos */
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-6">
              <h3 className="text-base font-bold text-slate-900">
                Configurar Aplicativo Autenticador
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                1. Abra o <strong>Google Authenticator</strong> (ou Authy / Microsoft Authenticator) no seu telemóvel e escaneie o QR Code abaixo:
              </p>

              <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-2 md:items-center">
                <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
                  <QRCodeSVG
                    value={enrollmentData.uri}
                    size={184}
                    level="M"
                    includeMargin
                  />
                  <span className="mt-2 text-xs text-slate-500">
                    Escaneie com a câmara no aplicativo autenticador
                  </span>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Ou insira o código manualmente:
                    </label>
                    <div className="mt-1.5 flex items-center gap-2">
                      <code className="flex-1 overflow-x-auto rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 font-mono text-xs font-semibold tracking-wider text-slate-800">
                        {enrollmentData.secret}
                      </code>
                      <button
                        type="button"
                        onClick={handleCopySecret}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        {copiedSecret ? (
                          <>
                            <Check className="h-4 w-4 text-emerald-600" />
                            Copiado
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4" />
                            Copiar
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <form onSubmit={handleVerifyAndActivate} className="space-y-3">
                    <div>
                      <label
                        htmlFor="totp-code"
                        className="block text-sm font-medium text-slate-700"
                      >
                        2. Digite o código de 6 dígitos gerado pelo app:
                      </label>
                      <input
                        id="totp-code"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        required
                        disabled={verifyingCode}
                        value={verificationCode}
                        onChange={(e) =>
                          setVerificationCode(e.target.value.replace(/\D/g, ""))
                        }
                        placeholder="000000"
                        className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-center font-mono text-lg font-bold tracking-[0.35em] text-slate-900 placeholder-slate-300 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/15"
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2.5 pt-2">
                      <button
                        type="button"
                        onClick={handleCancelEnroll}
                        disabled={verifyingCode}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={verifyingCode || verificationCode.length !== 6}
                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {verifyingCode ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Verificando...
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="h-4 w-4" />
                            Confirmar e Ativar 2FA
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-600">
              A verificação em duas etapas está desativada. Você pode ativá-la a qualquer momento clicando no botão <strong>Ativar Verificação em Duas Etapas</strong> acima.
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
