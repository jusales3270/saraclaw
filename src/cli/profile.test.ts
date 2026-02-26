import path from "node:path";
import { describe, expect, it } from "vitest";
import { formatCliCommand } from "./command-format.js";
import { applyCliProfileEnv, parseCliProfileArgs } from "./profile.js";

describe("parseCliProfileArgs", () => {
  it("leaves gateway --dev for subcommands", () => {
    const res = parseCliProfileArgs([
      "node",
      "openclaw",
      "gateway",
      "--dev",
      "--allow-unconfigured",
    ]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBeNull();
    expect(res.argv).toEqual(["node", "openclaw", "gateway", "--dev", "--allow-unconfigured"]);
  });

  it("still accepts global --dev before subcommand", () => {
    const res = parseCliProfileArgs(["node", "openclaw", "--dev", "gateway"]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBe("dev");
    expect(res.argv).toEqual(["node", "openclaw", "gateway"]);
  });

  it("parses --profile value and strips it", () => {
    const res = parseCliProfileArgs(["node", "openclaw", "--profile", "work", "status"]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBe("work");
    expect(res.argv).toEqual(["node", "openclaw", "status"]);
  });

  it("rejects missing profile value", () => {
    const res = parseCliProfileArgs(["node", "openclaw", "--profile"]);
    expect(res.ok).toBe(false);
  });

  it("rejects combining --dev with --profile (dev first)", () => {
    const res = parseCliProfileArgs(["node", "openclaw", "--dev", "--profile", "work", "status"]);
    expect(res.ok).toBe(false);
  });

  it("rejects combining --dev with --profile (profile first)", () => {
    const res = parseCliProfileArgs(["node", "openclaw", "--profile", "work", "--dev", "status"]);
    expect(res.ok).toBe(false);
  });
});

describe("applyCliProfileEnv", () => {
  it("fills env defaults for dev profile", () => {
    const env: Record<string, string | undefined> = {};
    applyCliProfileEnv({
      profile: "dev",
      env,
      homedir: () => "/home/peter",
    });
    const expectedStateDir = path.join("/home/peter", ".openclaw-dev");
    expect(env.SARACLAW_PROFILE).toBe("dev");
    expect(env.SARACLAW_STATE_DIR).toBe(expectedStateDir);
    expect(env.SARACLAW_CONFIG_PATH).toBe(path.join(expectedStateDir, "openclaw.json"));
    expect(env.SARACLAW_GATEWAY_PORT).toBe("19001");
  });

  it("does not override explicit env values", () => {
    const env: Record<string, string | undefined> = {
      SARACLAW_STATE_DIR: "/custom",
      SARACLAW_GATEWAY_PORT: "19099",
    };
    applyCliProfileEnv({
      profile: "dev",
      env,
      homedir: () => "/home/peter",
    });
    expect(env.SARACLAW_STATE_DIR).toBe("/custom");
    expect(env.SARACLAW_GATEWAY_PORT).toBe("19099");
    expect(env.SARACLAW_CONFIG_PATH).toBe(path.join("/custom", "openclaw.json"));
  });
});

describe("formatCliCommand", () => {
  it("returns command unchanged when no profile is set", () => {
    expect(formatCliCommand("openclaw doctor --fix", {})).toBe("openclaw doctor --fix");
  });

  it("returns command unchanged when profile is default", () => {
    expect(formatCliCommand("openclaw doctor --fix", { SARACLAW_PROFILE: "default" })).toBe(
      "openclaw doctor --fix",
    );
  });

  it("returns command unchanged when profile is Default (case-insensitive)", () => {
    expect(formatCliCommand("openclaw doctor --fix", { SARACLAW_PROFILE: "Default" })).toBe(
      "openclaw doctor --fix",
    );
  });

  it("returns command unchanged when profile is invalid", () => {
    expect(formatCliCommand("openclaw doctor --fix", { SARACLAW_PROFILE: "bad profile" })).toBe(
      "openclaw doctor --fix",
    );
  });

  it("returns command unchanged when --profile is already present", () => {
    expect(
      formatCliCommand("openclaw --profile work doctor --fix", { SARACLAW_PROFILE: "work" }),
    ).toBe("openclaw --profile work doctor --fix");
  });

  it("returns command unchanged when --dev is already present", () => {
    expect(formatCliCommand("openclaw --dev doctor", { SARACLAW_PROFILE: "dev" })).toBe(
      "openclaw --dev doctor",
    );
  });

  it("inserts --profile flag when profile is set", () => {
    expect(formatCliCommand("openclaw doctor --fix", { SARACLAW_PROFILE: "work" })).toBe(
      "openclaw --profile work doctor --fix",
    );
  });

  it("trims whitespace from profile", () => {
    expect(formatCliCommand("openclaw doctor --fix", { SARACLAW_PROFILE: "  jbopenclaw  " })).toBe(
      "openclaw --profile jbopenclaw doctor --fix",
    );
  });

  it("handles command with no args after openclaw", () => {
    expect(formatCliCommand("openclaw", { SARACLAW_PROFILE: "test" })).toBe(
      "openclaw --profile test",
    );
  });

  it("handles pnpm wrapper", () => {
    expect(formatCliCommand("pnpm openclaw doctor", { SARACLAW_PROFILE: "work" })).toBe(
      "pnpm openclaw --profile work doctor",
    );
  });
});
