/**
 * Documentation engine: loads markdown files, builds search index, provides navigation.
 */
import fs from "fs";
import path from "path";
import matter from "gray-matter";

export interface DocPage {
  slug: string;
  title: string;
  description: string;
  section: string;
  order: number;
  content: string;
  lastUpdated?: string;
}

export interface NavSection {
  title: string;
  items: { slug: string; title: string }[];
}

const DOCS_DIR = path.join(process.cwd(), "docs");

export function getAllDocs(): DocPage[] {
  const files = fs.readdirSync(DOCS_DIR).filter((f) => f.endsWith(".md"));
  return files
    .map((file) => {
      const raw = fs.readFileSync(path.join(DOCS_DIR, file), "utf-8");
      const { data, content } = matter(raw);
      return {
        slug: file.replace(/\.md$/, ""),
        title: (data.title as string) || file.replace(/\.md$/, ""),
        description: (data.description as string) || "",
        section: (data.section as string) || "General",
        order: (data.order as number) ?? 99,
        content,
        lastUpdated: (data.lastUpdated as string) || undefined,
      };
    })
    .sort((a, b) => a.order - b.order);
}

export function getDocBySlug(slug: string): DocPage | null {
  const filePath = path.join(DOCS_DIR, `${slug}.md`);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(raw);
  return {
    slug,
    title: (data.title as string) || slug,
    description: (data.description as string) || "",
    section: (data.section as string) || "General",
    order: (data.order as number) ?? 99,
    content,
    lastUpdated: (data.lastUpdated as string) || undefined,
  };
}

export function getNavSections(): NavSection[] {
  const docs = getAllDocs();
  const sectionMap = new Map<string, { slug: string; title: string; order: number }[]>();
  const sectionOrder: string[] = [];

  for (const doc of docs) {
    if (!sectionMap.has(doc.section)) {
      sectionMap.set(doc.section, []);
      sectionOrder.push(doc.section);
    }
    sectionMap.get(doc.section)!.push({ slug: doc.slug, title: doc.title, order: doc.order });
  }

  return sectionOrder.map((title) => ({
    title,
    items: sectionMap.get(title)!.sort((a, b) => a.order - b.order),
  }));
}

export function buildSearchIndex(): Array<{ slug: string; title: string; description: string; content: string; section: string }> {
  return getAllDocs().map((doc) => ({
    slug: doc.slug,
    title: doc.title,
    description: doc.description,
    content: doc.content.slice(0, 5000), // Limit for search payload
    section: doc.section,
  }));
}
