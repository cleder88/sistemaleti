interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export type SendEmailResult =
  | { ok: true; provider: "resend" | "brevo" }
  | { ok: false; error: string };

const EMAIL_TIMEOUT_MS = 10000;

function parseFromAddress(raw: string | undefined) {
  const value = (raw ?? "").trim();
  const match = value.match(/^(.*)<([^>]+)>$/);

  if (match) {
    return {
      name: match[1].trim().replace(/^"|"$/g, "") || "Sistema LETI",
      email: match[2].trim(),
    };
  }

  return {
    name: process.env.EMAIL_FROM_NAME?.trim() || "Sistema LETI",
    email: value,
  };
}

function getResendKey(): string | null {
  const key = process.env.RESEND_API_KEY?.trim();
  return key ? key : null;
}

function getBrevoKey(): string | null {
  const key = process.env.BREVO_API_KEY?.trim();
  return key ? key : null;
}

export function isEmailConfigured(): boolean {
  return Boolean(getResendKey() || getBrevoKey());
}

async function sendWithResend(
  apiKey: string,
  input: SendEmailInput
): Promise<SendEmailResult> {
  const from = parseFromAddress(
    process.env.EMAIL_FROM || "Sistema LETI <onboarding@resend.dev>"
  );

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${from.name} <${from.email}>`,
      to: [input.to],
      subject: input.subject,
      text: input.text,
      html: input.html,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(EMAIL_TIMEOUT_MS),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    return {
      ok: false,
      error: `Falha do provedor Resend (${response.status}). ${detail}`.trim(),
    };
  }

  return { ok: true, provider: "resend" };
}

async function sendWithBrevo(
  apiKey: string,
  input: SendEmailInput
): Promise<SendEmailResult> {
  const from = parseFromAddress(process.env.EMAIL_FROM);

  if (!from.email) {
    return {
      ok: false,
      error: "Configure EMAIL_FROM com o endereço remetente para usar o Brevo.",
    };
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender: { name: from.name, email: from.email },
      to: [{ email: input.to }],
      subject: input.subject,
      textContent: input.text,
      htmlContent: input.html,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(EMAIL_TIMEOUT_MS),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    return {
      ok: false,
      error: `Falha do provedor Brevo (${response.status}). ${detail}`.trim(),
    };
  }

  return { ok: true, provider: "brevo" };
}

/**
 * Envia um e-mail transacional usando Resend ou Brevo (ambos via HTTP, sem
 * dependências adicionais). Configure RESEND_API_KEY ou BREVO_API_KEY.
 */
export async function sendEmail(
  input: SendEmailInput
): Promise<SendEmailResult> {
  const resendKey = getResendKey();
  if (resendKey) {
    try {
      return await sendWithResend(resendKey, input);
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error
            ? `Erro ao contactar o Resend: ${error.message}`
            : "Erro ao contactar o Resend.",
      };
    }
  }

  const brevoKey = getBrevoKey();
  if (brevoKey) {
    try {
      return await sendWithBrevo(brevoKey, input);
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error
            ? `Erro ao contactar o Brevo: ${error.message}`
            : "Erro ao contactar o Brevo.",
      };
    }
  }

  return {
    ok: false,
    error:
      "Nenhum provedor de e-mail configurado. Defina RESEND_API_KEY ou BREVO_API_KEY.",
  };
}
