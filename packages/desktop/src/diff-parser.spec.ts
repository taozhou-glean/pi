import { describe, expect, it } from "vitest";

import { parseUnifiedDiff } from "./diff-parser";

describe("parseUnifiedDiff", () => {
	it("parses a simple modification", () => {
		const diff = `diff --git a/VERSION b/VERSION
index abc1234..def5678 100644
--- a/VERSION
+++ b/VERSION
@@ -1 +1 @@
-0.0.25
+0.0.26
`;
		const result = parseUnifiedDiff(diff);

		expect(result.files).toHaveLength(1);
		expect(result.files[0].status).toBe("modified");
		expect(result.files[0].additions).toBe(1);
		expect(result.files[0].deletions).toBe(1);
		expect(result.files[0].hunks).toHaveLength(1);
		expect(result.files[0].hunks[0].lines).toHaveLength(2);
		expect(result.files[0].hunks[0].lines[0]).toEqual({ oldLine: 1, text: "0.0.25", type: "delete" });
		expect(result.files[0].hunks[0].lines[1]).toEqual({ newLine: 1, text: "0.0.26", type: "add" });
		expect(result.totalAdditions).toBe(1);
		expect(result.totalDeletions).toBe(1);
	});

	it("parses a new file", () => {
		const diff = `diff --git a/src/new.ts b/src/new.ts
new file mode 100644
index 0000000..abc1234
--- /dev/null
+++ b/src/new.ts
@@ -0,0 +1,3 @@
+export function hello() {
+  return 'world'
+}
`;
		const result = parseUnifiedDiff(diff);

		expect(result.files).toHaveLength(1);
		expect(result.files[0].status).toBe("added");
		expect(result.files[0].newPath).toBe("src/new.ts");
		expect(result.files[0].additions).toBe(3);
		expect(result.files[0].deletions).toBe(0);
	});

	it("parses a deleted file", () => {
		const diff = `diff --git a/old.ts b/old.ts
deleted file mode 100644
index abc1234..0000000
--- a/old.ts
+++ /dev/null
@@ -1,2 +0,0 @@
-const x = 1
-export default x
`;
		const result = parseUnifiedDiff(diff);

		expect(result.files).toHaveLength(1);
		expect(result.files[0].status).toBe("deleted");
		expect(result.files[0].additions).toBe(0);
		expect(result.files[0].deletions).toBe(2);
	});

	it("parses context lines with line numbers", () => {
		const diff = `diff --git a/file.ts b/file.ts
index abc1234..def5678 100644
--- a/file.ts
+++ b/file.ts
@@ -5,7 +5,7 @@ function example() {
   const a = 1
   const b = 2
   const c = 3
-  const d = 4
+  const d = 'four'
   const e = 5
   const f = 6
   const g = 7
`;
		const result = parseUnifiedDiff(diff);
		const hunk = result.files[0].hunks[0];

		expect(hunk.oldStart).toBe(5);
		expect(hunk.newStart).toBe(5);
		expect(hunk.lines[0]).toEqual({ newLine: 5, oldLine: 5, text: "  const a = 1", type: "context" });
		expect(hunk.lines[1]).toEqual({ newLine: 6, oldLine: 6, text: "  const b = 2", type: "context" });
		expect(hunk.lines[2]).toEqual({ newLine: 7, oldLine: 7, text: "  const c = 3", type: "context" });
		expect(hunk.lines[3]).toEqual({ oldLine: 8, text: "  const d = 4", type: "delete" });
		expect(hunk.lines[4]).toEqual({ newLine: 8, text: "  const d = 'four'", type: "add" });
		expect(hunk.lines[5]).toEqual({ newLine: 9, oldLine: 9, text: "  const e = 5", type: "context" });
	});

	it("parses multiple files", () => {
		const diff = `diff --git a/a.ts b/a.ts
index abc..def 100644
--- a/a.ts
+++ b/a.ts
@@ -1,2 +1,3 @@
 line1
+added
 line2
diff --git a/b.ts b/b.ts
index ghi..jkl 100644
--- a/b.ts
+++ b/b.ts
@@ -1,3 +1,2 @@
 line1
-removed
 line2
`;
		const result = parseUnifiedDiff(diff);

		expect(result.files).toHaveLength(2);
		expect(result.files[0].newPath).toBe("a.ts");
		expect(result.files[0].additions).toBe(1);
		expect(result.files[1].newPath).toBe("b.ts");
		expect(result.files[1].deletions).toBe(1);
		expect(result.totalAdditions).toBe(1);
		expect(result.totalDeletions).toBe(1);
	});

	it("handles empty diff", () => {
		const result = parseUnifiedDiff("");

		expect(result.files).toHaveLength(0);
		expect(result.totalAdditions).toBe(0);
		expect(result.totalDeletions).toBe(0);
	});

	it("parses renamed file", () => {
		const diff = `diff --git a/old-name.ts b/new-name.ts
similarity index 95%
rename from old-name.ts
rename to new-name.ts
index abc..def 100644
--- a/old-name.ts
+++ b/new-name.ts
@@ -1,3 +1,3 @@
 const x = 1
-const y = 2
+const y = 'two'
 export { x, y }
`;
		const result = parseUnifiedDiff(diff);

		expect(result.files).toHaveLength(1);
		expect(result.files[0].status).toBe("renamed");
		expect(result.files[0].oldPath).toBe("old-name.ts");
		expect(result.files[0].newPath).toBe("new-name.ts");
	});
});
