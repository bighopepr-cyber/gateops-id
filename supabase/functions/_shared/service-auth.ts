export function constantTimeEqual(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const a = encoder.encode(left), b = encoder.encode(right);
  let difference = a.length ^ b.length;
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    difference |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return difference === 0;
}
export function hasValidServiceCredential(request: Request, expected: string | undefined): boolean {
  if (!expected || expected.length < 32) return false;
  const supplied = request.headers.get("x-gateops-service-key");
  return supplied !== null && supplied.length >= 32 && constantTimeEqual(supplied, expected);
}
