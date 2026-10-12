import { useEffect, useRef, useState } from "react";
import { MAX_FILES, compressImage, kb } from "../lib/attach";
import { errorMessage } from "../lib/api";
import { fmtDateTime } from "../lib/format";
import Icon from "./Icon";

/**
 * Screenshots on a bug or suggestion.
 * New item: images wait in `pending` and upload right after the item is saved.
 * Existing item: images upload straight away. Anyone can add; only admin can delete.
 */
export default function Attachments({ api, type, item, isAdmin, myName, pending, setPending, onChanged }) {
  const [files, setFiles] = useState(item ? null : []);
  const [busy, setBusy] = useState(0);
  const [err, setErr] = useState("");
  const [view, setView] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const input = useRef(null);
  const itemId = item && item.id;

  useEffect(() => {
    if (!itemId) return;
    let live = true;
    api.files(type, itemId).then(
      (list) => live && setFiles(list || []),
      (e) => live && (setFiles([]), setErr(errorMessage(e))),
    );
    return () => { live = false; };
  }, [api, type, itemId]);

  const shown = item ? files || [] : pending;
  const room = MAX_FILES - shown.length;

  async function add(list) {
    const picked = [...list].filter((f) => /^image\//.test(f.type));
    if (!picked.length) return;
    setErr("");
    if (picked.length > room) setErr(`Up to ${MAX_FILES} images per item. Added the first ${Math.max(room, 0)}.`);
    for (const f of picked.slice(0, Math.max(room, 0))) {
      setBusy((n) => n + 1);
      try {
        const img = await compressImage(f);
        if (item) {
          const saved = await api.attach(type, item.id, img.name, img.data, myName);
          setFiles((o) => [...(o || []), { ...saved, data: img.data }]);
          onChanged();
        } else {
          setPending((o) => [...o, { id: `p${Date.now()}${Math.random()}`, ...img }]);
        }
      } catch (e) {
        setErr(e.message === "not_image" ? "That file isn't an image we can read." : errorMessage(e));
      } finally {
        setBusy((n) => n - 1);
      }
    }
  }

  // Paste a screenshot anywhere in the open sheet.
  const addRef = useRef(add);
  addRef.current = add;
  useEffect(() => {
    const onPaste = (e) => {
      const imgs = [...(e.clipboardData?.files || [])].filter((f) => /^image\//.test(f.type));
      if (imgs.length) {
        e.preventDefault();
        addRef.current(imgs);
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, []);

  // Escape closes the big view before it closes the sheet.
  useEffect(() => {
    if (!view) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setView(null);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [view]);

  async function remove(f) {
    if (!item) {
      setPending((o) => o.filter((x) => x.id !== f.id));
      return;
    }
    try {
      await api.removeFile(f.id);
      setFiles((o) => o.filter((x) => x.id !== f.id));
      setConfirmId(null);
      onChanged();
    } catch (e) {
      setErr(errorMessage(e));
    }
  }

  const canDelete = !item || isAdmin;

  return (
    <div className="attach" onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); if (room > 0) add(e.dataTransfer.files); }}>
      <div className="attach-hd">
        <span>Screenshots <span className="hint">{item ? "anyone can add" : "paste, drop or pick"} · up to {MAX_FILES}</span></span>
        {room > 0 && (
          <button className="btn sm" type="button" onClick={() => input.current.click()} disabled={busy > 0}>
            <Icon name="clip" />{busy ? "Adding…" : "Add image"}
          </button>
        )}
        <input ref={input} type="file" accept="image/*" multiple hidden
          onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
      </div>
      {err && <div className="form-err" role="alert">{err}</div>}
      {files === null ? (
        <small className="muted">Loading images…</small>
      ) : shown.length ? (
        <div className="thumbs">
          {shown.map((f) => (
            <figure key={f.id} className="thumb">
              <button type="button" className="thumb-img" onClick={() => setView(f)} aria-label={`View ${f.name}`}>
                <img src={f.data} alt="" loading="lazy" />
              </button>
              <figcaption>
                <span title={f.name}>{f.addedBy || (item ? "" : "Not uploaded yet")}</span>
                {canDelete && (confirmId === f.id ? (
                  <button type="button" className="link danger" onClick={() => remove(f)}>Delete?</button>
                ) : (
                  <button type="button" className="link" aria-label={`Remove ${f.name}`}
                    onClick={() => (item ? setConfirmId(f.id) : remove(f))}><Icon name="x" /></button>
                ))}
              </figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <button type="button" className="drop" onClick={() => input.current.click()} disabled={busy > 0}>
          <Icon name="clip" />
          {busy ? "Adding…" : "Add a screenshot: tap to pick, or paste or drop one here"}
        </button>
      )}

      {view && (
        <div className="lightbox" role="dialog" aria-label={view.name} onMouseDown={(e) => { e.stopPropagation(); setView(null); }}>
          <img src={view.data} alt={view.name} />
          <div className="lb-cap">
            {view.name}{view.data && ` · ${kb(view.data.length)}`}
            {view.addedBy && ` · ${view.addedBy}`}{view.createdAt && ` · ${fmtDateTime(view.createdAt)}`}
          </div>
        </div>
      )}
    </div>
  );
}
