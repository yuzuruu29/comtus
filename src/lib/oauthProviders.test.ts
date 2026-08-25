import { describe, expect, it } from "vitest";
import { classifyDevicePoll, jwtClaims, parseGrantInput } from "./oauthProviders";

describe("parseGrantInput", () => {
  it("accepts a raw authorization code", () => {
    expect(parseGrantInput("AbCdEf1234567890_-xyz")).toEqual({
      code: "AbCdEf1234567890_-xyz",
      state: undefined,
    });
  });

  it("accepts Claude's manual-copy code#state format", () => {
    expect(parseGrantInput("codepart123#statepart456")).toEqual({
      code: "codepart123",
      state: "statepart456",
    });
  });

  it("accepts a full redirected loopback URL (Codex)", () => {
    const url = "http://localhost:1455/auth/callback?code=xyz789&state=st1";
    expect(parseGrantInput(url)).toEqual({ code: "xyz789", state: "st1" });
  });

  it("accepts a bare query string", () => {
    expect(parseGrantInput("?code=query123&state=s2")).toEqual({
      code: "query123",
      state: "s2",
    });
  });

  it("returns null for prose or empty input", () => {
    expect(parseGrantInput("")).toBeNull();
    expect(parseGrantInput("   ")).toBeNull();
    expect(parseGrantInput("I approved access but I don't see a code")).toBeNull();
  });

  it("returns null for a URL without a code parameter", () => {
    expect(parseGrantInput("http://localhost:1455/auth/callback?state=only")).toBeNull();
  });
});

describe("jwtClaims", () => {
  const b64url = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  it("reads chatgpt_account_id and email from a token payload", () => {
    const payload = { chatgpt_account_id: "acc-123", email: "student@example.com" };
    const token = `${b64url({ alg: "none" })}.${b64url(payload)}.sig`;
    expect(jwtClaims(token)).toMatchObject({
      chatgpt_account_id: "acc-123",
      email: "student@example.com",
    });
  });

  it("returns empty for malformed tokens instead of throwing", () => {
    expect(jwtClaims("")).toEqual({});
    expect(jwtClaims("not-a-jwt")).toEqual({});
    expect(jwtClaims("aa.bbb.ccc")).toEqual({});
  });
});

describe("classifyDevicePoll", () => {
  it("sees an exchangeable code on a 200 with OpenAI's own verifier", () => {
    expect(
      classifyDevicePoll(200, {
        authorization_code: "AbCdEf123456ghIJ7890",
        code_verifier: "v-0123456789abcdef0123456789abcdef",
      }),
    ).toBe("code");
    // missing verifier or short junk codes are not terminal
    expect(classifyDevicePoll(200, { authorization_code: "x" })).toBe("unknown");
    expect(classifyDevicePoll(200, { authorization_code: "AbCdEf123456" })).toBe("unknown");
  });

  it("keeps polling while authorization is pending (403/404 per OpenAI)", () => {
    expect(classifyDevicePoll(403, {})).toBe("pending");
    expect(classifyDevicePoll(404, {})).toBe("pending");
    expect(
      classifyDevicePoll(400, {
        error: { code: "deviceauth_authorization_pending", message: "pending" },
      }),
    ).toBe("pending");
  });

  it("stops on expired or denied codes", () => {
    expect(classifyDevicePoll(400, { error: { code: "deviceauth_expired" } })).toBe("expired");
    expect(classifyDevicePoll(400, { error: { code: "access_denied" } })).toBe("expired");
  });

  it("flags anything else as unknown", () => {
    expect(classifyDevicePoll(200, {})).toBe("unknown");
    expect(classifyDevicePoll(400, {})).toBe("unknown");
    expect(classifyDevicePoll(400, { error: { message: "boom" } })).toBe("unknown");
  });
});
