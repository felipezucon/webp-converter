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
  const conversions = [];

  quality.addEventListener('input', () => { qualityValue.textContent = quality.value; });
  input.addEventListener('change', () => handleFiles(input.files));
  ['dragenter', 'dragover'].forEach(event => dropzone.addEventListener(event, e => { e.preventDefault(); dropzone.classList.add('dragging'); }));
  ['dragleave', 'drop'].forEach(event => dropzone.addEventListener(event, e => { e.preventDefault(); dropzone.classList.remove('dragging'); }));
  dropzone.addEventListener('drop', e => handleFiles(e.dataTransfer.files));
  dropzone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') input.click(); });
  clearButton.addEventListener('click', () => { conversions.splice(0); list.replaceChildren(); results.hidden = true; input.value = ''; });

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
  function formatSize(bytes) { return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(2)} MB`; }
  function escapeHtml(value) { return value.replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[char])); }
})();
