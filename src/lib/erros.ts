export class HttpError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

/** Falha de comunicação com serviços externos (ANA / Open-Meteo). */
export class ServicoExternoError extends HttpError {
  constructor(message: string) {
    super(message, 502);
    this.name = "ServicoExternoError";
  }
}

export function mensagemDeErro(e: unknown): string {
  if (e instanceof Error) {
    if (e.name === "TimeoutError" || e.name === "AbortError") return "tempo de resposta esgotado";
    const causa = (e as Error & { cause?: unknown }).cause;
    if (causa instanceof Error && causa.message) return `${e.message} (${causa.message})`;
    return e.message;
  }
  return String(e);
}

export function respostaDeErro(e: unknown): Response {
  if (e instanceof HttpError) {
    return Response.json({ erro: e.message }, { status: e.status });
  }
  console.error("[erro inesperado]", e);
  return Response.json({ erro: "Erro interno inesperado. Tente novamente." }, { status: 500 });
}
