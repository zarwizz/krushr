import { execSync } from "child_process";
import { existsSync, statSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, "..");
const svgPath = resolve(rootDir, "app-icon.svg");
const iconsDir = resolve(rootDir, "src-tauri/icons");

console.log("🎨 [Krushr] Generating system and desktop icons...");

if (!existsSync(svgPath)) {
  console.error(`❌ Source SVG not found at ${svgPath}`);
  process.exit(1);
}

const svgContent = readFileSync(svgPath, "utf-8");
if (!svgContent.includes("#FB923C") || !svgContent.includes("#E11D48")) {
  console.warn("⚠️ Warning: SVG gradient colors do not match expected Krushr signature palette");
}

try {
  // Execute @tauri-apps/cli icon generation
  console.log("⚙️ Running tauri icon generation from app-icon.svg...");
  const output = execSync(`npx @tauri-apps/cli icon "${svgPath}" -o "${iconsDir}"`, {
    cwd: rootDir,
    encoding: "utf-8",
    stdio: "pipe"
  });
  console.log(output);

  // Validate expected target files
  const requiredFiles = [
    "32x32.png",
    "128x128.png",
    "128x128@2x.png",
    "icon.png",
    "icon.ico"
  ];

  console.log("\n🔍 Verifying generated icons in src-tauri/icons/:");
  let allOk = true;

  for (const file of requiredFiles) {
    const fullPath = resolve(iconsDir, file);
    if (!existsSync(fullPath)) {
      console.error(`❌ Missing: ${file}`);
      allOk = false;
      continue;
    }
    const stat = statSync(fullPath);
    if (stat.size === 0) {
      console.error(`❌ Empty file: ${file}`);
      allOk = false;
      continue;
    }
    console.log(`✅ ${file} (${stat.size} bytes)`);
  }

  if (!allOk) {
    console.error("❌ Icon verification failed!");
    process.exit(1);
  }

  console.log("\n✨ System and Windows taskbar icons successfully generated and verified!");
} catch (error) {
  console.error("❌ Failed to generate icons:", error);
  process.exit(1);
}
