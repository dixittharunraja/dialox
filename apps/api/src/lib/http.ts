import type { FastifyRequest } from 'fastify';
import type { z } from 'zod';
import { getUser } from '../services/accounts';
import { userIdForToken } from '../services/sessions';
import { HttpError } from './http-error';

export function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data ?? {});
  if (!result.success) {
    const issue = result.error.issues[0];
    const field = issue.path.join('.');
    throw new HttpError(400, 'invalid_input', field ? `${field}: ${issue.message}` : issue.message);
  }
  return result.data;
}

export function bearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice(7) : null;
}

export async function currentUser(request: FastifyRequest) {
  const token = bearerToken(request);
  const userId = token ? await userIdForToken(token) : null;
  if (!userId) throw new HttpError(401, 'unauthorized', 'Please sign in');
  return getUser(userId);
}

export const idParam = (request: FastifyRequest) => (request.params as { id: string }).id;
