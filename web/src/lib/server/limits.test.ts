import { describe, expect, it } from "vitest";
import { isLimited, LIMITS, signInKeys, signUpKeys } from "./limits";

describe("sign-in limits", () => {
  it("counts an attempt against the account and the network address", () => {
    expect(signInKeys(" Gopal@Example.com ", "1.2.3.4")).toEqual([
      { key: "account:gopal@example.com", max: LIMITS.account },
      { key: "ip:1.2.3.4", max: LIMITS.network },
    ]);
    expect(signInKeys("+919830012345", undefined)).toHaveLength(1);
    expect(signUpKeys(undefined)).toEqual([]);
  });

  it("stops at the limit for either key", () => {
    const keys = signInKeys("+919830012345", "1.2.3.4");
    expect(isLimited(new Map([["account:+919830012345", LIMITS.account - 1]]), keys)).toBe(false);
    expect(isLimited(new Map([["account:+919830012345", LIMITS.account]]), keys)).toBe(true);
    expect(isLimited(new Map([["ip:1.2.3.4", LIMITS.network]]), keys)).toBe(true);
  });
});
