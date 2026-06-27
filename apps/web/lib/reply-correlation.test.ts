import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { bankKeyFromReplyAddress, replyAddressFor } from "./reply-correlation";

describe("replyAddressFor", () => {
  const orig = process.env.REPLY_INBOUND_DOMAIN;
  afterEach(() => {
    if (orig === undefined) delete process.env.REPLY_INBOUND_DOMAIN;
    else process.env.REPLY_INBOUND_DOMAIN = orig;
  });

  it("builds a plus-tagged address when the domain is set", () => {
    process.env.REPLY_INBOUND_DOMAIN = "reply.tradeline.io";
    expect(replyAddressFor("g_abc123", "me@x.com")).toBe(
      "g_abc123+reply@reply.tradeline.io"
    );
  });

  it("falls back to the operator address without a domain", () => {
    delete process.env.REPLY_INBOUND_DOMAIN;
    expect(replyAddressFor("g_abc123", "me@x.com")).toBe("me@x.com");
  });

  it("returns undefined with neither", () => {
    delete process.env.REPLY_INBOUND_DOMAIN;
    expect(replyAddressFor(undefined, undefined)).toBeUndefined();
  });
});

describe("bankKeyFromReplyAddress (inverse)", () => {
  it("recovers a growth lead id", () => {
    expect(bankKeyFromReplyAddress("g_abc123+reply@reply.tradeline.io")).toBe(
      "g_abc123"
    );
  });
  it("preserves ticker case so correlation is exact", () => {
    expect(bankKeyFromReplyAddress("WAL+reply@x.com")).toBe("WAL");
  });
  it("handles a Name <addr> wrapper and arrays", () => {
    expect(bankKeyFromReplyAddress("Pat <g_x+reply@x.com>")).toBe("g_x");
    expect(bankKeyFromReplyAddress(["g_y+reply@x.com"])).toBe("g_y");
  });
  it("round-trips with replyAddressFor", () => {
    process.env.REPLY_INBOUND_DOMAIN = "reply.tradeline.io";
    const addr = replyAddressFor("g_round1", "me@x.com")!;
    expect(bankKeyFromReplyAddress(addr)).toBe("g_round1");
    delete process.env.REPLY_INBOUND_DOMAIN;
  });
  it("returns undefined when there's no +reply tag", () => {
    expect(bankKeyFromReplyAddress("hello@x.com")).toBeUndefined();
    expect(bankKeyFromReplyAddress(undefined)).toBeUndefined();
  });
});
