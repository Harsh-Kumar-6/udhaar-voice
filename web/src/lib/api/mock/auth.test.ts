import { describe, expect, it } from "vitest";
import { DEMO_EMAIL, DEMO_PASSWORD, DEMO_PHONE } from "./seed";
import { mockApi } from "./index";
import { resetDb } from "./store";

/**
 * These tests touch the real localStorage-backed mock. They reset the DB before each
 * assertion so the sequence of users / sessions is deterministic.
 */

describe("mock auth", () => {
  it("seeds with no active session", async () => {
    resetDb();
    expect(await mockApi.getSession()).toBeNull();
  });

  it("signs the demo user in by phone and out", async () => {
    resetDb();
    const session = await mockApi.signIn({ identifier: DEMO_PHONE, password: DEMO_PASSWORD });
    expect(session.user.phone).toBe("+919000000001");
    expect(session.shop.ownerUserId).toBe(session.user.id);
    const current = await mockApi.getSession();
    expect(current?.user.id).toBe(session.user.id);
    await mockApi.signOut();
    expect(await mockApi.getSession()).toBeNull();
  });

  it("signs the demo user in by email", async () => {
    resetDb();
    const session = await mockApi.signIn({ identifier: DEMO_EMAIL.toUpperCase(), password: DEMO_PASSWORD });
    expect(session.user.email).toBe(DEMO_EMAIL);
  });

  it("rejects a wrong password", async () => {
    resetDb();
    await expect(mockApi.signIn({ identifier: DEMO_PHONE, password: "nope" })).rejects.toThrow(/wrong/i);
    expect(await mockApi.getSession()).toBeNull();
  });

  it("rejects a phone number that is not 10 digits", async () => {
    resetDb();
    await expect(mockApi.signIn({ identifier: "123", password: DEMO_PASSWORD })).rejects.toThrow(/10-digit|email/i);
  });

  it("rejects an invalid email", async () => {
    resetDb();
    await expect(mockApi.signIn({ identifier: "not-an-email@", password: DEMO_PASSWORD })).rejects.toThrow(/valid email/i);
  });

  it("signup creates a user with phone and optional email, replaces the shop owner, and signs in", async () => {
    resetDb();
    const session = await mockApi.signUp({
      phone: "9811112222",
      email: "Rina@Shop.co",
      password: "secret12",
      ownerName: "Rina Devi",
      shopName: "Rina Stores",
      language: "hi",
    });
    expect(session.user.phone).toBe("+919811112222");
    expect(session.user.email).toBe("Rina@Shop.co");
    expect(session.user.name).toBe("Rina Devi");
    expect(session.shop.name).toBe("Rina Stores");
    expect(session.shop.ownerUserId).toBe(session.user.id);
    expect(await mockApi.getSession()).not.toBeNull();
  });

  it("signup works without an email", async () => {
    resetDb();
    const session = await mockApi.signUp({
      phone: "9811112233",
      password: "secret12",
      ownerName: "No Email",
      shopName: "No Email Stores",
      language: "en",
    });
    expect(session.user.email).toBeUndefined();
  });

  it("refuses signup when the phone is already registered", async () => {
    resetDb();
    await expect(
      mockApi.signUp({ phone: DEMO_PHONE, password: "another1", ownerName: "A", shopName: "B", language: "en" }),
    ).rejects.toThrow(/already registered/i);
  });

  it("refuses signup when the email is already registered", async () => {
    resetDb();
    await expect(
      mockApi.signUp({ phone: "9811112244", email: DEMO_EMAIL, password: "another1", ownerName: "A", shopName: "B", language: "en" }),
    ).rejects.toThrow(/email is already registered/i);
  });

  it("refuses a password shorter than 6 characters", async () => {
    resetDb();
    await expect(
      mockApi.signUp({ phone: "9811112223", password: "abc", ownerName: "A", shopName: "B", language: "en" }),
    ).rejects.toThrow(/6 characters/i);
  });
});
