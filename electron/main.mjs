import fs from "node:fs";
import path from "node:path";
import { appendBootstrapTrace } from "./bootstrap_trace.mjs";
import { register } from "tsx/esm/api";

function configurePackagedEsbuildBinary() {
	if (!process.resourcesPath || process.env.ESBUILD_BINARY_PATH) {
		return;
	}

	const packageName = `@esbuild/${process.platform}-${process.arch}`;
	const binaryName = process.platform === "win32" ? "esbuild.exe" : "bin/esbuild";
	const candidatePath = path.join(process.resourcesPath, "app.asar.unpacked", "node_modules", packageName, binaryName);
	if (!fs.existsSync(candidatePath)) {
		appendBootstrapTrace(`esbuild binary not found at ${candidatePath}`);
		return;
	}

	process.env.ESBUILD_BINARY_PATH = candidatePath;
	appendBootstrapTrace(`esbuild binary configured: ${candidatePath}`);
}

appendBootstrapTrace("main.mjs bootstrap start");

try {
	configurePackagedEsbuildBinary();
	register();
	appendBootstrapTrace("tsx register complete");
	await import("./main.ts");
	appendBootstrapTrace("main.ts import complete");
} catch (error) {
	appendBootstrapTrace("main.mjs bootstrap failed", error);
	throw error;
}
