import { mkdir, rm, copyFile } from "node:fs/promises";
import { join } from "node:path";
import { context, build } from "esbuild";

const root = new URL("..", import.meta.url).pathname;
const dist = join(root, "dist");
const watch = process.argv.includes("--watch");

async function copyStatic() {
	await mkdir(dist, { recursive: true });
	await copyFile(join(root, "src", "index.html"), join(dist, "index.html"));
}

const common = {
	bundle: true,
	sourcemap: true,
	logLevel: "info",
};

const builds = [
	{
		...common,
		entryPoints: [join(root, "src", "main.ts")],
		outfile: join(dist, "main.js"),
		platform: "node",
		format: "esm",
		packages: "external",
		external: ["electron"],
	},
	{
		...common,
		entryPoints: [join(root, "src", "preload.ts")],
		outfile: join(dist, "preload.cjs"),
		platform: "node",
		format: "cjs",
		external: ["electron"],
	},
	{
		...common,
		entryPoints: [join(root, "src", "renderer.ts")],
		outfile: join(dist, "renderer.js"),
		platform: "browser",
		format: "esm",
	},
	{
		...common,
		entryPoints: [join(root, "src", "styles.css")],
		outfile: join(dist, "styles.css"),
		loader: { ".css": "css" },
	},
];

await rm(dist, { recursive: true, force: true });
await copyStatic();

if (watch) {
	const contexts = await Promise.all(builds.map((options) => context(options)));
	await Promise.all(contexts.map((ctx) => ctx.watch()));
	console.log("Watching desktop sources...");
} else {
	await Promise.all(builds.map((options) => build(options)));
}
