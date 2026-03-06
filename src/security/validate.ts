/**
 * 输入与安全校验
 * 提供 query/url 的边界检查与 SSRF 基础拦截
 */
const PRIVATE_IPV4_RANGES: Array<[number, number]> = [
  [ipToInt("10.0.0.0"), ipToInt("10.255.255.255")],
  [ipToInt("127.0.0.0"), ipToInt("127.255.255.255")],
  [ipToInt("169.254.0.0"), ipToInt("169.254.255.255")],
  [ipToInt("172.16.0.0"), ipToInt("172.31.255.255")],
  [ipToInt("192.168.0.0"), ipToInt("192.168.255.255")],
];

function ipToInt(ip: string): number {
  const parts = ip.split(".").map(Number);
  return (
    ((parts[0] << 24) >>> 0) +
    ((parts[1] << 16) >>> 0) +
    ((parts[2] << 8) >>> 0) +
    (parts[3] >>> 0)
  );
}

function isIpv4(hostname: string): boolean {
  const parts = hostname.split(".");
  if (parts.length !== 4) return false;
  return parts.every(
    (part) => /^\d+$/.test(part) && Number(part) >= 0 && Number(part) <= 255,
  );
}

function isPrivateIpv4(hostname: string): boolean {
  if (!isIpv4(hostname)) return false;
  const value = ipToInt(hostname);
  return PRIVATE_IPV4_RANGES.some(([min, max]) => value >= min && value <= max);
}

function isBlockedIpv6(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  if (normalized === "::1" || normalized === "[::1]") return true;
  if (normalized.startsWith("fe80:") || normalized.startsWith("fe80::"))
    return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (normalized.includes("::ffff:")) return true;
  return false;
}

function isBlockedHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  if (normalized === "localhost") return true;
  if (normalized.endsWith(".local")) return true;
  if (isPrivateIpv4(normalized)) return true;
  if (isBlockedIpv6(normalized)) return true;
  return false;
}

export function validateQuery(input: string, maxLength: number): string {
  const query = input.trim();
  if (!query) throw new Error("query 不能为空");
  if (query.length > maxLength)
    throw new Error(`query 长度不能超过 ${maxLength}`);
  return query;
}

export function validateUrl(input: string, maxLength: number): string {
  const raw = input.trim();
  if (!raw) throw new Error("url 不能为空");
  if (raw.length > maxLength) throw new Error(`url 长度不能超过 ${maxLength}`);

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("url 格式不合法");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("url 协议仅支持 http 或 https");
  }

  if (isBlockedHostname(parsed.hostname)) {
    throw new Error("目标地址不被允许");
  }

  return parsed.toString();
}
