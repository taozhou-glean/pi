import { describe, expect, it } from "vitest";

import { parsePiDesktopSessionDeepLink, piDesktopSessionDeepLink } from "./deep-link";

describe("Pi Desktop session deep links", () => {
	it("round-trips a session ID through the Pi protocol", () => {
		const link = piDesktopSessionDeepLink("session/with spaces");

		expect(link).toBe("pi://session/session%2Fwith%20spaces");
		expect(parsePiDesktopSessionDeepLink(link)).toBe("session/with spaces");
	});

	it.each(["https://session/id", "pi://app/session/id", "pi://session/id/extra", "pi://session/", "not a url"])(
		"rejects unrelated or malformed links: %s",
		(link) => {
			expect(parsePiDesktopSessionDeepLink(link)).toBeUndefined();
		},
	);

	it("rejects an empty session ID", () => {
		expect(() => piDesktopSessionDeepLink("  ")).toThrow("A session ID is required");
	});
});
