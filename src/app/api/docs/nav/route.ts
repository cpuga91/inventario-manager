import { NextResponse } from "next/server";
import { getNavSections } from "@/lib/docs";

export async function GET() {
  return NextResponse.json(getNavSections());
}
