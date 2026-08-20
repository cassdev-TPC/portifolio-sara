export function getLoginErrorMessage(error: unknown) {
  const source = error && typeof error === "object" ? error as { message?: string; code?: string; status?: number } : {};
  const text = `${source.code ?? ""} ${source.message ?? ""}`.toLowerCase();
  if (/timeout|timed out|abort/.test(text)) return "O acesso demorou mais que o esperado. Tente novamente.";
  if (/network|fetch|connection|offline/.test(text)) return "Não foi possível conectar ao serviço de acesso. Verifique sua internet e tente novamente.";
  if (/email.*not.*confirmed|confirm/.test(text)) return "Confirme seu e-mail antes de entrar.";
  if (/too many|rate limit|over_request_rate_limit/.test(text) || source.status === 429) return "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.";
  if (/invalid.*login|invalid.*credential|email.*password/.test(text) || source.status === 400) return "E-mail ou senha inválidos.";
  if (/not configured|configuration|project.*not/.test(text)) return "O acesso administrativo ainda não está configurado.";
  if (/unavailable|503|paused|failed to fetch/.test(text) || source.status === 503) return "O serviço de acesso está temporariamente indisponível. Tente novamente mais tarde.";
  return "Não foi possível entrar agora. Tente novamente em instantes.";
}

export async function withTimeout<T>(promise: Promise<T>, milliseconds = 12000): Promise<T> {
  let timeoutId = 0;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error("timeout")), milliseconds);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    window.clearTimeout(timeoutId);
  }
}
