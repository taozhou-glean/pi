export interface DiffLine {
	newLine?: number;
	oldLine?: number;
	text: string;
	type: "context" | "add" | "delete";
}

export interface DiffHunk {
	header: string;
	lines: DiffLine[];
	newLines: number;
	newStart: number;
	oldLines: number;
	oldStart: number;
}

export interface DiffFile {
	additions: number;
	deletions: number;
	hunks: DiffHunk[];
	newPath: string;
	oldPath: string;
	status: "modified" | "added" | "deleted" | "renamed";
}

export interface ParsedDiff {
	files: DiffFile[];
	totalAdditions: number;
	totalDeletions: number;
}

const fileHeaderPattern = /^diff --git a\/(.+?) b\/(.+)$/;
const hunkHeaderPattern = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/;

export function parseUnifiedDiff(raw: string): ParsedDiff {
	const lines = raw.split("\n");
	const files: DiffFile[] = [];
	let currentFile: DiffFile | undefined;
	let currentHunk: DiffHunk | undefined;
	let oldLineNum = 0;
	let newLineNum = 0;
	let i = 0;

	while (i < lines.length) {
		const line = lines[i] ?? "";
		const fileMatch = fileHeaderPattern.exec(line);
		if (fileMatch) {
			if (currentFile) files.push(currentFile);
			currentFile = {
				additions: 0,
				deletions: 0,
				hunks: [],
				newPath: fileMatch[2] ?? "",
				oldPath: fileMatch[1] ?? "",
				status: "modified",
			};
			currentHunk = undefined;
			i++;

			while (
				i < lines.length &&
				!fileHeaderPattern.test(lines[i] ?? "") &&
				!hunkHeaderPattern.test(lines[i] ?? "")
			) {
				const metaLine = lines[i] ?? "";
				if (metaLine.startsWith("new file mode")) {
					currentFile.status = "added";
				} else if (metaLine.startsWith("deleted file mode")) {
					currentFile.status = "deleted";
				} else if (
					metaLine.startsWith("rename from ") ||
					metaLine.startsWith("rename to ") ||
					metaLine.startsWith("similarity index")
				) {
					currentFile.status = "renamed";
				}
				i++;
			}
			continue;
		}

		const hunkMatch = hunkHeaderPattern.exec(line);
		if (hunkMatch && currentFile) {
			currentHunk = {
				header: hunkMatch[5]?.trim() || "",
				lines: [],
				newLines: Number.parseInt(hunkMatch[4] ?? "1", 10),
				newStart: Number.parseInt(hunkMatch[3] ?? "1", 10),
				oldLines: Number.parseInt(hunkMatch[2] ?? "1", 10),
				oldStart: Number.parseInt(hunkMatch[1] ?? "1", 10),
			};
			oldLineNum = currentHunk.oldStart;
			newLineNum = currentHunk.newStart;
			currentFile.hunks.push(currentHunk);
			i++;
			continue;
		}

		if (currentHunk && currentFile) {
			if (line.startsWith("+")) {
				currentHunk.lines.push({ newLine: newLineNum, text: line.slice(1), type: "add" });
				currentFile.additions++;
				newLineNum++;
			} else if (line.startsWith("-")) {
				currentHunk.lines.push({ oldLine: oldLineNum, text: line.slice(1), type: "delete" });
				currentFile.deletions++;
				oldLineNum++;
			} else if (line.startsWith(" ")) {
				currentHunk.lines.push({ newLine: newLineNum, oldLine: oldLineNum, text: line.slice(1), type: "context" });
				oldLineNum++;
				newLineNum++;
			} else if (
				line === "" &&
				i + 1 < lines.length &&
				!fileHeaderPattern.test(lines[i + 1] ?? "") &&
				!hunkHeaderPattern.test(lines[i + 1] ?? "") &&
				(lines[i + 1]?.startsWith("+") || lines[i + 1]?.startsWith("-") || lines[i + 1]?.startsWith(" "))
			) {
				currentHunk.lines.push({ newLine: newLineNum, oldLine: oldLineNum, text: "", type: "context" });
				oldLineNum++;
				newLineNum++;
			}
		}
		i++;
	}

	if (currentFile) files.push(currentFile);

	let totalAdditions = 0;
	let totalDeletions = 0;
	for (const file of files) {
		totalAdditions += file.additions;
		totalDeletions += file.deletions;
	}

	return { files, totalAdditions, totalDeletions };
}
