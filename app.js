(() => {
  'use strict';
  const input = document.querySelector('#file-input');
  const dropzone = document.querySelector('#dropzone');
  const quality = document.querySelector('#quality');
  const qualityValue = document.querySelector('#quality-value');
  const maxWidth = document.querySelector('#max-width');
  const results = document.querySelector('#results');
  const list = document.querySelector('#file-list');
  const summary = document.querySelector('#summary');
  const clearButton = document.querySelector('#clear-button');
  const downloadAllButton = document.querySelector('#download-all');
  const conversions = [];

  quality.addEventListener('input', () => { qualityValue.textContent = quality.value; });
  input.addEventListener('change', () => handleFiles(input.files));
  ['dragenter', 'dragover'].forEach(event => dropzone.addEventListener(event, e => { e.preventDefault(); dropzone.classList.add('dragging'); }));
  ['dragleave', 'drop'].forEach(event => dropzone.addEventListener(event, e => { e.preventDefault(); dropzone.classList.remove('dragging'); }));
  dropzone.addEventListener('drop', e => handleFiles(e.dataTransfer.files));
  dropzone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') input.click(); });
  clearButton.addEventListener('click', () => { conversions.splice(0); list.replaceChildren(); results.hidden = true; input.value = ''; });
  downloadAllButton.addEventListener('click', downloadAllZip);

  async function handleFiles(files) {
    const valid = [...files].filter(file => /image\/(png|jpeg)/.test(file.type) || /\.(png|jpe?g)$/i.test(file.name));
    if (!valid.length) return;
    for (const file of valid) {
      try { await convert(file); } catch (error) { console.error('Falha ao converter', file.name, error); }
    }
    render();
  }

  async function convert(file) {
    const bitmap = await createImageBitmap(file);
    const limit = Number(maxWidth.value);
    const scale = limit && bitmap.width > limit ? limit / bitmap.width : 1;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', Number(quality.value) / 100));
    if (!blob) throw new Error('Seu navegador não conseguiu criar WebP.');
    const name = file.name.replace(/\.(png|jpe?g)$/i, '') + '.webp';
    conversions.push({ name, blob, originalSize: file.size, width: canvas.width, height: canvas.height, url: URL.createObjectURL(blob) });
  }

  function render() {
    results.hidden = false;
    summary.textContent = `${conversions.length} imagem${conversions.length === 1 ? '' : 'ns'} convertida${conversions.length === 1 ? '' : 's'}`;
    list.replaceChildren(...conversions.map(item => {
      const card = document.createElement('article'); card.className = 'file-card';
      const image = document.createElement('img'); image.className = 'thumb'; image.src = item.url; image.alt = '';
      const info = document.createElement('div'); info.innerHTML = `<div class="file-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div><div class="file-meta">${item.width} × ${item.height} · ${formatSize(item.originalSize)} → <span class="saved">${formatSize(item.blob.size)} (${Math.round((1 - item.blob.size / item.originalSize) * 100)}% menor)</span></div>`;
      const link = document.createElement('a'); link.className = 'button primary download'; link.href = item.url; link.download = item.name; link.textContent = 'Baixar';
      card.append(image, info, link); return card;
    }));
  }

  async function downloadAllZip() {
    if (!conversions.length) return;
    const zipBlob = await createZip(conversions);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(zipBlob);
    link.download = `imagens-webp-${new Date().toISOString().slice(0, 10)}.zip`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 10000);
  }

  async function createZip(items) {
    const encoder = new TextEncoder();
    const crcTable = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      crcTable[i] = c;
    }
    function getCrc32(buf) {
      let crc = 0xFFFFFFFF;
      for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xFF];
      return (crc ^ 0xFFFFFFFF) >>> 0;
    }

    const filesData = [];
    let offset = 0;

    for (const item of items) {
      const arrayBuf = await item.blob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuf);
      const nameBytes = encoder.encode(item.name);
      const crc = getCrc32(bytes);
      const size = bytes.length;

      // Local File Header (30 bytes + filename)
      const header = new Uint8Array(30 + nameBytes.length);
      const view = new DataView(header.buffer);
      view.setUint32(0, 0x04034b50, true); // Local file header signature
      view.setUint16(4, 20, true);         // Version needed
      view.setUint16(6, 0, true);          // General purpose bit flag
      view.setUint16(8, 0, true);          // Compression method (0 = Store)
      view.setUint16(10, 0, true);         // File last modification time
      view.setUint16(12, 0, true);         // File last modification date
      view.setUint32(14, crc, true);       // CRC-32
      view.setUint32(18, size, true);      // Compressed size
      view.setUint32(22, size, true);      // Uncompressed size
      view.setUint16(26, nameBytes.length, true); // Filename length
      view.setUint16(28, 0, true);         // Extra field length
      header.set(nameBytes, 30);

      filesData.push({ nameBytes, bytes, crc, size, offset, header });
      offset += header.length + size;
    }

    // Central Directory Records
    const cdParts = [];
    let cdSize = 0;

    for (const f of filesData) {
      const cdHeader = new Uint8Array(46 + f.nameBytes.length);
      const view = new DataView(cdHeader.buffer);
      view.setUint32(0, 0x02014b50, true); // Central directory header signature
      view.setUint16(4, 20, true);         // Version made by
      view.setUint16(6, 20, true);         // Version needed
      view.setUint16(8, 0, true);          // General purpose bit flag
      view.setUint16(10, 0, true);         // Compression method (0 = Store)
      view.setUint16(12, 0, true);         // File last modification time
      view.setUint16(14, 0, true);         // File last modification date
      view.setUint32(16, f.crc, true);     // CRC-32
      view.setUint32(20, f.size, true);    // Compressed size
      view.setUint32(24, f.size, true);    // Uncompressed size
      view.setUint16(28, f.nameBytes.length, true); // Filename length
      view.setUint16(30, 0, true);         // Extra field length
      view.setUint16(32, 0, true);         // File comment length
      view.setUint16(34, 0, true);         // Disk number start
      view.setUint16(36, 0, true);         // Internal file attributes
      view.setUint32(38, 0, true);         // External file attributes
      view.setUint32(42, f.offset, true);  // Relative offset of local header
      cdHeader.set(f.nameBytes, 46);

      cdParts.push(cdHeader);
      cdSize += cdHeader.length;
    }

    // End of Central Directory Record (22 bytes)
    const eocd = new Uint8Array(22);
    const eocdView = new DataView(eocd.buffer);
    eocdView.setUint32(0, 0x06054b50, true); // End of central directory signature
    eocdView.setUint16(4, 0, true);          // Number of this disk
    eocdView.setUint16(6, 0, true);          // Disk where central directory starts
    eocdView.setUint16(8, filesData.length, true);  // Number of central directory records on this disk
    eocdView.setUint16(10, filesData.length, true); // Total number of central directory records
    eocdView.setUint32(12, cdSize, true);    // Size of central directory
    eocdView.setUint32(16, offset, true);    // Offset of start of central directory
    eocdView.setUint16(20, 0, true);         // ZIP comment length

    const finalParts = [];
    for (const f of filesData) {
      finalParts.push(f.header);
      finalParts.push(f.bytes);
    }
    finalParts.push(...cdParts);
    finalParts.push(eocd);

    return new Blob(finalParts, { type: 'application/zip' });
  }

  function formatSize(bytes) { return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(2)} MB`; }
  function escapeHtml(value) { return value.replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[char])); }
})();
