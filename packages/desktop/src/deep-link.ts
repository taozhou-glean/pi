const piDesktopProtocol = "pi:";
const piDesktopSessionHost = "session";

export function piDesktopSessionDeepLink(sessionId: string): string {
	const normalized = sessionId.trim();
	if (!normalized) throw new Error("A session ID is required to create a Pi Desktop link.");
	return `pi://${piDesktopSessionHost}/${encodeURIComponent(normalized)}`;
}

export function parsePiDesktopSessionDeepLink(value: string): string | undefined {
	try {
		const url = new URL(value);
		if (url.protocol !== piDesktopProtocol || url.hostname !== piDesktopSessionHost) return undefined;
		const segments = url.pathname.split("/").filter(Boolean);
		if (segments.length !== 1) return undefined;
		const sessionId = decodeURIComponent(segments[0]).trim();
		return sessionId || undefined;
	} catch {
		return undefined;
	}
}
