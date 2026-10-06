import type { TokenScope, UserRole } from "@agendia/shared";
import type { FastifyRequest } from "fastify";
import { AppError, forbidden, unauthorized } from "./errors.ts";
import type { SessionUser } from "./session.ts";
import type { TenantContext } from "./tenant.ts";

/** preHandler que exige sesión y, si se indican, uno de los roles. */
export function requireRole(...roles: UserRole[]) {
  return async (req: FastifyRequest) => {
    if (!req.user) throw unauthorized();
    if (roles.length && !roles.includes(req.user.role)) throw forbidden();
  };
}

export function userOf(req: FastifyRequest): SessionUser {
  if (!req.user) throw unauthorized();
  return req.user;
}

export function tenantOf(req: FastifyRequest): TenantContext {
  if (!req.tenant) throw forbidden();
  return req.tenant;
}

/**
 * Las peticiones con token llevan permisos (scopes); las de sesión de navegador no los tienen y
 * pueden todo lo que permita su rol. Este preHandler exige el permiso solo a los tokens.
 */
export function requireScope(scope: TokenScope) {
  return async (req: FastifyRequest) => {
    if (req.scopes && !req.scopes.includes(scope)) {
      throw new AppError(403, "FORBIDDEN", `El token no tiene el permiso ${scope}`);
    }
  };
}

/** Rutas que solo admite una sesión de navegador: un token no puede gestionar tokens. */
export async function requireBrowserSession(req: FastifyRequest) {
  if (req.scopes) {
    throw new AppError(403, "FORBIDDEN", "Esta acción exige iniciar sesión en la web, no un token");
  }
}
