import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { TOO_MANY_REQUESTS, INTERNAL_ERROR } from "@badge/shared";
import { AppError } from "../utils/errors.js";

export function errorHandler(
  error: FastifyError,
  _request: FastifyRequest,
  reply: FastifyReply,
) {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      error: { code: error.code, message: error.message },
    });
  }

  // Zod validation errors
  if (error instanceof ZodError) {
    const messages = error.issues.map((i) => i.message);
    return reply.status(400).send({
      error: {
        code: "VALIDATION_ERROR",
        message: messages.join(", "),
        details: error.issues,
      },
    });
  }

  // Fastify validation errors
  if (error.validation) {
    return reply.status(400).send({
      error: {
        code: "VALIDATION_ERROR",
        message: error.message,
      },
    });
  }

  // Rate limit errors
  if (error.statusCode === 429) {
    return reply.status(429).send({
      error: {
        code: TOO_MANY_REQUESTS,
        message: "Too many requests. Please try again later.",
      },
    });
  }

  // Unexpected errors — log full, return generic
  _request.log.error(error);
  return reply.status(500).send({
    error: {
      code: INTERNAL_ERROR,
      message: "Internal server error",
    },
  });
}
