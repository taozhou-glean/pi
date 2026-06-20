import type { ParsedDiff } from "./diff-parser";

export const queuedPromptEntryType = "cowork_queued_prompt";
export const turnDiffEntryType = "cowork_turn_diff";
export const responseFeedbackEntryType = "cowork_response_feedback";

export type ResponseFeedbackRating = "positive" | "negative";

export interface PersistedResponseFeedback {
	entryId: string;
	rating: ResponseFeedbackRating | null;
}

export interface PersistedPromptImage {
	data: string;
	mimeType: string;
	type: "image";
}

export interface PersistedQueuedPrompt {
	createdAt: number;
	id: string;
	images?: PersistedPromptImage[];
	text: string;
}

export type QueuedPromptEntry = { action: "enqueue"; prompt: PersistedQueuedPrompt } | { action: "remove"; id: string };

interface SessionEntryLike {
	customType?: string;
	data?: unknown;
	id?: unknown;
	message?: unknown;
	type: string;
}

export function persistedMessageEntryIds(entries: SessionEntryLike[]): WeakMap<object, string> {
	const entryIds = new WeakMap<object, string>();
	for (const entry of entries) {
		if (
			entry.type !== "message" ||
			typeof entry.id !== "string" ||
			!entry.message ||
			typeof entry.message !== "object"
		) {
			continue;
		}
		entryIds.set(entry.message, entry.id);
	}
	return entryIds;
}

export function replayResponseFeedback(entries: SessionEntryLike[]): Record<string, ResponseFeedbackRating> {
	const feedback: Record<string, ResponseFeedbackRating> = {};
	for (const entry of entries) {
		if (entry.type !== "custom" || entry.customType !== responseFeedbackEntryType) continue;
		const data = entry.data as Partial<PersistedResponseFeedback> | undefined;
		if (typeof data?.entryId !== "string" || !data.entryId) continue;
		if (data.rating === null) {
			delete feedback[data.entryId];
		} else if (data.rating === "positive" || data.rating === "negative") {
			feedback[data.entryId] = data.rating;
		}
	}
	return feedback;
}

function normalizePrompt(value: unknown): PersistedQueuedPrompt | undefined {
	if (!value || typeof value !== "object") return undefined;
	const candidate = value as Partial<PersistedQueuedPrompt>;
	if (
		typeof candidate.id !== "string" ||
		!candidate.id ||
		typeof candidate.text !== "string" ||
		typeof candidate.createdAt !== "number" ||
		!Number.isFinite(candidate.createdAt)
	) {
		return undefined;
	}
	const images = Array.isArray(candidate.images)
		? candidate.images.filter(
				(image): image is PersistedPromptImage =>
					Boolean(image) &&
					image.type === "image" &&
					typeof image.data === "string" &&
					typeof image.mimeType === "string",
			)
		: undefined;
	return {
		createdAt: candidate.createdAt,
		id: candidate.id,
		images: images?.length ? images : undefined,
		text: candidate.text,
	};
}

export function replayQueuedPrompts(entries: SessionEntryLike[]): PersistedQueuedPrompt[] {
	const prompts = new Map<string, PersistedQueuedPrompt>();
	for (const entry of entries) {
		if (entry.type !== "custom" || entry.customType !== queuedPromptEntryType) continue;
		const data = entry.data as Partial<QueuedPromptEntry> | undefined;
		if (data?.action === "enqueue") {
			const prompt = normalizePrompt(data.prompt);
			if (prompt) prompts.set(prompt.id, prompt);
		} else if (data?.action === "remove" && typeof data.id === "string") {
			prompts.delete(data.id);
		}
	}
	return Array.from(prompts.values());
}

function isParsedDiff(value: unknown): value is ParsedDiff {
	if (!value || typeof value !== "object") return false;
	const candidate = value as Partial<ParsedDiff>;
	return (
		Array.isArray(candidate.files) &&
		candidate.files.every(
			(file) =>
				Boolean(file) &&
				typeof file === "object" &&
				typeof (file as { newPath?: unknown }).newPath === "string" &&
				typeof (file as { oldPath?: unknown }).oldPath === "string" &&
				typeof (file as { additions?: unknown }).additions === "number" &&
				typeof (file as { deletions?: unknown }).deletions === "number" &&
				Array.isArray((file as { hunks?: unknown }).hunks),
		) &&
		typeof candidate.totalAdditions === "number" &&
		typeof candidate.totalDeletions === "number"
	);
}

export function latestTurnDiff(entries: SessionEntryLike[]): ParsedDiff | undefined {
	let latest: ParsedDiff | undefined;
	for (const entry of entries) {
		if (entry.type !== "custom" || entry.customType !== turnDiffEntryType) continue;
		if (isParsedDiff(entry.data)) latest = entry.data;
	}
	return latest;
}
