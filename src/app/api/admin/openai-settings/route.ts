import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encryptSecret, decryptSecret, isEncryptionConfigured } from "@/lib/encryption";
import { KeyStorageMode } from "@prisma/client";

/**
 * GET /api/admin/openai-settings
 * Returns non-sensitive fields + masked key info. Never returns plaintext key.
 */
export async function GET() {
  try {
    const user = await requireAuth(["ADMIN"]);
    const tenantId = user.tenantId;

    const settings = await prisma.openAiSettings.findUnique({
      where: { tenantId },
    });

    if (!settings) {
      return NextResponse.json({
        settings: {
          isEnabled: false,
          model: "gpt-4o-mini",
          dailyHourLocal: 7,
          timezone: "America/Santiago",
          maxSkus: 150,
          promptVersion: "v1.0",
          keyStorageMode: "ENV_ONLY",
          hasStoredKey: false,
          apiKeyLast4: null,
        },
        encryptionAvailable: isEncryptionConfigured(),
        envKeyConfigured: !!process.env.OPENAI_API_KEY,
      });
    }

    return NextResponse.json({
      settings: {
        isEnabled: settings.isEnabled,
        model: settings.model || "gpt-4o-mini",
        dailyHourLocal: settings.dailyHourLocal,
        timezone: settings.timezone,
        maxSkus: settings.maxSkus,
        promptVersion: settings.promptVersion,
        keyStorageMode: settings.keyStorageMode,
        hasStoredKey: !!settings.encryptedApiKey,
        apiKeyLast4: settings.apiKeyLast4,
      },
      encryptionAvailable: isEncryptionConfigured(),
      envKeyConfigured: !!process.env.OPENAI_API_KEY,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * POST /api/admin/openai-settings
 * Update OpenAI settings for the tenant. Validates payload.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(["ADMIN"]);
    const tenantId = user.tenantId;
    const body = await req.json();

    // Validate fields
    const errors: string[] = [];

    if (typeof body.isEnabled !== "undefined" && typeof body.isEnabled !== "boolean") {
      errors.push("isEnabled must be a boolean");
    }

    if (typeof body.model !== "undefined" && body.model !== null) {
      if (typeof body.model !== "string" || body.model.length > 100) {
        errors.push("model must be a string (max 100 chars)");
      }
    }

    if (typeof body.dailyHourLocal !== "undefined") {
      if (typeof body.dailyHourLocal !== "number" || body.dailyHourLocal < 0 || body.dailyHourLocal > 23 || !Number.isInteger(body.dailyHourLocal)) {
        errors.push("dailyHourLocal must be an integer 0-23");
      }
    }

    if (typeof body.timezone !== "undefined") {
      if (typeof body.timezone !== "string" || body.timezone.length > 100) {
        errors.push("timezone must be a string (max 100 chars)");
      }
    }

    if (typeof body.maxSkus !== "undefined") {
      if (typeof body.maxSkus !== "number" || body.maxSkus < 1 || body.maxSkus > 1000 || !Number.isInteger(body.maxSkus)) {
        errors.push("maxSkus must be an integer 1-1000");
      }
    }

    if (typeof body.keyStorageMode !== "undefined") {
      if (!["ENV_ONLY", "DB_ENCRYPTED"].includes(body.keyStorageMode)) {
        errors.push("keyStorageMode must be ENV_ONLY or DB_ENCRYPTED");
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({ error: "Validation failed", details: errors }, { status: 400 });
    }

    // Handle API key storage
    let encryptedApiKey: string | null | undefined = undefined;
    let apiKeyLast4: string | null | undefined = undefined;

    if (body.apiKey) {
      const keyStorageMode = body.keyStorageMode || "ENV_ONLY";

      if (keyStorageMode === "ENV_ONLY") {
        return NextResponse.json(
          { error: "Cannot store API key when keyStorageMode is ENV_ONLY. Set OPENAI_API_KEY in your environment variables instead." },
          { status: 400 }
        );
      }

      if (!isEncryptionConfigured()) {
        return NextResponse.json(
          { error: "APP_ENCRYPTION_KEY must be configured to store encrypted keys. Set it in your environment variables." },
          { status: 400 }
        );
      }

      // Validate key format
      const key = body.apiKey.trim();
      if (key.length < 10 || key.length > 256) {
        return NextResponse.json({ error: "Invalid API key format" }, { status: 400 });
      }

      encryptedApiKey = encryptSecret(key);
      apiKeyLast4 = key.slice(-4);
    }

    // Handle key removal
    if (body.removeKey === true) {
      encryptedApiKey = null;
      apiKeyLast4 = null;
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (typeof body.isEnabled === "boolean") updateData.isEnabled = body.isEnabled;
    if (typeof body.model !== "undefined") updateData.model = body.model || null;
    if (typeof body.dailyHourLocal === "number") updateData.dailyHourLocal = body.dailyHourLocal;
    if (typeof body.timezone === "string") updateData.timezone = body.timezone;
    if (typeof body.maxSkus === "number") updateData.maxSkus = body.maxSkus;
    if (typeof body.keyStorageMode === "string") updateData.keyStorageMode = body.keyStorageMode as KeyStorageMode;
    if (encryptedApiKey !== undefined) updateData.encryptedApiKey = encryptedApiKey;
    if (apiKeyLast4 !== undefined) updateData.apiKeyLast4 = apiKeyLast4;

    // Upsert
    const settings = await prisma.openAiSettings.upsert({
      where: { tenantId },
      update: updateData,
      create: {
        tenantId,
        isEnabled: (body.isEnabled as boolean) ?? false,
        model: body.model || null,
        dailyHourLocal: body.dailyHourLocal ?? 7,
        timezone: body.timezone ?? "America/Santiago",
        maxSkus: body.maxSkus ?? 150,
        promptVersion: body.promptVersion ?? "v1.0",
        keyStorageMode: (body.keyStorageMode as KeyStorageMode) ?? "ENV_ONLY",
        encryptedApiKey: encryptedApiKey ?? null,
        apiKeyLast4: apiKeyLast4 ?? null,
      },
    });

    return NextResponse.json({
      success: true,
      settings: {
        isEnabled: settings.isEnabled,
        model: settings.model || "gpt-4o-mini",
        dailyHourLocal: settings.dailyHourLocal,
        timezone: settings.timezone,
        maxSkus: settings.maxSkus,
        promptVersion: settings.promptVersion,
        keyStorageMode: settings.keyStorageMode,
        hasStoredKey: !!settings.encryptedApiKey,
        apiKeyLast4: settings.apiKeyLast4,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
