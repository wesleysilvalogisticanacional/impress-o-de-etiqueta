import { describe, expect, it } from "vitest";

import { extrairEmail } from "@/lib/auth/oidc.server";

describe("extrairEmail (ordem de claims OIDC)", () => {
  it("prioriza email sobre mail, upn e preferred_username", () => {
    expect(extrairEmail({ email: "a@x.com", mail: "b@x.com", upn: "c@x.com" })).toBe("a@x.com");
  });
  it("usa upn quando email e mail estão ausentes", () => {
    expect(extrairEmail({ upn: "c@x.com", preferred_username: "d@x.com" })).toBe("c@x.com");
  });
  it("usa sub só quando contém @", () => {
    expect(extrairEmail({ sub: "e@x.com" })).toBe("e@x.com");
    expect(extrairEmail({ sub: "123456" })).toBeNull();
  });
});
