/* boot.js - asks the server which version of the garden is the newest, every time, so a
 * page kept by the browser never shows an old one; then loads that version. */
const V = 10;   // used only if the question cannot be asked
fetch('version.json', { cache: 'no-store' })
  .then(function (r) { return r.ok ? r.json() : { v: V }; })
  .catch(function () { return { v: V }; })
  .then(function (o) {
    const v = (o && o.v) || V, css = document.getElementById('css');
    if (css && css.getAttribute('href') !== 'css/style.css?v=' + v) css.setAttribute('href', 'css/style.css?v=' + v);
    return import('./main.js?v=' + v);
  });
