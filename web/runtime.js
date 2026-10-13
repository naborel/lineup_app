// Runtime for the single-file app (Lineup.html, built by app.py).
// The page's data and code are embedded as text; this hands the data to the app, links the modules
// (each import → the blob URL of its target) and starts it. Same approach as Draftboard's shareable copy.
(function () {
  'use strict';
  const embedded = id => document.getElementById(id).textContent;
  window.LB_DATA = { catalog: JSON.parse(embedded('lb-catalog')), body: JSON.parse(embedded('lb-body')) };

  const MODS = JSON.parse(embedded('lb-modules'));
  const IMPORT = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])(\.{1,2}\/[^'"]+)\2/g;
  const resolve = (from, rel) => new URL(rel, 'http://local/' + from).pathname.slice(1);
  const urls = {};
  const link = path => {
    if (urls[path]) return urls[path];
    const src = MODS[path];
    if (src == null) throw new Error('Missing module ' + path);
    for (const m of src.matchAll(IMPORT)) link(resolve(path, m[3]));
    const out = src.replace(IMPORT, (all, kw, q, rel) => kw + q + urls[resolve(path, rel)] + q);
    return (urls[path] = URL.createObjectURL(new Blob([out], { type: 'text/javascript' })));
  };
  try {
    Object.keys(MODS).forEach(link);
    import(urls['js/app.js']).catch(fail);
  } catch (err) { fail(err); }
  function fail(err) {
    const view = document.getElementById('view');
    if (view) view.textContent = 'Lineup couldn’t start in this browser: ' + (err && err.message);
  }
})();
