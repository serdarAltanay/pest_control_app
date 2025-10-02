export function parseJwt(token) {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64).split("").map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join("")
    );
    return JSON.parse(jsonPayload); // { id, role, iat, exp }
  } catch {
    return null;
  }
}

export function isExpired(token) {
  const p = parseJwt(token);
  if (!p?.exp) return true;
  return p.exp * 1000 <= Date.now();
}
