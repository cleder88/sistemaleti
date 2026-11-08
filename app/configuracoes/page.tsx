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
  Users,
  ClipboardList,
  RefreshCw,
  HardDriveDownload,
  Download,
  AlertTriangle,
  Mail,
  Send,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Navbar } from "@/components/navbar";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/lib/auth/use-user-role";
import { Badge, Button, Card, Field, Input, Select } from "@/components/ui";

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

interface UserProfileRow {
  user_id: string;
  email: string | null;
  role: "admin" | "operator";
  created_at?: string | null;
}

interface AuditLogRow {
  id: string;
  actor_email: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface SystemBackupRow {
  id: string;
  label: string | null;
  created_by_email: string | null;
  table_counts: Record<string, number> | null;
  size_bytes: number;
  created_at: string;
}

export default function ConfiguracoesPage() {
  const { userId, isAdmin } = useUserRole();
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

  // Administração (apenas admins): utilizadores e trilha de auditoria
  const [profiles, setProfiles] = useState<UserProfileRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>([]);
  const [loadingAdmin, setLoadingAdmin] = useState(false);
  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);

  // Backups do sistema (apenas admins)
  const [backups, setBackups] = useState<SystemBackupRow[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [deletingBackupId, setDeletingBackupId] = useState<string | null>(null);

  // Formatação completa do sistema (apenas admins)
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetStep, setResetStep] = useState<"confirm" | "code">("confirm");
  const [backupConfirmed, setBackupConfirmed] = useState(false);
  const [resetPhrase, setResetPhrase] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [resetEmailHint, setResetEmailHint] = useState<string | null>(null);
  const [sendingResetCode, setSendingResetCode] = useState(false);
  const [executingReset, setExecutingReset] = useState(false);
  const [creatingResetBackup, setCreatingResetBackup] = useState(false);

  const loadAdminData = useCallback(async () => {
    setLoadingAdmin(true);
    try {
      const supabase = createClient();
      const [profilesRes, auditRes] = await Promise.all([
        supabase
          .from("user_profiles")
          .select("user_id, email, role, created_at")
          .order("email", { ascending: true }),
        supabase
          .from("audit_logs")
          .select("id, actor_email, action, entity, entity_id, metadata, created_at")
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      if (profilesRes.error) {
        setStatusMessage({
          type: "error",
          text: `Erro ao carregar utilizadores: ${profilesRes.error.message}`,
        });
      } else {
        setProfiles((profilesRes.data ?? []) as UserProfileRow[]);
      }

      if (auditRes.error) {
        setStatusMessage({
          type: "error",
          text: `Erro ao carregar auditoria: ${auditRes.error.message}`,
        });
      } else {
        setAuditLogs((auditRes.data ?? []) as AuditLogRow[]);
      }
    } catch {
      setStatusMessage({
        type: "error",
        text: "Não foi possível carregar os dados administrativos.",
      });
    } finally {
      setLoadingAdmin(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadAdminData();
    }
  }, [isAdmin, loadAdminData]);

  const loadBackups = useCallback(async () => {
    setLoadingBackups(true);
    try {
      const response = await fetch("/api/backup", { cache: "no-store" });
      const json = await response.json();

      if (!response.ok) {
        setStatusMessage({
          type: "error",
          text: json?.error || "Não foi possível carregar os backups.",
        });
        return;
      }

      setBackups((json?.data ?? []) as SystemBackupRow[]);
    } catch {
      setStatusMessage({
        type: "error",
        text: "Erro ao carregar a lista de backups.",
      });
    } finally {
      setLoadingBackups(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadBackups();
    }
  }, [isAdmin, loadBackups]);

  async function handleCreateBackup() {
    setCreatingBackup(true);
    setStatusMessage(null);

    try {
      const response = await fetch("/api/backup", { method: "POST" });
      const json = await response.json();

      if (!response.ok) {
        setStatusMessage({
          type: "error",
          text: json?.error || "Não foi possível criar o backup.",
        });
        return;
      }

      setStatusMessage({
        type: "success",
        text: "Backup criado com sucesso e guardado no banco de dados.",
      });
      await loadBackups();
    } catch {
      setStatusMessage({
        type: "error",
        text: "Erro inesperado ao criar o backup.",
      });
    } finally {
      setCreatingBackup(false);
    }
  }

  async function handleDeleteBackup(id: string) {
    if (!window.confirm("Remover este backup? Esta ação não pode ser desfeita.")) {
      return;
    }

    setDeletingBackupId(id);
    setStatusMessage(null);

    try {
      const response = await fetch(`/api/backup?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const json = await response.json();

      if (!response.ok) {
        setStatusMessage({
          type: "error",
          text: json?.error || "Não foi possível remover o backup.",
        });
        return;
      }

      setBackups((prev) => prev.filter((b) => b.id !== id));
      setStatusMessage({
        type: "success",
        text: "Backup removido.",
      });
    } catch {
      setStatusMessage({
        type: "error",
        text: "Erro inesperado ao remover o backup.",
      });
    } finally {
      setDeletingBackupId(null);
    }
  }

  function formatFileSize(bytes: number) {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function openResetModal() {
    setStatusMessage(null);
    setResetStep("confirm");
    setBackupConfirmed(false);
    setResetPhrase("");
    setResetCode("");
    setResetEmailHint(null);
    setResetModalOpen(true);
  }

  function closeResetModal() {
    if (executingReset) return;
    setResetModalOpen(false);
    setResetStep("confirm");
    setBackupConfirmed(false);
    setResetPhrase("");
    setResetCode("");
    setResetEmailHint(null);
  }

  async function handleCreateResetBackup() {
    setCreatingResetBackup(true);
    setStatusMessage(null);

    try {
      const response = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "Backup antes da formatação do sistema" }),
      });
      const json = await response.json();

      if (!response.ok || !json?.data?.id) {
        setStatusMessage({
          type: "error",
          text: json?.error || "Não foi possível criar o backup de segurança.",
        });
        return;
      }

      const link = document.createElement("a");
      link.href = `/api/backup?id=${encodeURIComponent(json.data.id)}`;
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();

      setBackupConfirmed(true);
      await loadBackups();
      setStatusMessage({
        type: "success",
        text: "Backup criado e download iniciado. Guarde o ficheiro antes de formatar.",
      });
    } catch {
      setStatusMessage({
        type: "error",
        text: "Erro inesperado ao criar o backup de segurança.",
      });
    } finally {
      setCreatingResetBackup(false);
    }
  }

  async function handleSendResetCode() {
    setSendingResetCode(true);
    setStatusMessage(null);

    try {
      const response = await fetch("/api/system-reset/request-code", {
        method: "POST",
      });
      const json = await response.json();

      if (!response.ok) {
        setStatusMessage({
          type: "error",
          text: json?.error || "Não foi possível enviar o código de segurança.",
        });
        return;
      }

      setResetEmailHint(json?.email ?? null);
      setResetStep("code");
      setResetCode("");
      setStatusMessage({
        type: "success",
        text:
          json?.delivery === "console"
            ? json?.message ||
              "Código gerado. Verifique o console do servidor (modo desenvolvimento)."
            : `Código de segurança enviado para ${json?.email ?? "o seu e-mail"}.`,
      });
    } catch {
      setStatusMessage({
        type: "error",
        text: "Erro inesperado ao solicitar o código de segurança.",
      });
    } finally {
      setSendingResetCode(false);
    }
  }

  async function handleExecuteReset() {
    if (resetCode.length !== 6) {
      setStatusMessage({
        type: "error",
        text: "Informe o código de 6 dígitos enviado por e-mail.",
      });
      return;
    }

    setExecutingReset(true);
    setStatusMessage(null);

    try {
      const response = await fetch("/api/system-reset/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: resetCode, confirmation: "FORMATAR" }),
      });
      const json = await response.json();

      if (!response.ok) {
        setStatusMessage({
          type: "error",
          text: json?.error || "Não foi possível formatar o sistema.",
        });
        return;
      }

      const deleted = json?.deleted as Record<string, number> | undefined;
      const summary = deleted
        ? Object.entries(deleted)
            .map(([table, count]) => `${table}: ${count}`)
            .join(" · ")
        : "";

      setResetModalOpen(false);
      setResetStep("confirm");
      setBackupConfirmed(false);
      setResetPhrase("");
      setResetCode("");
      setResetEmailHint(null);

      setStatusMessage({
        type: "success",
        text: `Sistema formatado com sucesso.${
          summary ? ` Registos removidos — ${summary}.` : ""
        }`,
      });

      await loadAdminData();
      await loadBackups();
    } catch {
      setStatusMessage({
        type: "error",
        text: "Erro inesperado ao formatar o sistema.",
      });
    } finally {
      setExecutingReset(false);
    }
  }

  async function handleRoleChange(targetUserId: string, role: "admin" | "operator") {
    setUpdatingRoleId(targetUserId);
    setStatusMessage(null);

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("user_profiles")
        .update({ role })
        .eq("user_id", targetUserId);

      if (error) {
        setStatusMessage({
          type: "error",
          text: `Não foi possível atualizar o papel: ${error.message}`,
        });
        return;
      }

      setProfiles((prev) =>
        prev.map((p) =>
          p.user_id === targetUserId ? { ...p, role } : p
        )
      );
      setStatusMessage({
        type: "success",
        text: "Papel do utilizador atualizado com sucesso.",
      });
    } catch {
      setStatusMessage({
        type: "error",
        text: "Erro inesperado ao atualizar o papel do utilizador.",
      });
    } finally {
      setUpdatingRoleId(null);
    }
  }

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
    <div className="min-h-screen bg-canvas text-ink">
      <Navbar />

      <main className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:pl-72 lg:pr-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-amber-400">
            Configurações de Segurança
          </h1>
          <p className="mt-1 text-sm text-ink/85">
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
              className="rounded-lg p-1 text-inkMuted hover:bg-white/5 hover:text-inkSoft"
              aria-label="Fechar aviso"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <Card className="p-6 sm:p-8">
          <div className="flex flex-col justify-between gap-4 border-b border-line pb-6 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3.5">
              <div
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
                  isMfaEnabled
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-panelMuted text-inkSoft"
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
                  <h2 className="text-lg font-bold text-ink">
                    Verificação em Duas Etapas (TOTP / 2FA)
                  </h2>
                  <Badge variant={isMfaEnabled ? "success" : "neutral"} dot>
                    {isMfaEnabled ? "Ativado" : "Opcional (Desativado)"}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-inkSoft">
                  Adicione uma camada extra de proteção exigindo um código de 6 dígitos do Google Authenticator ou Authy ao entrar.
                </p>
                {userEmail && (
                  <p className="mt-1 text-xs text-inkMuted">
                    Conta conectada: <strong className="text-inkSoft">{userEmail}</strong>
                  </p>
                )}
              </div>
            </div>

            {!loadingFactors && !isMfaEnabled && !enrollmentData && (
              <Button
                type="button"
                variant="primary"
                onClick={handleStartEnroll}
                disabled={enrolling}
                className="shrink-0"
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
              </Button>
            )}
          </div>

          {loadingFactors ? (
            <div className="flex flex-col items-center justify-center py-12 text-inkMuted">
              <Loader2 className="h-6 w-6 animate-spin text-inkSoft" />
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

              <div className="divide-y divide-line rounded-xl border border-line">
                {verifiedFactors.map((factor) => (
                  <div
                    key={factor.id}
                    className="flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-panelMuted text-inkSoft">
                        <KeyRound className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-ink">
                          {factor.friendly_name || "Aplicativo Autenticador (TOTP)"}
                        </p>
                        <p className="text-xs text-inkMuted">
                          Tipo: {factor.factor_type.toUpperCase()} • Status: Verificado
                        </p>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={() => handleDisableMfa(factor.id)}
                      disabled={disablingId === factor.id}
                      className="px-3.5"
                    >
                      {disablingId === factor.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      Desativar MFA
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ) : enrollmentData ? (
            /* Fluxo de Leitura do QR Code + Código Manual + Confirmação de 6 dígitos */
            <div className="mt-6 rounded-2xl border border-line bg-panelMuted p-6">
              <h3 className="text-base font-bold text-ink">
                Configurar Aplicativo Autenticador
              </h3>
              <p className="mt-1 text-sm text-inkSoft">
                1. Abra o <strong>Google Authenticator</strong> (ou Authy / Microsoft Authenticator) no seu telemóvel e escaneie o QR Code abaixo:
              </p>

              <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-2 md:items-center">
                <div className="flex flex-col items-center justify-center rounded-2xl border border-line bg-panel p-6 shadow-xs">
                  <QRCodeSVG
                    value={enrollmentData.uri}
                    size={184}
                    level="M"
                    includeMargin
                  />
                  <span className="mt-2 text-xs text-inkMuted">
                    Escaneie com a câmara no aplicativo autenticador
                  </span>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-inkMuted">
                      Ou insira o código manualmente:
                    </label>
                    <div className="mt-1.5 flex items-center gap-2">
                      <code className="flex-1 overflow-x-auto rounded-xl border border-line bg-panel px-3.5 py-2.5 font-mono text-xs font-semibold tracking-wider text-inkSoft">
                        {enrollmentData.secret}
                      </code>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handleCopySecret}
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
                      </Button>
                    </div>
                  </div>

                  <form onSubmit={handleVerifyAndActivate} className="space-y-3">
                    <Field
                      htmlFor="totp-code"
                      label="2. Digite o código de 6 dígitos gerado pelo app:"
                    >
                      <Input
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
                        className="text-center font-mono text-lg font-bold tracking-[0.35em]"
                      />
                    </Field>

                    <div className="flex items-center justify-end gap-2.5 pt-2">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={handleCancelEnroll}
                        disabled={verifyingCode}
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="submit"
                        variant="primary"
                        disabled={verifyingCode || verificationCode.length !== 6}
                        className="px-5"
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
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-xl border border-line bg-panelMuted/70 p-4 text-sm text-inkSoft">
              A verificação em duas etapas está desativada. Você pode ativá-la a qualquer momento clicando no botão <strong>Ativar Verificação em Duas Etapas</strong> acima.
            </div>
          )}
        </Card>

        {isAdmin && (
          <>
            <Card className="mt-6 p-6 sm:p-8">
              <div className="flex flex-col justify-between gap-4 border-b border-line pb-5 sm:flex-row sm:items-center">
                <div className="flex items-start gap-3.5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-panelMuted text-inkSoft">
                    <Users className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-ink">
                      Utilizadores e Permissões
                    </h2>
                    <p className="mt-1 text-sm text-inkSoft">
                      Defina quem pode administrar lojas, pedidos e a auditoria.
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={loadAdminData}
                  disabled={loadingAdmin}
                  className="shrink-0"
                >
                  <RefreshCw
                    className={cn("h-4 w-4", loadingAdmin && "animate-spin")}
                  />
                  Atualizar
                </Button>
              </div>

              {loadingAdmin ? (
                <div className="flex flex-col items-center justify-center py-10 text-inkMuted">
                  <Loader2 className="h-6 w-6 animate-spin text-inkSoft" />
                  <p className="mt-2 text-sm">Carregando utilizadores...</p>
                </div>
              ) : profiles.length === 0 ? (
                <p className="mt-6 rounded-xl border border-line bg-panelMuted/70 p-4 text-sm text-inkSoft">
                  Nenhum perfil de utilizador encontrado.
                </p>
              ) : (
                <div className="mt-5 divide-y divide-line rounded-xl border border-line">
                  {profiles.map((profile) => (
                    <div
                      key={profile.user_id}
                      className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">
                          {profile.email ?? "Sem e-mail"}
                          {profile.user_id === userId && (
                            <span className="ml-2 text-xs font-medium text-inkMuted">
                              (você)
                            </span>
                          )}
                        </p>
                        <p className="truncate text-xs text-inkMuted">
                          ID: {profile.user_id}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {updatingRoleId === profile.user_id && (
                          <Loader2 className="h-4 w-4 animate-spin text-inkMuted" />
                        )}
                        <Select
                          aria-label={`Papel de ${profile.email ?? profile.user_id}`}
                          value={profile.role}
                          disabled={
                            profile.user_id === userId ||
                            updatingRoleId === profile.user_id
                          }
                          onChange={(e) =>
                            handleRoleChange(
                              profile.user_id,
                              e.target.value as "admin" | "operator"
                            )
                          }
                          className="w-auto min-w-[160px] text-xs"
                        >
                          <option value="admin">Administrador</option>
                          <option value="operator">Operador</option>
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="mt-6 p-6 sm:p-8">
              <div className="flex items-start gap-3.5 border-b border-line pb-5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-panelMuted text-inkSoft">
                  <ClipboardList className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-ink">
                    Trilha de Auditoria
                  </h2>
                  <p className="mt-1 text-sm text-inkSoft">
                    Últimas 50 ações de escrita registadas no sistema.
                  </p>
                </div>
              </div>

              {loadingAdmin ? (
                <div className="flex flex-col items-center justify-center py-10 text-inkMuted">
                  <Loader2 className="h-6 w-6 animate-spin text-inkSoft" />
                  <p className="mt-2 text-sm">Carregando auditoria...</p>
                </div>
              ) : auditLogs.length === 0 ? (
                <p className="mt-6 rounded-xl border border-line bg-panelMuted/70 p-4 text-sm text-inkSoft">
                  Nenhum registo de auditoria encontrado.
                </p>
              ) : (
                <div className="mt-5 overflow-x-auto rounded-xl border border-line">
                  <table className="w-full min-w-[720px] text-left text-xs">
                    <thead className="bg-panelMuted text-[11px] font-bold uppercase tracking-wider text-inkMuted">
                      <tr>
                        <th className="px-4 py-3">Data</th>
                        <th className="px-4 py-3">Utilizador</th>
                        <th className="px-4 py-3">Ação</th>
                        <th className="px-4 py-3">Entidade</th>
                        <th className="px-4 py-3">Detalhes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {auditLogs.map((log) => (
                        <tr key={log.id}>
                          <td className="whitespace-nowrap px-4 py-3 text-inkMuted">
                            {new Date(log.created_at).toLocaleString("pt-BR")}
                          </td>
                          <td className="px-4 py-3 text-inkSoft">
                            {log.actor_email ?? "—"}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 font-semibold text-ink">
                            {log.action}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-inkSoft">
                            {log.entity}
                          </td>
                          <td className="max-w-[260px] truncate px-4 py-3 text-inkMuted">
                            {log.metadata
                              ? JSON.stringify(log.metadata)
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card className="mt-6 p-6 sm:p-8">
              <div className="flex flex-col justify-between gap-4 border-b border-line pb-5 sm:flex-row sm:items-center">
                <div className="flex items-start gap-3.5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-panelMuted text-inkSoft">
                    <HardDriveDownload className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-ink">
                      Backup do Sistema
                    </h2>
                    <p className="mt-1 text-sm text-inkSoft">
                      Guarde uma cópia completa de lojas, pedidos, itens,
                      utilizadores e auditoria no banco de dados.
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleCreateBackup}
                  disabled={creatingBackup}
                  className="shrink-0"
                >
                  {creatingBackup ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Gerando backup...
                    </>
                  ) : (
                    <>
                      <HardDriveDownload className="h-4 w-4" />
                      Criar Backup
                    </>
                  )}
                </Button>
              </div>

              {loadingBackups ? (
                <div className="flex flex-col items-center justify-center py-10 text-inkMuted">
                  <Loader2 className="h-6 w-6 animate-spin text-inkSoft" />
                  <p className="mt-2 text-sm">Carregando backups...</p>
                </div>
              ) : backups.length === 0 ? (
                <p className="mt-6 rounded-xl border border-line bg-panelMuted/70 p-4 text-sm text-inkSoft">
                  Nenhum backup guardado. Clique em <strong>Criar Backup</strong>{" "}
                  para guardar uma cópia completa do sistema.
                </p>
              ) : (
                <div className="mt-5 divide-y divide-line rounded-xl border border-line">
                  {backups.map((backup) => (
                    <div
                      key={backup.id}
                      className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">
                          {backup.label ?? "Backup do sistema"}
                        </p>
                        <p className="text-xs text-inkMuted">
                          {new Date(backup.created_at).toLocaleString("pt-BR")} •{" "}
                          {backup.created_by_email ?? "—"} •{" "}
                          {formatFileSize(backup.size_bytes)}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-inkMuted">
                          {backup.table_counts
                            ? Object.entries(backup.table_counts)
                                .map(([table, count]) => `${table}: ${count}`)
                                .join(" · ")
                            : "—"}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <a
                          href={`/api/backup?id=${encodeURIComponent(backup.id)}`}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-panelElevated px-3 py-2 text-xs font-semibold text-inkSoft transition-colors hover:border-brand/50 hover:text-brand"
                        >
                          <Download className="h-4 w-4" />
                          Baixar
                        </a>
                        <Button
                          type="button"
                          variant="danger"
                          size="sm"
                          onClick={() => handleDeleteBackup(backup.id)}
                          disabled={deletingBackupId === backup.id}
                        >
                          {deletingBackupId === backup.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                          Remover
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="mt-6 border-danger/40 p-6 sm:p-8">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div className="flex items-start gap-3.5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-danger/10 text-danger">
                    <AlertTriangle className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-ink">Zona de Perigo</h2>
                    <p className="mt-1 text-sm text-inkSoft">
                      Formate todos os dados operacionais do sistema. Esta ação é
                      irreversível e exige um código de segurança enviado por
                      e-mail.
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="danger"
                  onClick={openResetModal}
                  className="shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                  Formatar todos os dados
                </Button>
              </div>
            </Card>
          </>
        )}

        {resetModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-modal-title"
          >
            <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-danger/40 bg-panel p-6 shadow-soft">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-danger/10 text-danger">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h3 id="reset-modal-title" className="text-lg font-bold text-ink">
                    Formatar todos os dados
                  </h3>
                  <p className="mt-1 text-sm text-inkSoft">
                    Esta operação apaga permanentemente os dados abaixo. Não é
                    possível recuperar sem um backup.
                  </p>
                </div>
              </div>

              {resetStep === "confirm" ? (
                <div className="mt-5 space-y-4">
                  <ul className="space-y-1.5 rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-inkSoft">
                    <li>• Lojas e respetivos tetos de orçamento</li>
                    <li>• Pedidos e todos os itens dos pedidos</li>
                    <li>• Trilha de auditoria</li>
                    <li>• Backups guardados no sistema</li>
                    <li>• Ficheiros PDF enviados</li>
                  </ul>

                  <p className="text-xs text-inkMuted">
                    As contas de utilizador e as palavras-passe são preservadas
                    para que continue a conseguir acessar o sistema.
                  </p>

                  <div className="rounded-xl border border-line bg-panelMuted/70 p-4">
                    <label className="flex items-start gap-3 text-sm text-inkSoft">
                      <input
                        type="checkbox"
                        checked={backupConfirmed}
                        onChange={(e) => setBackupConfirmed(e.target.checked)}
                        disabled={creatingResetBackup || sendingResetCode}
                        className="mt-0.5 h-4 w-4 accent-emerald-600"
                      />
                      <span>
                        Confirmo que criei e guardei uma cópia de segurança
                        (backup) completa do sistema.
                      </span>
                    </label>

                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleCreateResetBackup}
                      disabled={creatingResetBackup || sendingResetCode}
                      className="mt-3"
                    >
                      {creatingResetBackup ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Criando backup...
                        </>
                      ) : (
                        <>
                          <HardDriveDownload className="h-3.5 w-3.5" />
                          Criar e baixar backup agora
                        </>
                      )}
                    </Button>
                  </div>

                  <Field htmlFor="reset-phrase" label="Escreva FORMATAR para continuar:">
                    <Input
                      id="reset-phrase"
                      value={resetPhrase}
                      onChange={(e) => setResetPhrase(e.target.value)}
                      placeholder="FORMATAR"
                      autoComplete="off"
                      disabled={sendingResetCode}
                    />
                  </Field>

                  <div className="flex flex-col-reverse gap-2.5 pt-1 sm:flex-row sm:justify-end">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={closeResetModal}
                      disabled={sendingResetCode}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      onClick={handleSendResetCode}
                      disabled={
                        sendingResetCode ||
                        !backupConfirmed ||
                        resetPhrase.trim().toUpperCase() !== "FORMATAR"
                      }
                    >
                      {sendingResetCode ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Enviando código...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4" />
                          Enviar código por e-mail
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-5 space-y-4">
                  <div className="flex items-start gap-2.5 rounded-xl border border-line bg-panelMuted/70 p-4 text-sm text-inkSoft">
                    <Mail className="mt-0.5 h-4 w-4 shrink-0 text-inkMuted" />
                    <span>
                      Enviámos um código de 6 dígitos para{" "}
                      <strong className="text-ink">
                        {resetEmailHint ?? "o seu e-mail"}
                      </strong>
                      . O código expira em 10 minutos.
                    </span>
                  </div>

                  <Field htmlFor="reset-code" label="Código de segurança de 6 dígitos">
                    <Input
                      id="reset-code"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={resetCode}
                      onChange={(e) =>
                        setResetCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                      }
                      placeholder="000000"
                      disabled={executingReset}
                      className="text-center font-mono text-lg font-bold tracking-[0.35em]"
                    />
                  </Field>

                  <div className="flex flex-col-reverse gap-2.5 pt-1 sm:flex-row sm:items-center sm:justify-between">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setResetStep("confirm")}
                      disabled={executingReset}
                    >
                      Voltar
                    </Button>
                    <div className="flex flex-col gap-2.5 sm:flex-row">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={handleSendResetCode}
                        disabled={sendingResetCode || executingReset}
                      >
                        {sendingResetCode ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                        Reenviar código
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        onClick={handleExecuteReset}
                        disabled={executingReset || resetCode.length !== 6}
                      >
                        {executingReset ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Formatando...
                          </>
                        ) : (
                          <>
                            <Trash2 className="h-4 w-4" />
                            Formatar sistema agora
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
