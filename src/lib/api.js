// Talks to Supabase through the four passcode-checked functions in supabase/schema.sql.
// Plain fetch keeps the bundle small and works with both the older "anon" JWT keys
// and the newer "publishable" keys.

const URL_ = import.meta.env.VITE_SUPABASE_URL || "";
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export const isConfigured = Boolean(URL_ && KEY && !/YOUR-/.test(URL_ + KEY));

async function rpc(fn, args) {
  const headers = { apikey: KEY, "Content-Type": "application/json" };
  if (/^eyJ/.test(KEY)) headers.Authorization = "Bearer " + KEY; // legacy JWT anon key
  const res = await fetch(URL_.replace(/\/$/, "") + "/rest/v1/rpc/" + fn, {
    method: "POST",
    headers,
    body: JSON.stringify(args),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* not JSON */
  }
  if (!res.ok) {
    const err = new Error((json && json.message) || `Request failed (${res.status})`);
    err.code = (json && json.message) || String(res.status); // wrong_code, admin_only, bad_data…
    throw err;
  }
  return json;
}

const KIND = { bug: "bug", sugg: "suggestion" };

export function makeApi(code) {
  return {
    read: () => rpc("board_read", { p_code: code }),
    save: (type, id, data) => rpc("board_save", { p_code: code, p_kind: KIND[type], p_id: id || null, p_data: data }),
    saveRoast: (id, data) => rpc("board_save_roast", { p_code: code, p_id: id, p_data: data }),
    remove: (type, id) => rpc("board_delete", { p_code: code, p_kind: KIND[type] || "roast", p_id: id }),
  };
}

export function errorMessage(err) {
  switch (err.code) {
    case "admin_only":
      return "Only the admin passcode can change or delete existing items.";
    case "bad_data":
      return "That's too much text for one item. Shorten the notes and try again.";
    default:
      return `Couldn't reach the board. Check your connection and try again. (${err.message})`;
  }
}
