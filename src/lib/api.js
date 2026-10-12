// Talks to Supabase through the passcode-checked functions in supabase/*.sql.
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
    files: (type, id) => rpc("board_attachments", { p_code: code, p_kind: KIND[type], p_item: id }),
    attach: (type, id, name, data, by) =>
      rpc("board_attach", { p_code: code, p_kind: KIND[type], p_item: id, p_name: name, p_data: data, p_by: by || "" }),
    removeFile: (id) => rpc("board_delete_attachment", { p_code: code, p_id: id }),
    // roast admin (supabase/roast-admin.sql)
    saveRoasts: (rows, del = []) => rpc("board_save_roasts", { p_code: code, p_rows: rows, p_delete: del }),
    publish: (packs, notes, by) => rpc("board_publish_roasts", { p_code: code, p_packs: packs, p_notes: notes, p_by: by || "" }),
    releases: () => rpc("board_releases", { p_code: code }),
    releasePacks: (version) => rpc("board_release_packs", { p_code: code, p_version: version }),
    setLive: (version) => rpc("board_set_live", { p_code: code, p_version: version }),
  };
}

export function errorMessage(err) {
  switch (err.code) {
    case "admin_only":
      return "Only the admin passcode can change or delete existing items.";
    case "too_many":
      return "That item already has 8 images. Delete one first.";
    case "too_big":
    case "bad_image":
      return "That image couldn't be added. Try a PNG or JPEG screenshot.";
    case "bad_data":
      return "That's too much text for one item. Shorten the notes and try again.";
    case "bad_id":
      return "A roast id has characters that aren't allowed (letters, numbers and _ only).";
    case "not_found":
      return "That item no longer exists. Refresh and try again.";
    default:
      return `Couldn't reach the board. Check your connection and try again. (${err.message})`;
  }
}

/** Public, no passcode: what the app downloads (see supabase/roast-admin.sql). */
export const publicRoastUrls = () => {
  const base = URL_.replace(/\/$/, "") + "/rest/v1/rpc/";
  return { manifest: base + "roast_manifest", pack: (lang) => base + "roast_pack?p_lang=" + encodeURIComponent(lang) };
};

/** Turns a missing database function into a clear setup message. */
export const isMissingFn = (err) => /Could not find the function|PGRST202|404/.test(String(err && (err.message || err.code)));
