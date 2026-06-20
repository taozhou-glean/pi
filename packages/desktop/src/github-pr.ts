import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const githubCli = ["/opt/homebrew/bin/gh", "/usr/local/bin/gh"].find(existsSync) ?? "gh";
const noPullRequestPattern = /no pull requests? found|no open pull requests?/i;
const githubPrFields = [
	"number",
	"title",
	"url",
	"state",
	"isDraft",
	"headRefName",
	"baseRefName",
	"reviewDecision",
	"statusCheckRollup",
].join(",");

export type GithubCheckState = "passed" | "pending" | "failed" | "neutral";

export interface GithubCheck {
	completedAt?: string;
	detailsUrl?: string;
	name: string;
	state: GithubCheckState;
	workflow?: string;
}

export type GithubPullRequestStatus =
	| { fetchedAt: string; kind: "none" | "unavailable" | "error"; message: string }
	| {
			baseRefName: string;
			checks: GithubCheck[];
			failedCount: number;
			fetchedAt: string;
			headRefName: string;
			isDraft: boolean;
			kind: "ready";
			neutralCount: number;
			number: number;
			passedCount: number;
			pendingCount: number;
			reviewDecision?: string;
			state: string;
			title: string;
			url: string;
	  };

interface GithubCheckPayload {
	completedAt?: unknown;
	conclusion?: unknown;
	context?: unknown;
	detailsUrl?: unknown;
	name?: unknown;
	state?: unknown;
	status?: unknown;
	targetUrl?: unknown;
	workflowName?: unknown;
}

interface GithubPullRequestPayload {
	baseRefName?: unknown;
	headRefName?: unknown;
	isDraft?: unknown;
	number?: unknown;
	reviewDecision?: unknown;
	state?: unknown;
	statusCheckRollup?: unknown;
	title?: unknown;
	url?: unknown;
}

function optionalString(value: unknown): string | undefined {
	return typeof value === "string" && value ? value : undefined;
}

function checkState(check: GithubCheckPayload): GithubCheckState {
	const status = optionalString(check.status)?.toUpperCase();
	const conclusion = optionalString(check.conclusion)?.toUpperCase();
	const state = optionalString(check.state)?.toUpperCase();
	if (status && status !== "COMPLETED") return "pending";
	if (state === "PENDING" || state === "EXPECTED") return "pending";
	const result = conclusion ?? state;
	if (result === "SUCCESS") return "passed";
	if (result === "NEUTRAL" || result === "SKIPPED") return "neutral";
	if (result) return "failed";
	return status === "COMPLETED" ? "neutral" : "pending";
}

export function normalizeGithubPullRequest(
	payload: GithubPullRequestPayload,
	fetchedAt = new Date().toISOString(),
): GithubPullRequestStatus {
	if (typeof payload.number !== "number" || typeof payload.title !== "string" || typeof payload.url !== "string") {
		return { fetchedAt, kind: "error", message: "GitHub returned an invalid pull request response." };
	}
	const checks = (Array.isArray(payload.statusCheckRollup) ? payload.statusCheckRollup : []).map((value) => {
		const check = (value ?? {}) as GithubCheckPayload;
		return {
			completedAt: optionalString(check.completedAt),
			detailsUrl: optionalString(check.detailsUrl) ?? optionalString(check.targetUrl),
			name: optionalString(check.name) ?? optionalString(check.context) ?? "Unknown check",
			state: checkState(check),
			workflow: optionalString(check.workflowName),
		};
	});
	return {
		baseRefName: optionalString(payload.baseRefName) ?? "",
		checks,
		failedCount: checks.filter((check) => check.state === "failed").length,
		fetchedAt,
		headRefName: optionalString(payload.headRefName) ?? "",
		isDraft: payload.isDraft === true,
		kind: "ready",
		neutralCount: checks.filter((check) => check.state === "neutral").length,
		number: payload.number,
		passedCount: checks.filter((check) => check.state === "passed").length,
		pendingCount: checks.filter((check) => check.state === "pending").length,
		reviewDecision: optionalString(payload.reviewDecision),
		state: optionalString(payload.state) ?? "OPEN",
		title: payload.title,
		url: payload.url,
	};
}

function commandErrorMessage(error: unknown): string {
	if (typeof error === "string") return error;
	if (!error || typeof error !== "object") return "Unknown GitHub CLI error.";
	if ("stderr" in error && typeof error.stderr === "string" && error.stderr.trim()) return error.stderr.trim();
	if ("stdout" in error && typeof error.stdout === "string" && error.stdout.trim()) return error.stdout.trim();
	if ("message" in error && typeof error.message === "string") return error.message;
	return "Unknown GitHub CLI error.";
}

export async function getGithubPullRequestStatus(cwd: string): Promise<GithubPullRequestStatus> {
	const fetchedAt = new Date().toISOString();
	try {
		const { stdout } = await execFileAsync(githubCli, ["pr", "view", "--json", githubPrFields], {
			cwd,
			maxBuffer: 2 * 1024 * 1024,
			timeout: 20_000,
		});
		return normalizeGithubPullRequest(JSON.parse(stdout) as GithubPullRequestPayload, fetchedAt);
	} catch (error) {
		if (error && typeof error === "object" && (error as { code?: unknown }).code === "ENOENT") {
			return { fetchedAt, kind: "unavailable", message: "Install the GitHub CLI to track pull request checks." };
		}
		const message = commandErrorMessage(error);
		if (noPullRequestPattern.test(message)) {
			return { fetchedAt, kind: "none", message: "No open pull request found for this branch." };
		}
		return { fetchedAt, kind: "error", message };
	}
}

export function githubFailureSignature(status: GithubPullRequestStatus): string | undefined {
	if (status.kind !== "ready" || status.state.toUpperCase() !== "OPEN" || status.failedCount === 0) return undefined;
	return status.checks
		.filter((check) => check.state === "failed")
		.map((check) => [check.name, check.detailsUrl, check.completedAt].filter(Boolean).join("|"))
		.sort()
		.join("\n");
}
