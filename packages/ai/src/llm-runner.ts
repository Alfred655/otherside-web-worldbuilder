import Anthropic from "@anthropic-ai/sdk";

export function extractJSON(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  let json = "";
  if (fenceMatch) {
    json = fenceMatch[1].trim();
  } else {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end !== -1) json = text.slice(start, end + 1);
    else json = text.trim();
  }
  // Safe trailing comma repair only
  json = json.replace(/,\s*]/g, "]").replace(/,\s*}/g, "}");
  return json;
}

export interface RunWithRetryConfig<T> {
  client: Anthropic;
  model: string;
  system: string;
  buildUserContent: (attempt: number, lastError: string | null, lastFailedJSON: string | null) => string;
  schema: { safeParse: (data: unknown) => { success: true; data: T } | { success: false; error: { issues: { path: (string | number)[]; message: string }[] } } };
  maxRetries?: number;
  maxTokens?: number;
  onProgress?: (status: string) => void;
  retryLabel?: string;
}

export async function runWithRetry<T>(config: RunWithRetryConfig<T>): Promise<T> {
  const {
    client,
    model,
    system,
    buildUserContent,
    schema,
    maxRetries = 3,
    maxTokens = 32768,
    onProgress,
    retryLabel = "Generator",
  } = config;

  let lastError: string | null = null;
  let lastFailedJSON: string | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) {
      onProgress?.(`Retrying (attempt ${attempt + 1})...`);
    }

    const userContent = buildUserContent(attempt, lastError, lastFailedJSON);

    const response = await client.messages
      .stream({
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: userContent }],
      })
      .finalMessage();

    // Check for truncation
    if (response.stop_reason === "max_tokens") {
      lastError =
        "Output was truncated (exceeded max_tokens). Reduce entity/weapon count. Use simpler descriptions.";
      lastFailedJSON = null;
      console.warn(
        `[${retryLabel}] Attempt ${attempt + 1}/${maxRetries} truncated (stop_reason=max_tokens)`,
      );
      continue;
    }

    const rawText =
      response.content[0].type === "text" ? response.content[0].text : "";
    const json = extractJSON(rawText);

    try {
      const parsed = JSON.parse(json);
      const result = schema.safeParse(parsed);
      if (result.success) {
        return result.data as T;
      }
      // Format Zod issues with paths
      const issueMessages = result.error.issues
        .slice(0, 10)
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("\n");
      lastError = issueMessages;
      lastFailedJSON = json;
      console.warn(
        `[${retryLabel}] Attempt ${attempt + 1}/${maxRetries} validation failed:\n`,
        issueMessages.slice(0, 300),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown parse error";
      lastError = `JSON parse error: ${msg}`;
      lastFailedJSON = json;
      console.warn(
        `[${retryLabel}] Attempt ${attempt + 1}/${maxRetries} failed:`,
        msg.slice(0, 200),
      );
    }
  }

  throw new Error(
    `Failed to generate valid spec after ${maxRetries} attempts: ${lastError}`,
  );
}
