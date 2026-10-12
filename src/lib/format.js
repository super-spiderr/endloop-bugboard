import { CAT_LABEL, SCREENS } from "./constants";

export const DAY = 864e5;

export const find = (arr, v) => arr.find((a) => a[0] === v);
export const lbl = (arr, v) => (find(arr, v) || [null, v || "—"])[1];
export const col = (arr, v) => (find(arr, v) || arr[arr.length - 1])[2];

export const screenLbl = (v) => {
  const s = find(SCREENS, v);
  return s ? (s[0].startsWith("S") ? `${s[0]} · ${s[1]}` : s[1]) : "—";
};
export const catLbl = (c) => CAT_LABEL[c] || String(c || "").replace(/_/g, " ");

export const sevRank = { crash: 0, major: 1, minor: 2, polish: 3 };
export const isOpen = (s) => s !== "fixed" && s !== "wontfix";
export const sActive = (s) => s !== "done" && s !== "declined";
export const reviewOf = (r) => r.review || "unreviewed";

export const bid = (n) => "EL-" + String(n || 0).padStart(3, "0");
export const sid = (n) => "SG-" + String(n || 0).padStart(3, "0");
export const codeOf = (type, item) => (type === "bug" ? bid(item.num) : type === "roast" ? item.id : sid(item.num));

export const dayKey = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${x.getMonth() + 1}-${x.getDate()}`;
};
export function ago(iso) {
  if (!iso) return "";
  const d = Math.floor((Date.now() - new Date(iso)) / DAY);
  return d <= 0 ? "today" : d === 1 ? "1 day" : `${d} days`;
}
export const fmtDateTime = (iso) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
export const fmtDate = (iso) => new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });

/** Remove the fields the database owns before sending an item back. */
export const strip = (o) => {
  const c = { ...o };
  delete c.id;
  delete c.num;
  return c;
};

/* CSV export */
const cell = (v) => {
  v = String(v ?? "");
  return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
};
export function toCsv(rows, cols, sortKey = (r) => r.num || 0) {
  const sorted = [...rows].sort((a, b) => {
    const x = sortKey(a), y = sortKey(b);
    return typeof x === "string" ? x.localeCompare(y) : x - y;
  });
  return "﻿" + [cols.map((c) => c[0]).join(","), ...sorted.map((r) => cols.map((c) => cell(c[1](r))).join(","))].join("\r\n");
}
export function downloadFile(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
