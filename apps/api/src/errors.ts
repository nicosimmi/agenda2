import type { ErrorCode } from "@agendia/shared";

/** Error de negocio con código y estado HTTP; el manejador global lo convierte al formato uniforme. */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;

  constructor(statusCode: number, code: ErrorCode, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export const unauthorized = () => new AppError(401, "UNAUTHORIZED", "Inicia sesión para continuar");
export const forbidden = () => new AppError(403, "FORBIDDEN", "No tienes permiso para esto");
export const notFound = (what = "Recurso") =>
  new AppError(404, "NOT_FOUND", `${what} no encontrado`);

/** Código de error de Postgres (23505, 23P01…), venga directo de pg o envuelto por Drizzle. */
export function pgErrorCode(error: unknown): string | undefined {
  const cause = (error as { cause?: { code?: string } }).cause;
  return cause?.code ?? (error as { code?: string }).code;
}
