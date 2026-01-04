import { ParsedIntentSchema, listRoutingCatalog, routingListKeys, type ParsedIntent, type RoutingListKey, type UrgencyLevel } from "./schema";

const defaultListKey: RoutingListKey = "default";

const normalize = (value: string) => value.toLowerCase().trim();

export function detectTargetList(title: string): RoutingListKey {
  const normalized = normalize(title);

  for (const rule of listRoutingCatalog) {
    const matched = rule.matchers.some((matcher) => {
      if (typeof matcher === "string") {
        return normalized.includes(matcher.toLowerCase());
      }
      return matcher.test(title);
    });
    if (matched) return rule.key;
  }

  return defaultListKey;
}

export function detectUrgency(title: string): UrgencyLevel {
  const normalized = normalize(title);

  const keywordMap: Record<UrgencyLevel, (string | RegExp)[]> = {
    high: ["this week", /🔥/, /urgent/i, /today/i],
    medium: ["next week", /soon/i, /upcoming/i],
    low: ["later", /someday/i, /eventually/i, /🧊/]
  };

  for (const [level, patterns] of Object.entries(keywordMap) as [UrgencyLevel, (string | RegExp)[]][]) {
    const matched = patterns.some((pattern) => {
      if (typeof pattern === "string") return normalized.includes(pattern);
      return pattern.test(title);
    });
    if (matched) return level;
  }

  return "medium";
}

export function parseTaskIntent(title: string): ParsedIntent {
  const parsed = {
    targetList: detectTargetList(title),
    urgency: detectUrgency(title)
  } satisfies ParsedIntent;

  return ParsedIntentSchema.parse(parsed);
}

export function getTasklistIdFromKey(key: RoutingListKey): string | undefined {
  if (key === "default") return undefined;
  return listRoutingCatalog.find((rule) => rule.key === key)?.tasklistId;
}

export function describeIntent(intent: ParsedIntent): string {
  return `Target: ${intent.targetList} | Urgency: ${intent.urgency}`;
}
