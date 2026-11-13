import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Highlighter, MousePointer2, PenLine, Undo2, Trash2, Save, Check, Minus, Square, Eraser, Baseline, Palette, Type } from "lucide-react";
import { useModalDialog } from "../hooks/useModalDialog";
import { uncoveredRegions } from "../utils/highlightRegions";

function ClearConfirmation({ onCancel, onConfirm }) {
  const dialog = useRef(null);
  useModalDialog(dialog);
  return createPortal(<dialog ref={dialog} className="paper-confirm" aria-labelledby="paper-clear-title" aria-describedby="paper-clear-description" onCancel={event => { event.preventDefault(); event.stopPropagation(); onCancel(); }}>
    <h3 id="paper-clear-title">Clear page marks?</h3>
    <p id="paper-clear-description">Only marks on this page will be cleared. Save again to update your saved notes.</p>
    <div><button type="button" autoFocus onClick={onCancel}>Keep marks</button><button type="button" onClick={onConfirm}>Clear this page</button></div>
  </dialog>, document.body);
}

function restoreMarks(key) {
  try {
    const data = JSON.parse(localStorage.getItem(key));
    if (data?.version !== 1 || !data.pages || typeof data.pages !== "object") return {};
    const valid = Object.entries(data.pages).every(([page, strokes]) => /^\d+$/.test(page) && Array.isArray(strokes) && strokes.every(mark => ["pen", "highlight", "line", "rectangle", "text", "note"].includes(mark.tool) && (mark.tool !== "note" || (typeof mark.text === "string" && mark.text.length <= 500 && Number.isFinite(mark.fontSize) && mark.fontSize > 0 && mark.fontSize <= 100)) && (!mark.color || /^#[0-9a-f]{6}$/i.test(mark.color)) && Array.isArray(mark.points) && mark.points.length >= 2 && mark.points.every(point => Array.isArray(point) && point.length === 2 && point.every(n => Number.isFinite(n) && n >= 0 && n <= 1000))));
    return valid ? data.pages : {};
  } catch { return {}; }
}

// Store normalized page coordinates so strokes stay aligned at every zoom level.
export default function PdfAnnotations({ page, width, height, children, storageKey, toolbarHost }) {
  const [tool, setTool] = useState("read");
  const [note, setNote] = useState(null);
  const [color, setColor] = useState(null);
  const [colorsOpen, setColorsOpen] = useState(false);
  const pageElement = useRef(null);
  const [history, setHistory] = useState({});
  const [marks, setMarks] = useState(() => restoreMarks(storageKey));
  const [confirmClear, setConfirmClear] = useState(false);
  const [status, setStatus] = useState(() => Object.keys(marks).length ? "Saved marks restored" : "Save marks to keep them");
  useEffect(() => {
    if (status !== "Saved on this browser") return;
    const timer = setTimeout(() => setStatus(""), 1800);
    return () => clearTimeout(timer);
  }, [status]);
  const [draft, setDraft] = useState(null);
  const stroke = useRef(null);
  const current = marks[page] || [];
  function updatePage(next) {
    setHistory(value => ({ ...value, [page]: [...(value[page] || []).slice(-49), current] }));
    setMarks(value => ({ ...value, [page]: next }));
    setStatus("Unsaved changes");
  }
  function point(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    return [Math.max(0, Math.min(1000, (event.clientX - rect.left) / rect.width * 1000)), Math.max(0, Math.min(1000, (event.clientY - rect.top) / rect.height * 1000))];
  }
  function finish() {
    if (!stroke.current) return;
    const completed = stroke.current;
    updatePage([...current, completed]);
    stroke.current = null;
    setDraft(null);
  }
  function highlightSelection() {
    const selection = window.getSelection();
    if (!selection?.rangeCount || selection.isCollapsed) return;
    const range = selection.getRangeAt(0);
    const root = pageElement.current;
    if (!root?.contains(range.startContainer) || !root.contains(range.endContainer)) return;
    const box = root.getBoundingClientRect();
    const normalize = (x, y) => [Math.max(0, Math.min(1000, (x - box.left) / box.width * 1000)), Math.max(0, Math.min(1000, (y - box.top) / box.height * 1000))];
    const rects = Array.from(range.getClientRects()).filter(rect => rect.width > 1 && rect.height > 1);
    // Text spans can report duplicate rectangles; only paint each region once.
    const seen = new Set();
    const selected = rects.filter(rect => {
      const key = [rect.x, rect.y, rect.width, rect.height].map(Math.round).join();
      if (seen.has(key)) return false;
      seen.add(key); return true;
    }).map(rect => ({ tool: "text", color: color || "#f3c637", points: [normalize(rect.left, rect.top), normalize(rect.right, rect.bottom)] }));
    const coverage = current.filter(mark => mark.tool === "text").map(mark => mark.points);
    const additions = [];
    for (const mark of selected) {
      const regions = uncoveredRegions(mark.points, coverage);
      additions.push(...regions.map(points => ({ ...mark, points })));
      coverage.push(...regions);
    }
    if (additions.length) updatePage([...current, ...additions]);
    selection.removeAllRanges();
  }
  const selectionAction = useRef(null);
  useLayoutEffect(() => { selectionAction.current = highlightSelection; });
  useEffect(() => {
    if (tool !== "text") return;
    let timer;
    let dragging = false;
    const schedule = () => {
      clearTimeout(timer);
      if (!dragging) timer = setTimeout(() => selectionAction.current(), 350);
    };
    const start = event => {
      if (!pageElement.current?.contains(event.target)) return;
      dragging = true;
      clearTimeout(timer);
    };
    const end = () => { dragging = false; schedule(); };
    document.addEventListener("selectionchange", schedule);
    document.addEventListener("pointerdown", start);
    document.addEventListener("pointerup", end);
    document.addEventListener("pointercancel", end);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("selectionchange", schedule);
      document.removeEventListener("pointerdown", start);
      document.removeEventListener("pointerup", end);
      document.removeEventListener("pointercancel", end);
    };
  }, [tool, page]);
  const toolbar = <>
    <div className="paper-mark-tools-shell">
    <div className="paper-mark-tools" role="group" aria-label="Annotation tools">
      {[["read", "Select text", MousePointer2], ["pen", "Draw", PenLine], ["highlight", "Freehand highlight", Highlighter], ["text", "Text highlight", Baseline], ["note", "Text box", Type], ["line", "Straight line", Minus], ["rectangle", "Rectangle", Square], ["eraser", "Erase a mark", Eraser]].map(([value, label, icon]) => <button key={value} type="button" title={label} aria-label={label} aria-pressed={tool === value} onClick={() => { setTool(value); setColorsOpen(false); }}>{React.createElement(icon)}</button>)}
      <span className="paper-tool-divider" />
      <button type="button" title="Undo last change" aria-label="Undo last change" disabled={!history[page]?.length} onClick={() => {
        setMarks(value => ({ ...value, [page]: history[page].at(-1) }));
        setHistory(value => ({ ...value, [page]: value[page].slice(0, -1) }));
        setStatus("Unsaved changes");
      }}><Undo2 /></button>
      <button type="button" title="Clear marks on this page" aria-label="Clear marks on this page" disabled={!current.length} onClick={() => setConfirmClear(true)}><Trash2 /></button>
      <button type="button" title="Save marks to this browser" aria-label="Save marks" onClick={() => {
        try { localStorage.setItem(storageKey, JSON.stringify({ version: 1, pages: marks })); setStatus("Saved on this browser"); }
        catch { setStatus("Could not save — browser storage is unavailable or full"); }
      }}>{status === "Saved on this browser" ? <Check /> : <Save />}</button>
      {status.startsWith("Could not save") && <small role="alert">{status}</small>}
      <button type="button" title="Ink color" aria-label="Ink color" aria-expanded={colorsOpen} onClick={() => setColorsOpen(value => !value)}><Palette style={{ color: color || undefined }} /></button>
    </div>
      {colorsOpen && <div className="paper-ink-colors" role="group" aria-label="Choose ink color">
        {[[null, "Default"], ["#6154cc", "Purple"], ["#d94660", "Red"], ["#25856b", "Green"], ["#f3c637", "Yellow"]].map(([value, label]) => <button key={label} type="button" title={label} aria-label={`${label} ink`} aria-pressed={color === value} onClick={() => { setColor(value); setColorsOpen(false); }}><i style={{ background: value || "linear-gradient(135deg, #6154cc 50%, #f3c637 50%)" }} /></button>)}
      </div>}
    </div>
  </>;
  return <>
    {toolbarHost && createPortal(toolbar, toolbarHost)}
    {confirmClear && <ClearConfirmation onCancel={() => setConfirmClear(false)} onConfirm={() => { updatePage([]); setConfirmClear(false); }} />}
    <div ref={pageElement} className={`paper-annotated-page${tool === "text" ? " is-text-highlighting" : ""}`} style={{ width, height, "--ink-selection": color || "#f3c637" }}>
      {children}
      <svg className={`paper-ink-layer${["read", "text"].includes(tool) ? " is-reading" : ""}`} viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-label="Page annotation canvas"
        onPointerDown={event => {
          if (event.button !== 0 || stroke.current || tool === "read" || tool === "eraser") return;
          if (tool === "note") {
            event.preventDefault();
            const p = point(event);
            setNote({ page, position: [Math.min(p[0], Math.max(0, 1000 - 220 / width * 1000)), Math.min(p[1], Math.max(0, 1000 - 180 / height * 1000))], text: "" });
            return;
          }
          event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
          const p = point(event);
          stroke.current = { tool, color: color || (tool === "highlight" ? "#f3c637" : "#6154cc"), points: [p, p] };
          setDraft(stroke.current);
        }}
        onPointerMove={event => {
          if (!stroke.current) return;
          stroke.current = { ...stroke.current, points: ["line", "rectangle"].includes(stroke.current.tool) ? [stroke.current.points[0], point(event)] : [...stroke.current.points, point(event)] };
          setDraft(stroke.current);
        }}
        onPointerUp={finish} onPointerCancel={() => { stroke.current = null; setDraft(null); }}>
        {[...current, ...(draft ? [draft] : [])].map((mark, index) => {
          const [start, end] = mark.points;
          if (mark.tool === "note") return <foreignObject key={index} x={start[0]} y={start[1]} width={end[0] - start[0]} height={end[1] - start[1]} pointerEvents={tool === "eraser" ? "all" : "none"} onPointerDown={event => { if (tool !== "eraser") return; event.stopPropagation(); event.preventDefault(); updatePage(current.filter((_, i) => i !== index)); }}><div style={{ color: mark.color, fontSize: mark.fontSize, lineHeight: 1.4, whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontFamily: "Arial, sans-serif" }}>{mark.text}</div></foreignObject>;
          if (mark.tool === "text") return <rect key={index} x={start[0]} y={start[1]} width={end[0] - start[0]} height={end[1] - start[1]} fill={mark.color || "#f3c637"} fillOpacity={.3} pointerEvents={tool === "eraser" ? "all" : "none"} onPointerDown={event => { if (tool !== "eraser") return; event.stopPropagation(); event.preventDefault(); updatePage(current.filter((_, i) => i !== index)); }} />;
          const points = (mark.tool === "rectangle" ? [start, [end[0], start[1]], end, [start[0], end[1]], start] : mark.points).map(p => p.join(",")).join(" ");
          return <g key={index}>
            <polyline points={points} fill="none" stroke={mark.color || (mark.tool === "highlight" ? "#f3c637" : "#6154cc")} strokeOpacity={mark.tool === "highlight" ? .32 : .9} strokeWidth={mark.tool === "highlight" ? 18 : 2.5} strokeLinecap="round" strokeLinejoin="round" />
            {tool === "eraser" && <polyline points={points} fill="none" stroke="transparent" strokeWidth={24} pointerEvents="stroke" style={{ cursor: "pointer" }} onPointerDown={event => { event.stopPropagation(); event.preventDefault(); updatePage(current.filter((_, i) => i !== index)); }} />}
          </g>;
        })}
      </svg>
      {note?.page === page && <form className="paper-note-editor" style={{ left: `${note.position[0] / 10}%`, top: `${note.position[1] / 10}%` }} onSubmit={event => {
        event.preventDefault();
        if (!note.text.trim()) return;
        const [x, y] = note.position;
        updatePage([...current, { tool: "note", text: note.text.trim(), color: color || "#6154cc", fontSize: 14 / width * 1000, points: [[x, y], [Math.min(1000, x + 210 / width * 1000), 1000]] }]);
        setNote(null);
      }} onKeyDown={event => { event.stopPropagation(); if (event.key === "Escape") { event.preventDefault(); setNote(null); } }}>
        <textarea autoFocus aria-label="Annotation text" placeholder="Write a note…" maxLength={500} value={note.text} onChange={event => setNote(value => ({ ...value, text: event.target.value }))} />
        <div><button type="button" onClick={() => setNote(null)}>Cancel</button><button type="submit" disabled={!note.text.trim()}>Add note</button></div>
      </form>}
    </div>
  </>;
}
