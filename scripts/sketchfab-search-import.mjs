import { spawn } from "node:child_process";
import readline from "node:readline";

function run(command, args) {
  const resolvedCommand = process.platform === "win32" && command === "npm" ? "npm.cmd" : command;
  return new Promise((resolve, reject) => {
    const child = spawn(resolvedCommand, args, {
      stdio: "inherit",
      env: process.env,
    });

    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} failed with code ${code}`));
    });
  });
}

function printHelp() {
  console.log(`\nSketchfab search + import helper\n\nUsage:\n  npm run models:search -- "human heart anatomy"\n  npm run models:search\n\nBehavior:\n  1) Search + download from Sketchfab\n  2) Refresh download/like/view stats\n  3) Run compliance check\n\nRequired env:\n  SKETCHFAB_API_TOKEN\n`);
}

function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printHelp();
    process.exit(0);
  }

  if (!process.env.SKETCHFAB_API_TOKEN) {
    console.error("❌ Missing SKETCHFAB_API_TOKEN env variable.");
    console.error("PowerShell example:");
    console.error("  $env:SKETCHFAB_API_TOKEN=\"YOUR_TOKEN\"");
    process.exit(1);
  }

  const cliQuery = process.argv.slice(2).join(" ").trim();
  const query = cliQuery || (await ask("מה לחפש ב-Sketchfab? (לדוגמה: human heart anatomy) "));

  if (!query) {
    console.error("❌ חייב להזין טקסט חיפוש.");
    process.exit(1);
  }

  console.log(`\n🔎 Searching and downloading for: \"${query}\"\n`);

  await run("npm", [
    "run",
    "models:sketchfab",
    "--",
    "--query",
    query,
    "--max",
    "20",
    "--allow",
    "cc,by,sa,nc,nd",
    "--allow-non-glb",
    "--update-manifest",
  ]);

  console.log("\n📊 Refreshing model stats...\n");
  await run("npm", ["run", "models:refresh-stats"]);

  console.log("\n✅ Validating compliance...\n");
  await run("npm", ["run", "compliance:check"]);

  console.log("\n🎉 Done. Models imported to public/models/sketchfab and listed in Model Manager.");
}

main().catch((error) => {
  console.error("❌", error.message);
  process.exit(1);
});
