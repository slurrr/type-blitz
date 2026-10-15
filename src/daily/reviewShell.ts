export const REVIEW_KINDS = {
  attempts: 'Passages — all attempts', collection: 'Collection reports', packs: 'Saved packs',
  sources: 'Source packets', state: 'Status, context & reviews'
} as const;
export type ReviewKind = keyof typeof REVIEW_KINDS;
export interface ReviewFile { key: string; label: string; modified: number }
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
export const REVIEW_SCRIPT = `document.querySelectorAll('select').forEach(select => {
  select.addEventListener('change', () => {
    if (select.name !== 'file') document.querySelector('[name="file"]').value = '';
    select.form.requestSubmit();
  });
});`;

export function renderReviewPage(archive: string, kind: ReviewKind, files: ReviewFile[], selected?: string): string {
  const query = (file: string) => new URLSearchParams({ archive, kind, file }).toString();
  const index = files.findIndex(f => f.key === selected);
  const neighbor = (offset: number, label: string) => {
    const file = files[index + offset];
    return file ? `<a href="/?${escape(query(file.key))}">${label}</a>` : `<span aria-disabled="true">${label}</span>`;
  };
  const option = (value: string, label: string, chosen: string) => `<option value="${escape(value)}"${value === chosen ? ' selected' : ''}>${escape(label)}</option>`;
  const view = selected ? '/view?' + query(selected) : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Type-Blitz review</title>
<style>
:root{color-scheme:light dark;font-family:system-ui,sans-serif;line-height:1.5}
*{box-sizing:border-box}body{margin:0;height:100dvh;display:flex;flex-direction:column}
header{padding:1rem 1.25rem;border-bottom:1px solid #8885}h1{font-size:1.15rem;margin:0}
.top{display:flex;align-items:baseline;gap:1rem;flex-wrap:wrap;margin-bottom:.75rem}.muted, [aria-disabled]{opacity:.6;font-size:.85rem}
.pickers{display:grid;grid-template-columns:170px 220px minmax(180px,1fr);gap:.75rem}
label{font-size:.8rem}select{display:block;width:100%;padding:.5rem;font:inherit;font-size:.9rem;margin-top:.2rem}
.controls{display:flex;gap:1rem;align-items:center;flex-wrap:wrap;margin-top:.75rem;font-size:.85rem}
button{font:inherit;padding:.3rem .7rem;cursor:pointer}a{color:light-dark(#135bb0,#90bdff)}
main{flex:1;min-height:0}iframe{border:0;width:100%;height:100%;display:block}.empty{padding:2rem}
@media(max-width:760px){.pickers{grid-template-columns:1fr 1fr}.file{grid-column:1/-1}.top{gap:.4rem}}
</style><script src="/review.js" defer></script></head><body>
<header><div class="top"><h1>Type-Blitz review</h1><span class="muted">Saved data only · no generation or edits</span></div>
<form action="/" method="get"><div class="pickers">
<label>Archive<select name="archive">${option('daily', 'Daily game', archive)}${option('preview', 'Voice experiments', archive)}</select></label>
<label>Saved data<select name="kind">${Object.entries(REVIEW_KINDS).map(([key, label]) => option(key, label, kind)).join('')}</select></label>
<label class="file">Record · ${files.length} available<select name="file"><option value="">${files.length ? 'Choose a saved record' : 'No saved records'}</option>${files.map(f => option(f.key, f.label, selected ?? '')).join('')}</select></label>
</div><div class="controls"><button type="submit">Reload list / open</button>
${index >= 0 ? neighbor(-1, '← Newer') + neighbor(1, 'Older →') : ''}
${view ? `<a href="${escape(view)}" target="_blank" rel="noopener">Open full view</a><a href="${escape(view + '&raw=1')}" target="_blank" rel="noopener">Saved JSON</a>` : ''}
</div></form></header>
<main>${view ? `<iframe title="Selected saved record" sandbox="allow-same-origin" src="${escape(view)}"></iframe>` : '<p class="empty">No saved files in this category. Choose another category or archive.</p>'}</main>
</body></html>`;
}
