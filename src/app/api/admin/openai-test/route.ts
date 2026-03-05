import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/encryption";

/**
 * POST /api/admin/openai-test
 * Test OpenAI connection with a minimal API call.
 */
export async function POST() {
  try {
    const user = await requireAuth(["ADMIN"]);
    const tenantId = user.tenantId;

    // Resolve API key
    const apiKey = await resolveApiKey(tenantId);
    if (!apiKey) {
      return NextResponse.json(
        { success: false, message: "No API key configured. Set OPENAI_API_KEY in env or store an encrypted key." },
        { status: 400 }
      );
    }

    // Minimal OpenAI call
    const moduleName = "openai";
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const OpenAI = require(moduleName).default;
    const openai = new OpenAI({ apiKey });

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Say OK" }],
      max_tokens: 5,
    });

    const reply = response.choices[0]?.message?.content || "";
    return NextResponse.json({
      success: true,
      message: `Connection successful. Model responded: "${reply.slice(0, 50)}"`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error";
    // Never leak the full error which might contain key info
    if (message === "Unauthorized" || message === "Forbidden") {
      return NextResponse.json({ error: message }, { status: message === "Unauthorized" ? 401 : 403 });
    }
    const safeMessage = message.includes("API key")
      ? "Invalid API key. Please check your key and try again."
      : message.includes("model")
        ? "Model not available. Check your OpenAI plan."
        : "Connection failed. Please verify your API key and network.";
    return NextResponse.json({ success: false, message: safeMessage }, { status: 400 });
  }
}

async function resolveApiKey(tenantId: string): Promise<string | null> {
  const settings = await prisma.openAiSettings.findUnique({ where: { tenantId } });

  if (settings?.keyStorageMode === "DB_ENCRYPTED" && settings.encryptedApiKey) {
    try {
      return decryptSecret(settings.encryptedApiKey);
    } catch {
      // Fallback to env
    }
  }

  return process.env.OPENAI_API_KEY || null;
}
