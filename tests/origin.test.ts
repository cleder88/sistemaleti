import { describe, expect, it } from "vitest";
import { isSameOriginRequest } from "@/lib/security/origin";

function buildRequest(headers: Record<string, string>): Request {
  return new Request("https://app.example.com/api/orders", {
    method: "POST",
    headers,
  });
}

describe("isSameOriginRequest", () => {
  it("aceita requisições sem Origin", () => {
    expect(isSameOriginRequest(buildRequest({}))).toBe(true);
  });

  it("aceita a mesma origem", () => {
    expect(
      isSameOriginRequest(
        buildRequest({ origin: "https://app.example.com" })
      )
    ).toBe(true);
  });

  it("aceita origem que casa com x-forwarded-host", () => {
    expect(
      isSameOriginRequest(
        buildRequest({
          origin: "https://app.example.com",
          "x-forwarded-host": "app.example.com",
        })
      )
    ).toBe(true);
  });

  it("rejeita origem cruzada", () => {
    expect(
      isSameOriginRequest(buildRequest({ origin: "https://evil.example.com" }))
    ).toBe(false);
  });

  it("rejeita Origin malformado", () => {
    expect(isSameOriginRequest(buildRequest({ origin: "not-a-url" }))).toBe(
      false
    );
  });
});
