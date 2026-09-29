(() => {
  function parse(text) {
    const source = String(text).replace(/^\uFEFF/, '');
    const firstLine = source.split(/\r?\n/, 1)[0];
    const separator = /^sep=([,;\t])$/i.exec(firstLine)?.[1];
    const body = separator ? source.slice(firstLine.length).replace(/^\r?\n/, '') : source;
    const delimiter = separator || ([',', '\t', ';'].sort((a, b) =>
      (firstLine.split(b).length - 1) - (firstLine.split(a).length - 1))[0]);
    const rows = [];
    let row = [], field = '', quoted = false;
    for (let i = 0; i < body.length; i++) {
      const c = body[i];
      if (c === '"') {
        if (quoted && body[i + 1] === '"') { field += '"'; i++; }
        else if (!field || quoted) quoted = !quoted;
        else field += c;
      } else if (c === delimiter && !quoted) {
        row.push(field); field = '';
      } else if ((c === '\n' || c === '\r') && !quoted) {
        if (c === '\r' && body[i + 1] === '\n') i++;
        row.push(field); field = '';
        if (row.some(value => value.trim())) rows.push(row);
        row = [];
      } else field += c;
    }
    row.push(field);
    if (row.some(value => value.trim())) rows.push(row);
    return rows;
  }

  async function read(file) {
    const bytes = await file.arrayBuffer();
    let text;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch { text = new TextDecoder('euc-kr').decode(bytes); }
    return parse(text);
  }

  window.VocabCsv = { parse, read };
})();
