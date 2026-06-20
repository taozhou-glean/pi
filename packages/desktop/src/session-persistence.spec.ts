import { describe, expect, it } from "vitest";

import {
	latestTurnDiff,
	persistedMessageEntryIds,
	queuedPromptEntryType,
	replayQueuedPrompts,
	replayResponseFeedback,
	responseFeedbackEntryType,
	turnDiffEntryType,
} from "./session-persistence";

const enqueue = (id: string, text: string, createdAt: number) => ({
	customType: queuedPromptEntryType,
	data: { action: "enqueue", prompt: { createdAt, id, text } },
	type: "custom",
});

describe("replayQueuedPrompts", () => {
	it("restores pending prompts in FIFO order", () => {
		expect(replayQueuedPrompts([enqueue("first", "one", 1), enqueue("second", "two", 2)])).toEqual([
			{ createdAt: 1, id: "first", text: "one" },
			{ createdAt: 2, id: "second", text: "two" },
		]);
	});

	it("applies removal entries without disturbing later prompts", () => {
		expect(
			replayQueuedPrompts([
				enqueue("first", "one", 1),
				enqueue("second", "two", 2),
				{ customType: queuedPromptEntryType, data: { action: "remove", id: "first" }, type: "custom" },
			]),
		).toEqual([{ createdAt: 2, id: "second", text: "two" }]);
	});

	it("keeps the latest queued prompt state for a reused ID", () => {
		expect(replayQueuedPrompts([enqueue("same", "old", 1), enqueue("same", "new", 2)])).toEqual([
			{ createdAt: 2, id: "same", text: "new" },
		]);
	});

	it("ignores unrelated and malformed session entries", () => {
		expect(
			replayQueuedPrompts([
				{ data: enqueue("ignored", "ignored", 1), type: "message" },
				{ customType: "other", data: enqueue("ignored", "ignored", 1), type: "custom" },
				{ customType: queuedPromptEntryType, data: { action: "enqueue", prompt: { id: "bad" } }, type: "custom" },
				enqueue("valid", "kept", 3),
			]),
		).toEqual([{ createdAt: 3, id: "valid", text: "kept" }]);
	});
});

describe("persistedMessageEntryIds", () => {
	it("maps message identity to its append-only session entry", () => {
		const userMessage = { content: "hello", role: "user" };
		const assistantMessage = { content: "hi", role: "assistant" };
		const ids = persistedMessageEntryIds([
			{ id: "user-entry", message: userMessage, type: "message" },
			{ id: "assistant-entry", message: assistantMessage, type: "message" },
			{ id: "ignored", message: {}, type: "custom" },
		]);

		expect(ids.get(userMessage)).toBe("user-entry");
		expect(ids.get(assistantMessage)).toBe("assistant-entry");
	});

	it("ignores malformed entries", () => {
		const ids = persistedMessageEntryIds([
			{ id: 1, message: {}, type: "message" },
			{ id: "missing-message", type: "message" },
		]);

		expect(ids.get({})).toBeUndefined();
	});
});

describe("replayResponseFeedback", () => {
	it("restores the latest rating for each assistant entry", () => {
		expect(
			replayResponseFeedback([
				{
					customType: responseFeedbackEntryType,
					data: { entryId: "first", rating: "negative" },
					type: "custom",
				},
				{
					customType: responseFeedbackEntryType,
					data: { entryId: "second", rating: "positive" },
					type: "custom",
				},
				{
					customType: responseFeedbackEntryType,
					data: { entryId: "first", rating: "positive" },
					type: "custom",
				},
			]),
		).toEqual({ first: "positive", second: "positive" });
	});

	it("clears a rating and ignores malformed entries", () => {
		expect(
			replayResponseFeedback([
				{
					customType: responseFeedbackEntryType,
					data: { entryId: "answer", rating: "positive" },
					type: "custom",
				},
				{
					customType: responseFeedbackEntryType,
					data: { entryId: "answer", rating: null },
					type: "custom",
				},
				{ customType: responseFeedbackEntryType, data: { entryId: "", rating: "negative" }, type: "custom" },
			]),
		).toEqual({});
	});
});

describe("latestTurnDiff", () => {
	it("restores the latest valid turn artifact", () => {
		const first = { files: [], totalAdditions: 0, totalDeletions: 0 };
		const latest = {
			files: [
				{
					additions: 2,
					deletions: 1,
					hunks: [],
					newPath: "src/new.ts",
					oldPath: "src/old.ts",
					status: "renamed" as const,
				},
			],
			totalAdditions: 2,
			totalDeletions: 1,
		};

		expect(
			latestTurnDiff([
				{ customType: turnDiffEntryType, data: first, type: "custom" },
				{ customType: turnDiffEntryType, data: { files: "invalid" }, type: "custom" },
				{ customType: turnDiffEntryType, data: latest, type: "custom" },
			]),
		).toEqual(latest);
	});
});
