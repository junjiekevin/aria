import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_MODELS = new Set([
  "google/gemini-2.5-flash-lite",
  "z-ai/glm-4.7-flash",
  "google/gemma-3-27b-it",
  "qwen/qwen3-4b:free",
]);

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!OPENROUTER_API_KEY || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return json(
        {
          ok: false,
          status: 500,
          statusText: "Server Misconfigured",
          errorData: { message: "Missing required edge function environment variables." },
        },
        200
      );
    }

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return json(
        {
          ok: false,
          status: 401,
          statusText: "Unauthorized",
          errorData: { message: "Missing bearer token." },
        },
        200
      );
    }

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const { data: authData, error: authError } = await authClient.auth.getUser();
    if (authError || !authData?.user) {
      return json(
        {
          ok: false,
          status: 401,
          statusText: "Unauthorized",
          errorData: { message: "Invalid or expired auth token." },
        },
        200
      );
    }

    const body = await req.json();
    const model = body?.model;
    const messages = body?.messages;
    const temperature = body?.temperature;
    const maxTokens = body?.max_tokens;
    const stop = body?.stop;

    if (typeof model !== "string" || !ALLOWED_MODELS.has(model)) {
      return json(
        {
          ok: false,
          status: 400,
          statusText: "Bad Request",
          errorData: { message: "Unsupported model." },
        },
        200
      );
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return json(
        {
          ok: false,
          status: 400,
          statusText: "Bad Request",
          errorData: { message: "messages must be a non-empty array." },
        },
        200
      );
    }

    const requestBody: Record<string, unknown> = {
      model,
      messages,
    };
    if (typeof temperature === "number") requestBody.temperature = temperature;
    if (typeof maxTokens === "number") requestBody.max_tokens = maxTokens;
    if (Array.isArray(stop)) requestBody.stop = stop;

    const upstream = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": req.headers.get("origin") || "https://aria-scheduling.vercel.app",
        "X-Title": "Aria - Scheduling Assistant",
      },
      body: JSON.stringify(requestBody),
    });

    const rawText = await upstream.text();
    let parsed: unknown = {};
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = { raw: rawText };
    }

    if (!upstream.ok) {
      return json(
        {
          ok: false,
          status: upstream.status,
          statusText: upstream.statusText,
          errorData: parsed,
        },
        200
      );
    }

    return json(
      {
        ok: true,
        status: upstream.status,
        statusText: upstream.statusText,
        data: parsed,
      },
      200
    );
  } catch (err) {
    return json(
      {
        ok: false,
        status: 500,
        statusText: "Proxy Error",
        errorData: { message: err instanceof Error ? err.message : String(err) },
      },
      200
    );
  }
});
