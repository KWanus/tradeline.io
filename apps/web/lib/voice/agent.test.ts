import { describe, expect, it } from "vitest";

import { handleTurn, parseSpokenEmail, type VoiceSlots } from "./agent";

describe("parseSpokenEmail", () => {
  it("normalizes spoken addresses", () => {
    expect(parseSpokenEmail("pat at garnet dot com")).toBe("pat@garnet.com");
    expect(parseSpokenEmail("jane dot doe at acme dot io")).toBe("jane.doe@acme.io");
  });
  it("handles a literal address", () => {
    expect(parseSpokenEmail("it's deals@acme.com")).toBe("deals@acme.com");
  });
  it("returns null when there's no address", () => {
    expect(parseSpokenEmail("no idea")).toBeNull();
  });
});

describe("handleTurn flow", () => {
  it("fills segment then asks for state", () => {
    const r = handleTurn({}, "I'm a debt buyer");
    expect(r.kind).toBe("ask");
    if (r.kind !== "ask") return;
    expect(r.slots.segment).toBe("debt-buyer");
    expect(r.say.toLowerCase()).toContain("state");
  });

  it("parses state, then offers text/email", () => {
    const r = handleTurn({ segment: "broker" }, "we're in Arizona");
    expect(r.kind).toBe("ask");
    if (r.kind !== "ask") return;
    expect(r.slots.state).toBe("AZ");
  });

  it("completes on a text consent", () => {
    const slots: VoiceSlots = { segment: "broker", state: "AZ" };
    const r = handleTurn(slots, "yes, text me");
    expect(r.kind).toBe("done");
    if (r.kind !== "done") return;
    expect(r.slots.choice).toBe("text");
  });

  it("routes to email capture, then completes with the parsed email", () => {
    const slots: VoiceSlots = { segment: "fund", state: "TX" };
    const ask = handleTurn(slots, "email me instead");
    expect(ask.kind).toBe("ask");
    if (ask.kind !== "ask") return;
    expect(ask.slots.choice).toBe("email");

    const done = handleTurn(ask.slots, "pat at garnet dot com");
    expect(done.kind).toBe("done");
    if (done.kind !== "done") return;
    expect(done.slots.email).toBe("pat@garnet.com");
  });

  it("treats a clear no as decline", () => {
    const r = handleTurn({ segment: "broker", state: "AZ" }, "no thanks");
    expect(r.kind).toBe("done");
    if (r.kind !== "done") return;
    expect(r.slots.choice).toBe("decline");
  });
});
