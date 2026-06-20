import { describe, expect, it } from "vitest";

import { githubFailureSignature, normalizeGithubPullRequest } from "./github-pr";

describe("normalizeGithubPullRequest", () => {
	it("normalizes check runs and commit statuses", () => {
		expect(
			normalizeGithubPullRequest(
				{
					baseRefName: "master",
					headRefName: "feature/pr-checks",
					isDraft: false,
					number: 42,
					reviewDecision: "REVIEW_REQUIRED",
					state: "OPEN",
					statusCheckRollup: [
						{
							conclusion: "SUCCESS",
							detailsUrl: "https://github.com/askscio/scio/actions/runs/1",
							name: "unit-tests",
							status: "COMPLETED",
							workflowName: "CI",
						},
						{ conclusion: null, name: "lint", status: "IN_PROGRESS" },
						{ context: "buildkite", state: "FAILURE", targetUrl: "https://buildkite.com/build/1" },
						{ conclusion: "SKIPPED", name: "optional", status: "COMPLETED" },
					],
					title: "Track pull request checks",
					url: "https://github.com/askscio/scio/pull/42",
				},
				"2026-06-19T07:00:00.000Z",
			),
		).toEqual({
			baseRefName: "master",
			checks: [
				{
					completedAt: undefined,
					detailsUrl: "https://github.com/askscio/scio/actions/runs/1",
					name: "unit-tests",
					state: "passed",
					workflow: "CI",
				},
				{
					completedAt: undefined,
					detailsUrl: undefined,
					name: "lint",
					state: "pending",
					workflow: undefined,
				},
				{
					completedAt: undefined,
					detailsUrl: "https://buildkite.com/build/1",
					name: "buildkite",
					state: "failed",
					workflow: undefined,
				},
				{
					completedAt: undefined,
					detailsUrl: undefined,
					name: "optional",
					state: "neutral",
					workflow: undefined,
				},
			],
			failedCount: 1,
			fetchedAt: "2026-06-19T07:00:00.000Z",
			headRefName: "feature/pr-checks",
			isDraft: false,
			kind: "ready",
			neutralCount: 1,
			number: 42,
			passedCount: 1,
			pendingCount: 1,
			reviewDecision: "REVIEW_REQUIRED",
			state: "OPEN",
			title: "Track pull request checks",
			url: "https://github.com/askscio/scio/pull/42",
		});
	});

	it("rejects incomplete payloads", () => {
		expect(normalizeGithubPullRequest({ title: "missing fields" }, "now")).toEqual({
			fetchedAt: "now",
			kind: "error",
			message: "GitHub returned an invalid pull request response.",
		});
	});
});

describe("githubFailureSignature", () => {
	it("ignores failed checks on closed pull requests", () => {
		const status = normalizeGithubPullRequest({
			number: 1,
			state: "CLOSED",
			statusCheckRollup: [{ conclusion: "FAILURE", name: "build", status: "COMPLETED" }],
			title: "PR",
			url: "https://github.com/askscio/scio/pull/1",
		});

		expect(githubFailureSignature(status)).toBeUndefined();
	});

	it("is stable when failed checks are returned in a different order", () => {
		const first = normalizeGithubPullRequest({
			number: 1,
			statusCheckRollup: [
				{ completedAt: "2026-06-19T07:01:00Z", conclusion: "FAILURE", name: "b", status: "COMPLETED" },
				{ completedAt: "2026-06-19T07:00:00Z", conclusion: "FAILURE", name: "a", status: "COMPLETED" },
			],
			title: "PR",
			url: "https://github.com/askscio/scio/pull/1",
		});
		const second = normalizeGithubPullRequest({
			number: 1,
			statusCheckRollup: [
				{ completedAt: "2026-06-19T07:00:00Z", conclusion: "FAILURE", name: "a", status: "COMPLETED" },
				{ completedAt: "2026-06-19T07:01:00Z", conclusion: "FAILURE", name: "b", status: "COMPLETED" },
			],
			title: "PR",
			url: "https://github.com/askscio/scio/pull/1",
		});

		expect(githubFailureSignature(first)).toBe(githubFailureSignature(second));
	});
});
