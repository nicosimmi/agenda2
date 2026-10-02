import type { UserRole } from "@agendia/shared";
import type { FastifyRequest } from "fastify";
import { forbidden, unauthorized } from "./errors.ts";
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
