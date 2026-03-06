/**
 * Generate documentation artifacts from source code.
 * Usage: npx tsx scripts/generate-docs.ts
 */
import fs from "fs";
import path from "path";

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "docs", "generated");

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/**
 * Parse Prisma schema and generate markdown summary.
 */
function generateSchemaDoc() {
  const schemaPath = path.join(ROOT, "prisma", "schema.prisma");
  if (!fs.existsSync(schemaPath)) {
    console.log("⚠ prisma/schema.prisma not found, skipping schema generation");
    return;
  }

  const content = fs.readFileSync(schemaPath, "utf-8");
  const models: Array<{ name: string; fields: Array<{ name: string; type: string; attrs: string }> }> = [];
  const enums: Array<{ name: string; values: string[] }> = [];

  let currentModel: (typeof models)[0] | null = null;
  let currentEnum: (typeof enums)[0] | null = null;

  for (const line of content.split("\n")) {
    const trimmed = line.trim();

    const modelMatch = trimmed.match(/^model\s+(\w+)\s*\{/);
    if (modelMatch) {
      currentModel = { name: modelMatch[1], fields: [] };
      continue;
    }

    const enumMatch = trimmed.match(/^enum\s+(\w+)\s*\{/);
    if (enumMatch) {
      currentEnum = { name: enumMatch[1], values: [] };
      continue;
    }

    if (trimmed === "}" && currentModel) {
      models.push(currentModel);
      currentModel = null;
      continue;
    }

    if (trimmed === "}" && currentEnum) {
      enums.push(currentEnum);
      currentEnum = null;
      continue;
    }

    if (currentModel && trimmed && !trimmed.startsWith("//") && !trimmed.startsWith("@@")) {
      const fieldMatch = trimmed.match(/^(\w+)\s+(\S+)/);
      if (fieldMatch) {
        const attrs = trimmed.slice(fieldMatch[0].length).trim();
        currentModel.fields.push({
          name: fieldMatch[1],
          type: fieldMatch[2],
          attrs: attrs.replace(/@/g, "").replace(/\s+/g, " ").trim(),
        });
      }
    }

    if (currentEnum && trimmed && !trimmed.startsWith("//")) {
      currentEnum.values.push(trimmed);
    }
  }

  let md = `# Database Schema Reference\n\n`;
  md += `> Auto-generated from \`prisma/schema.prisma\`\n\n`;

  md += `## Enums\n\n`;
  for (const e of enums) {
    md += `### ${e.name}\n\n`;
    md += `Values: ${e.values.map((v) => `\`${v}\``).join(", ")}\n\n`;
  }

  md += `## Models\n\n`;
  for (const model of models) {
    md += `### ${model.name}\n\n`;
    md += `| Field | Type | Attributes |\n`;
    md += `|-------|------|------------|\n`;
    for (const f of model.fields) {
      md += `| ${f.name} | \`${f.type}\` | ${f.attrs || "—"} |\n`;
    }
    md += `\n`;
  }

  fs.writeFileSync(path.join(OUT, "db-schema.md"), md);
  console.log("✓ Generated docs/generated/db-schema.md");
}

/**
 * Parse .env.example and generate env reference markdown.
 */
function generateEnvDoc() {
  const envPath = path.join(ROOT, ".env.example");
  if (!fs.existsSync(envPath)) {
    console.log("⚠ .env.example not found, skipping env generation");
    return;
  }

  const content = fs.readFileSync(envPath, "utf-8");
  let md = `# Environment Variables Reference\n\n`;
  md += `> Auto-generated from \`.env.example\`\n\n`;
  md += `| Variable | Example Value | Notes |\n`;
  md += `|----------|---------------|-------|\n`;

  let lastComment = "";
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#")) {
      lastComment = trimmed.replace(/^#+\s*/, "");
      continue;
    }
    if (trimmed.includes("=")) {
      const [key, ...valParts] = trimmed.split("=");
      const val = valParts.join("=") || "—";
      md += `| \`${key}\` | \`${val}\` | ${lastComment} |\n`;
      lastComment = "";
    }
  }

  fs.writeFileSync(path.join(OUT, "env-reference.md"), md);
  console.log("✓ Generated docs/generated/env-reference.md");
}

// Run
ensureDir(OUT);
generateSchemaDoc();
generateEnvDoc();
console.log("\n✓ Done generating docs artifacts");
