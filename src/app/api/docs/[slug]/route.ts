import { NextResponse } from "next/server";
import { getDocBySlug } from "@/lib/docs";

export async function GET(
  _req: Request,
  { params }: { params: { slug: string } }
) {
  const doc = getDocBySlug(params.slug);
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(doc);
}
