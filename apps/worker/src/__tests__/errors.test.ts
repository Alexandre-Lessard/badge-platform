import { describe, it, expect } from "vitest";
import {
  AppError,
  notFound,
  unauthorized,
  forbidden,
  badRequest,
  conflict,
  tooManyRequests,
} from "../utils/errors.js";

describe("AppError", () => {
  it("creates an error with statusCode, code, and message", () => {
    const err = new AppError(418, "TEAPOT", "I'm a teapot");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(418);
    expect(err.code).toBe("TEAPOT");
    expect(err.message).toBe("I'm a teapot");
    expect(err.name).toBe("AppError");
  });
});

describe("error helpers", () => {
  it("notFound returns 404", () => {
    const err = notFound("Item not found");
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe("NOT_FOUND");
    expect(err.message).toBe("Item not found");
  });

  it("notFound has default message", () => {
    const err = notFound();
    expect(err.message).toBe("Resource not found");
  });

  it("unauthorized returns 401", () => {
    const err = unauthorized("Bad token");
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe("UNAUTHORIZED");
  });

  it("forbidden returns 403", () => {
    const err = forbidden();
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe("FORBIDDEN");
  });

  it("badRequest returns 400", () => {
    const err = badRequest("Invalid input");
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe("BAD_REQUEST");
  });

  it("conflict returns 409", () => {
    const err = conflict("Already exists");
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe("CONFLICT");
  });

  it("tooManyRequests returns 429", () => {
    const err = tooManyRequests();
    expect(err.statusCode).toBe(429);
    expect(err.code).toBe("TOO_MANY_REQUESTS");
  });
});
