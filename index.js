const fmt = (n) => (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);

function rowTemplate(prefix, id){
  return `
    <tr data-id="${id}">
      <td class="mini"><input data-k="desc" placeholder="Ex: Arbete / Vara" /></td>
      <td class="mini"><input data-k="qty" type="number" step="1" min="0" value="1" /></td>
      <td class="mini"><input data-k="price" type="number" step="0.01" min="0" value="0" /></td>
      <td class="mini"><input data-k="vat" type="number" step="0.01" min="0" value="25" /></td>
      <td class="right">
        <button class="btn btn-danger" data-action="remove" title="Ta bort rad">Ta bort</button>
      </td>
    </tr>
  `;
}

function calcLines(tbody){
  const rows = [...tbody.querySelectorAll("tr")];
  let sub = 0, vat = 0;

  for (const r of rows){
    const get = (k) => r.querySelector(`[data-k="${k}"]`)?.value;
    const qty = Number(get("qty") || 0);
    const price = Number(get("price") || 0);
    const vatPct = Number(get("vat") || 0);

    const line = qty * price;
    sub += line;
    vat += line * (vatPct / 100);
  }
  return { sub, vat, total: sub + vat };
}

function wireLines(prefix, tbody, subEl, vatEl, totalEl){
  const recalc = () => {
    const { sub, vat, total } = calcLines(tbody);
    subEl.textContent = fmt(sub);
    vatEl.textContent = fmt(vat);
    totalEl.textContent = fmt(total);
  };

  const addLine = () => {
    const id = crypto.randomUUID();
    tbody.insertAdjacentHTML("beforeend", rowTemplate(prefix, id));
    recalc();
  };

  tbody.addEventListener("input", recalc);
  tbody.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    if (btn.dataset.action === "remove"){
      btn.closest("tr")?.remove();
      recalc();
    }
  });

  return { addLine, recalc };
}

function openModal(backdrop){ backdrop.classList.add("show"); }
function closeModal(backdrop){ backdrop.classList.remove("show"); }

// Receipt
const receiptBackdrop = document.getElementById("receiptBackdrop");
const r_lines = document.getElementById("r_lines");
const rWire = wireLines("r", r_lines,
  document.getElementById("r_sub"),
  document.getElementById("r_vat"),
  document.getElementById("r_total")
);

// Offer
const offerBackdrop = document.getElementById("offerBackdrop");
const o_lines = document.getElementById("o_lines");
const oWire = wireLines("o", o_lines,
  document.getElementById("o_sub"),
  document.getElementById("o_vat"),
  document.getElementById("o_total")
);

// Defaults
document.getElementById("year").textContent = new Date().getFullYear();
document.getElementById("r_date").valueAsDate = new Date();
document.getElementById("o_date").valueAsDate = new Date();

// Open/close buttons
const openReceiptBtns = ["openReceipt","openReceipt2"].map(id => document.getElementById(id));
openReceiptBtns.forEach(b => b.addEventListener("click", () => openModal(receiptBackdrop)));
document.getElementById("closeReceipt").addEventListener("click", () => closeModal(receiptBackdrop));

const openOfferBtns = ["openOffer","openOffer2"].map(id => document.getElementById(id));
openOfferBtns.forEach(b => b.addEventListener("click", () => openModal(offerBackdrop)));
document.getElementById("closeOffer").addEventListener("click", () => closeModal(offerBackdrop));

// Close on backdrop click
receiptBackdrop.addEventListener("click", (e) => { if (e.target === receiptBackdrop) closeModal(receiptBackdrop); });
offerBackdrop.addEventListener("click", (e) => { if (e.target === offerBackdrop) closeModal(offerBackdrop); });

// Add line
document.getElementById("r_addLine").addEventListener("click", rWire.addLine);
document.getElementById("o_addLine").addEventListener("click", oWire.addLine);

// Start with one line each
rWire.addLine();
oWire.addLine();

// Reset
document.getElementById("r_reset").addEventListener("click", () => {
  document.getElementById("r_store").value = "";
  document.getElementById("r_note").value = "";
  document.getElementById("r_pay").value = "Kort";
  document.getElementById("r_currency").value = "SEK";
  document.getElementById("r_date").valueAsDate = new Date();
  r_lines.innerHTML = "";
  rWire.addLine();
  rWire.recalc();
});

document.getElementById("o_reset").addEventListener("click", () => {
  document.getElementById("o_company").value = "";
  document.getElementById("o_no").value = "";
  document.getElementById("o_customer").value = "";
  document.getElementById("o_terms").value = "";
  document.getElementById("o_date").valueAsDate = new Date();
  o_lines.innerHTML = "";
  oWire.addLine();
  oWire.recalc();
});

function readImageAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ============================
// ✅ IndexedDB (NEW)
// ============================
const DB_NAME = "skapa-offert-db";
const DB_VERSION = 1;
const STORE_NAME = "pdfs";

function openPdfDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("by_type", "type", { unique: false });
        store.createIndex("by_createdAt", "createdAt", { unique: false });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function safeId() {
  return (crypto?.randomUUID?.() || String(Date.now()) + "_" + Math.random().toString(16).slice(2));
}

async function savePdfRecord(record) {
  const db = await openPdfDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE_NAME).put(record);
  });
}

// PDF export helpers
function getLineData(tbody){
  const rows = [...tbody.querySelectorAll("tr")];
  return rows.map(r => {
    const get = (k) => r.querySelector(`[data-k="${k}"]`)?.value || "";
    return {
      desc: get("desc"),
      qty: Number(get("qty") || 0),
      price: Number(get("price") || 0),
      vat: Number(get("vat") || 0),
    };
  });
}

function pdfHeader(doc, title){
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(title, 14, 18);

  doc.setDrawColor(200);
  doc.setLineWidth(0.2);
  doc.line(14, 22, 196, 22);
}

function pdfLines(doc, lines, startY){
  let y = startY;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Beskrivning", 14, y);
  doc.text("Antal", 120, y);
  doc.text("Pris", 145, y);
  doc.text("Moms", 170, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  for (const l of lines){
    if (y > 270) { doc.addPage(); y = 20; }
    doc.text(String(l.desc || "-"), 14, y, { maxWidth: 100 });
    doc.text(String(l.qty), 120, y);
    doc.text(fmt(l.price), 145, y);
    doc.text(fmt(l.vat) + "%", 170, y);
    y += 6;
  }
  return y + 4;
}

function pdfTotals(doc, totals, y, currency){
  doc.setFont("helvetica", "bold");
  doc.text("Subtotal:", 130, y); doc.text(fmt(totals.sub) + " " + currency, 170, y);
  y += 6;
  doc.text("Moms:", 130, y); doc.text(fmt(totals.vat) + " " + currency, 170, y);
  y += 8;
  doc.setFontSize(12);
  doc.text("Total:", 130, y); doc.text(fmt(totals.total) + " " + currency, 170, y);
}

// Receipt PDF
document.getElementById("r_pdf").addEventListener("click", async () => {
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) return alert("jsPDF laddades inte. Kontrollera CDN-länken.");

  const store = document.getElementById("r_store").value.trim() || "—";
  const date = document.getElementById("r_date").value || "—";
  const pay = document.getElementById("r_pay").value;
  const currency = document.getElementById("r_currency").value;
  const note = document.getElementById("r_note").value.trim();

  const lines = getLineData(r_lines);
  const totals = calcLines(r_lines);

  const doc = new jsPDF({ unit: "mm", format: "a4" });

  pdfHeader(doc, "KVITTO");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`Butik/Företag: ${store}`, 14, 32);
  doc.text(`Datum: ${date}`, 14, 38);
  doc.text(`Betalmetod: ${pay}`, 14, 44);

  let y = 56;
  y = pdfLines(doc, lines, y);

  pdfTotals(doc, totals, y, currency);

  if (note){
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Notering:", 14, 282);
    doc.text(note, 14, 288, { maxWidth: 180 });
  }

  // ✅ Save to IndexedDB instead of downloading
  const blob = doc.output("blob");
  const fileName = `kvitto_${date || "datum"}.pdf`;

  await savePdfRecord({
    id: safeId(),
    type: "receipt",
    title: `${store} (${date || "datum"})`,
    fileName,
    createdAt: Date.now(),
    meta: { store, date, pay, currency, totals },
    blob
  });

  window.location.assign(' https://gjoshi99.github.io/offert/data.html')
});

// Offer PDF
document.getElementById("o_pdf").addEventListener("click", async() => {
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) return alert("jsPDF laddades inte. Kontrollera CDN-länken.");

  const company = document.getElementById("o_company").value.trim() || "—";
  const no = document.getElementById("o_no").value.trim() || "—";
  const customer = document.getElementById("o_customer").value.trim() || "—";
  const date = document.getElementById("o_date").value || "—";
  const terms = document.getElementById("o_terms").value.trim();
  const currency = "SEK";

  const lines = getLineData(o_lines);
  const totals = calcLines(o_lines);

  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const logoInput = document.getElementById("logoUpload");
  let logoData = null;

  if (logoInput?.files?.length) {
    logoData = await readImageAsDataURL(logoInput.files[0]);
  }

  if (logoData) {
    doc.addImage(
      logoData,
      "PNG",
      170, // x
      1,   // y
      20,  // width
      20   // height
    );
  }

  pdfHeader(doc, "OFFERT");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`Företag: ${company}`, 14, 32);
  doc.text(`Offertnr: ${no}`, 14, 38);
  doc.text(`Kund: ${customer}`, 14, 44);
  doc.text(`Datum: ${date}`, 14, 50);

  let y = 62;
  y = pdfLines(doc, lines, y);

  pdfTotals(doc, totals, y, currency);

  if (terms){
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Villkor:", 14, 282);
    doc.text(terms, 14, 288, { maxWidth: 180 });
  }

  // ✅ Save to IndexedDB instead of downloading
  const blob = doc.output("blob");
  const fileName = `offert_${no !== "—" ? no : (date || "datum")}.pdf`;

  await savePdfRecord({
    id: safeId(),
    type: "offer",
    title: `Offert ${no !== "—" ? no : ""} ${customer !== "—" ? "• " + customer : ""}`.trim(),
    fileName,
    createdAt: Date.now(),
    meta: { company, no, customer, date, currency, totals },
    blob
  });

    window.location.assign(' https://gjoshi99.github.io/offert/data.html')
});