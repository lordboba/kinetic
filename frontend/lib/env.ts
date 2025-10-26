"use client";

const rawBackendEndpoint =
  process.env.NEXT_PUBLIC_BACKEND_ENDPOINT ?? process.env.BACKEND_ENDPOINT ?? "";

const normalizedBackendEndpoint =
  rawBackendEndpoint.length > 0 && !rawBackendEndpoint.endsWith("/")
    ? `${rawBackendEndpoint}/`
    : rawBackendEndpoint;

export function getBackendEndpoint(): string {
  if (!normalizedBackendEndpoint) {
    throw new Error(
      "Missing BACKEND_ENDPOINT. Set BACKEND_ENDPOINT (or NEXT_PUBLIC_BACKEND_ENDPOINT) in your environment.",
    );
  }
  return normalizedBackendEndpoint;
}
