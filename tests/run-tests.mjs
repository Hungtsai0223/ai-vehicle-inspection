import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
const root = process.cwd();
await mkdir(path.join(root, "work"), { recursive: true });
const out = await mkdtemp(path.join(root, "work", "tests-"));
try {
  const compiled = spawnSync(
    process.execPath,
    [
      "node_modules/typescript/bin/tsc",
      "tests/inspection.test.ts",
      "tests/camera.test.ts",
      "tests/keyframe-import.test.ts",
      "tests/guided-scan.test.ts",
      "tests/http-integration.test.ts",
      "tests/hardening.test.ts",
      "tests/demo-readiness.test.ts",
      "--outDir",
      out,
      "--module",
      "commonjs",
      "--moduleResolution",
      "node",
      "--target",
      "ES2022",
      "--esModuleInterop",
      "--strict",
      "--skipLibCheck",
    ],
    { cwd: root, stdio: "inherit" },
  );
  if (compiled.status !== 0) process.exitCode = compiled.status ?? 1;
  else {
    const tested = spawnSync(
      process.execPath,
      [
        "--test",
        path.join(out, "tests/inspection.test.js"),
        path.join(out, "tests/camera.test.js"),
        path.join(out, "tests/keyframe-import.test.js"),
        path.join(root, "tests/poc-mapping.test.mjs"),
        path.join(out, "tests/guided-scan.test.js"),
        path.join(out, "tests/http-integration.test.js"),
        path.join(out, "tests/hardening.test.js"),
        path.join(out, "tests/demo-readiness.test.js"),
      ],
      {
        cwd: root,
        stdio: "inherit",
        env: { ...process.env, NODE_ENV: "test" },
      },
    );
    process.exitCode = tested.status ?? 1;
  }
} finally {
  await rm(out, { recursive: true, force: true });
}
