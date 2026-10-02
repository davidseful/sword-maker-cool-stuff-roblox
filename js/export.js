/* Studio file export: a Roblox model file (.rbxmx) holding the sword Script, and a tiny zip writer. */
(function (SF) {
  'use strict';

  const xmlText = (s) => String(s).replace(/[^\x09\x0A\x0D\x20-퟿-�]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const cdata = (s) => '<![CDATA[' + String(s).replace(/[^\x09\x0A\x0D\x20-퟿-�]/g, '').replace(/\]\]>/g, ']]]]><![CDATA[>') + ']]>';

  // One Script instance; drop it on ServerScriptService and it hands the sword to every player.
  SF.rbxmx = function (cfg) {
    const gen = SF.generate(cfg, 'script');
    const name = (gen.model.cfg.name || 'Sword') + ' (Sword Forge)';
    return '<roblox xmlns:xmime="http://www.w3.org/2005/05/xmlmime" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://www.roblox.com/roblox.xsd" version="4">\n' +
      '\t<Item class="Script" referent="RBX0">\n\t\t<Properties>\n' +
      '\t\t\t<string name="Name">' + xmlText(name) + '</string>\n' +
      '\t\t\t<ProtectedString name="Source">' + cdata(gen.code) + '</ProtectedString>\n' +
      '\t\t</Properties>\n\t</Item>\n</roblox>\n';
  };
  SF.rbxmxFileName = (cfg) => ((cfg.name || 'Sword').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'Sword') + '.rbxmx';

  /* store-only zip */
  let crcTable;
  function crc32(bytes) {
    if (!crcTable) { crcTable = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c >>> 0; } }
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]) & 255] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  SF.zip = function (files) {                       // files: [{ name, text }]
    const enc = new TextEncoder();
    const chunks = [], central = [];
    let offset = 0;
    files.forEach((f) => {
      const nm = enc.encode(f.name), data = enc.encode(f.text), crc = crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true);
      lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, nm.length, true);
      chunks.push(new Uint8Array(lh.buffer), nm, data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
      ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, nm.length, true); ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), nm);
      offset += 30 + nm.length + data.length;
    });
    const cSize = central.reduce((a, c) => a + c.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, cSize, true); end.setUint32(16, offset, true);
    const all = chunks.concat(central, [new Uint8Array(end.buffer)]);
    const out = new Uint8Array(all.reduce((a, c) => a + c.length, 0));
    let p = 0; all.forEach((c) => { out.set(c, p); p += c.length; });
    return out;
  };
})(globalThis.SF);
