import { useEffect, useRef, useState } from 'react';
import { AlignCenter, AlignLeft, Bold, Heading2, Image as ImageIcon, Italic, Link as LinkIcon, List, ListOrdered, Quote, Redo2, Table2, Undo2 } from 'lucide-react';

type Props = { value: string; onChange: (html: string) => void; placeholder?: string; onUploadImage?: (file: File) => Promise<string> };

const btn = 'inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-paper hover:text-ink-900';

export default function RichTextEditor({ value, onChange, placeholder = 'Write the page content…', onUploadImage }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState('');
  const [showImage, setShowImage] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = value || '';
  }, [value]);

  const focus = () => ref.current?.focus();
  const command = (cmd: string, arg?: string) => { focus(); document.execCommand(cmd, false, arg); onChange(ref.current?.innerHTML || ''); };
  const insert = (html: string) => { focus(); document.execCommand('insertHTML', false, html); onChange(ref.current?.innerHTML || ''); };

  const addLink = () => {
    const href = window.prompt('Link URL', url || 'https://');
    if (!href) return;
    command('createLink', href);
    setUrl('');
  };

  const addImage = () => {
    if (!url.trim()) return;
    insert(`<figure class="my-6"><img src="${url.replace(/"/g, '&quot;')}" alt="" loading="lazy" class="w-full rounded-2xl border border-line" /><figcaption class="mt-2 text-xs text-slate-400">Image</figcaption></figure>`);
    setUrl(''); setShowImage(false);
  };

  const addTable = () => {
    const r = Math.max(1, Math.min(10, rows)); const c = Math.max(1, Math.min(8, cols));
    const head = Array.from({ length: c }, (_, i) => `<th class="border border-line bg-paper px-3 py-2 text-left text-xs font-bold">Header ${i + 1}</th>`).join('');
    const body = Array.from({ length: r }, () => `<tr>${Array.from({ length: c }, () => '<td class="border border-line px-3 py-2 text-sm">Cell</td>').join('')}</tr>`).join('');
    insert(`<div class="my-6 overflow-x-auto"><table class="w-full border-collapse"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`);
    setShowTable(false);
  };

  return <div className="overflow-hidden rounded-2xl border border-line bg-white">
    <div className="flex flex-wrap items-center gap-1 border-b border-line bg-white p-2">
      <button type="button" className={btn} onClick={() => command('undo')} title="Undo"><Undo2 size={15}/></button>
      <button type="button" className={btn} onClick={() => command('redo')} title="Redo"><Redo2 size={15}/></button>
      <span className="mx-1 h-5 w-px bg-line" />
      <button type="button" className={btn} onClick={() => command('formatBlock','h2')} title="Heading"><Heading2 size={15}/></button>
      <button type="button" className={btn} onClick={() => command('bold')} title="Bold"><Bold size={15}/></button>
      <button type="button" className={btn} onClick={() => command('italic')} title="Italic"><Italic size={15}/></button>
      <button type="button" className={btn} onClick={() => command('insertUnorderedList')} title="Bulleted list"><List size={15}/></button>
      <button type="button" className={btn} onClick={() => command('insertOrderedList')} title="Numbered list"><ListOrdered size={15}/></button>
      <button type="button" className={btn} onClick={() => command('formatBlock','blockquote')} title="Quote"><Quote size={15}/></button>
      <button type="button" className={btn} onClick={() => command('justifyLeft')} title="Align left"><AlignLeft size={15}/></button>
      <button type="button" className={btn} onClick={() => command('justifyCenter')} title="Align center"><AlignCenter size={15}/></button>
      <button type="button" className={btn} onClick={addLink} title="Link"><LinkIcon size={15}/></button>
      <button type="button" className={btn} onClick={() => setShowImage(v=>!v)} title="Add image by URL"><ImageIcon size={15}/></button>
      {onUploadImage && <><input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml" className="hidden" onChange={async e=>{ const file=e.target.files?.[0]; if(!file) return; setUploading(true); try { const imageUrl=await onUploadImage(file); insert(`<figure class="my-6"><img src="${imageUrl.replace(/"/g,'&quot;')}" alt="" loading="lazy" class="w-full rounded-2xl border border-line" /></figure>`); } finally { setUploading(false); e.currentTarget.value=''; } }} /><button type="button" className="ml-1 rounded-lg bg-paper px-2.5 py-1.5 text-[10px] font-bold text-slate-600" onClick={()=>fileRef.current?.click()} disabled={uploading}>{uploading?'Uploading…':'Upload image'}</button></>}
      <button type="button" className={btn} onClick={() => setShowTable(v=>!v)} title="Add table"><Table2 size={15}/></button>
    </div>
    {showImage && <div className="flex gap-2 border-b border-line bg-paper p-2"><input value={url} onChange={e=>setUrl(e.target.value)} placeholder="Image URL (https://…)" className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-white px-3 text-xs outline-none focus:border-emerald-500"/><button type="button" onClick={addImage} className="rounded-lg bg-ink-950 px-3 text-xs font-bold text-white">Insert</button></div>}
    {showTable && <div className="flex flex-wrap items-center gap-2 border-b border-line bg-paper p-2"><label className="text-xs font-semibold">Rows <input type="number" min="1" max="10" value={rows} onChange={e=>setRows(Number(e.target.value))} className="ml-1 h-8 w-14 rounded-lg border border-line px-2 text-xs"/></label><label className="text-xs font-semibold">Columns <input type="number" min="1" max="8" value={cols} onChange={e=>setCols(Number(e.target.value))} className="ml-1 h-8 w-14 rounded-lg border border-line px-2 text-xs"/></label><button type="button" onClick={addTable} className="rounded-lg bg-ink-950 px-3 py-2 text-xs font-bold text-white">Insert table</button></div>}
    <div ref={ref} contentEditable suppressContentEditableWarning onInput={()=>onChange(ref.current?.innerHTML || '')} data-placeholder={placeholder} className="min-h-[320px] p-5 text-[15px] leading-7 outline-none prose prose-slate max-w-none [&:empty]:before:text-slate-400 [&:empty]:before:content-[attr(data-placeholder)]" />
    <div className="border-t border-line bg-paper px-3 py-2 text-[10px] text-slate-400">Rich text • headings • lists • links • images • tables • quotes</div>
  </div>;
}
