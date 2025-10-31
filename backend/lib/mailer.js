// lib/mailer.js
import nodemailer from "nodemailer";

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_SECURE, // "true"/"false"
  SMTP_USER,
  SMTP_PASS,
  MAIL_FROM,   // örn: '"Pest Control" <no-reply@domain.com>'
  MAIL_DISABLE, // "1" ise gerçek gönderim yapma, logla
  APP_NAME = "Pest Control",
  APP_URL  = "http://localhost:3000",
} = process.env;

let transporter = null;
if (
  !MAIL_DISABLE &&
  SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS
) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: String(SMTP_SECURE || "false") === "true",
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

// Genel gönderim (config yoksa mock log’lar)
export async function sendMail({ to, subject, html, text }) {
  if (!transporter) {
    console.log("[MAIL-MOCK]");
    console.log("TO:", to);
    console.log("SUBJECT:", subject);
    if (text) console.log("TEXT:", text);
    if (html) console.log("HTML:", html);
    return { mocked: true };
  }
  return transporter.sendMail({
    from: MAIL_FROM || SMTP_USER,
    to,
    subject,
    text,
    html,
  });
}

/* -------------------- templates -------------------- */
function baseBox(innerHtml) {
  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.6;color:#0f172a;">
    <div style="max-width:600px;margin:0 auto;padding:16px 12px;">
      ${innerHtml}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0 8px"/>
      <div style="font-size:12px;color:#64748b;">
        <div>${APP_NAME}</div>
        <div><a href="${APP_URL}" target="_blank" style="color:#2563eb;text-decoration:none">${APP_URL}</a></div>
      </div>
    </div>
  </div>`;
}

function htmlWelcome({ name, code }) {
  const display = name?.trim() || "Merhaba";
  return baseBox(`
    <h2 style="margin:0 0 10px;font-size:18px;">${APP_NAME} – Hesabınız oluşturuldu</h2>
    <p>${display}, hesabınız oluşturuldu.</p>
    <p>Geçici giriş şifreniz (6 haneli): <b style="font-size:18px;letter-spacing:2px">${code}</b></p>
    <p>Giriş adresi: <a href="${APP_URL}" target="_blank" style="color:#2563eb">${APP_URL}</a></p>
  `);
}
function textWelcome({ name, code }) {
  return `${name || "Merhaba"}, hesabınız oluşturuldu.
Geçici şifreniz: ${code}
Giriş: ${APP_URL}`;
}

function htmlGranted({ name, scopeText }) {
  const display = name?.trim() || "Merhaba";
  return baseBox(`
    <h2 style="margin:0 0 10px;font-size:18px;">${APP_NAME} – Erişiminiz tanımlandı</h2>
    <p>${display}, sisteme erişiminiz tanımlandı.</p>
    <p><b>Kapsam:</b> ${scopeText}</p>
    <p>Giriş adresi: <a href="${APP_URL}" target="_blank" style="color:#2563eb">${APP_URL}</a></p>
  `);
}
function textGranted({ name, scopeText }) {
  return `${name || "Merhaba"}, erişiminiz tanımlandı.
Kapsam: ${scopeText}
Giriş: ${APP_URL}`;
}

function htmlReset({ name, code }) {
  const display = name?.trim() || "Merhaba";
  return baseBox(`
    <h2 style="margin:0 0 10px;font-size:18px;">${APP_NAME} – Şifreniz sıfırlandı</h2>
    <p>${display}, hesabınız için geçici bir şifre oluşturuldu.</p>
    <p>Geçici giriş şifreniz (6 haneli): <b style="font-size:18px;letter-spacing:2px">${code}</b></p>
    <p>Giriş adresi: <a href="${APP_URL}" target="_blank" style="color:#2563eb">${APP_URL}</a></p>
  `);
}
function textReset({ name, code }) {
  return `${name || "Merhaba"}, şifreniz sıfırlandı.
Geçici şifreniz: ${code}
Giriş: ${APP_URL}`;
}

/* -------------------- senders -------------------- */
export async function sendAccessOwnerWelcome({ to, name, code }) {
  return sendMail({
    to,
    subject: `${APP_NAME}: Hesabınız oluşturuldu`,
    html: htmlWelcome({ name, code }),
    text: textWelcome({ name, code }),
  });
}

export async function sendAccessOwnerGranted({ to, name, scopeText }) {
  return sendMail({
    to,
    subject: `${APP_NAME}: Erişiminiz tanımlandı`,
    html: htmlGranted({ name, scopeText }),
    text: textGranted({ name, scopeText }),
  });
}

export async function sendAccessOwnerPasswordReset({ to, name, code }) {
  return sendMail({
    to,
    subject: `${APP_NAME}: Şifre sıfırlama`,
    html: htmlReset({ name, code }),
    text: textReset({ name, code }),
  });
}


// lib/mailer.js  (dosyanın sonuna ekle)
function absUrl(u) {
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u;
  const API_ORIGIN = process.env.API_ORIGIN || ""; // ör: http://localhost:5000
  if (!API_ORIGIN) return u.replace(/^\/+/, "");
  return `${API_ORIGIN.replace(/\/+$/,"")}/${u.replace(/^\/+/, "")}`;
}
function fmtDateTR(d) {
  try {
    return new Date(d).toLocaleString("tr-TR", {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit"
    });
  } catch { return String(d); }
}
function esc(x){ return String(x ?? "").replace(/[<>]/g, s => ({'<':'&lt;','>':'&gt;'}[s])); }

function htmlVisitSummary(data) {
  const {
    storeName, storeCode, customerTitle,
    visitAt, startTime, endTime, visitType,
    employees, targetPests, notes,
    ek1Status, pdfUrl, detailUrl,
    lines = [], activations = []
  } = data;

  const linesHtml = lines.length
    ? `<table style="width:100%;border-collapse:collapse;margin:8px 0 0">
        <thead>
          <tr>
            <th style="text-align:left;border-bottom:1px solid #e5e7eb;padding:6px 0">Biyosidal</th>
            <th style="text-align:left;border-bottom:1px solid #e5e7eb;padding:6px 0">Etken</th>
            <th style="text-align:left;border-bottom:1px solid #e5e7eb;padding:6px 0">Yöntem</th>
            <th style="text-align:left;border-bottom:1px solid #e5e7eb;padding:6px 0">Miktar</th>
          </tr>
        </thead>
        <tbody>
          ${lines.map(l => `
            <tr>
              <td style="padding:6px 0">${esc(l.name)}</td>
              <td style="padding:6px 0">${esc(l.activeIngredient) || "—"}</td>
              <td style="padding:6px 0">${esc(l.method)}</td>
              <td style="padding:6px 0">${l.amount ?? "—"} ${l.unit || ""}</td>
            </tr>`).join("")}
        </tbody>
      </table>`
    : `<div style="color:#64748b">EK-1 satırı yok.</div>`;

  const actsHtml = activations.length
    ? `<ul style="margin:8px 0 0;padding-left:16px;color:#334155">
        ${activations.map(a => `<li>${esc(a.label)}: ${a.count}</li>`).join("")}
      </ul>`
    : "";

  const pdfBtn = pdfUrl
    ? `<a href="${absUrl(pdfUrl)}" target="_blank"
         style="display:inline-block;margin:8px 8px 0 0;padding:8px 12px;border-radius:6px;background:#0ea5e9;color:#fff;text-decoration:none">
        EK-1 PDF'yi Gör
       </a>`
    : "";

  const detailBtn = detailUrl
    ? `<a href="${detailUrl}" target="_blank"
         style="display:inline-block;margin:8px 0 0;padding:8px 12px;border-radius:6px;background:#22c55e;color:#fff;text-decoration:none">
        Ziyaret Detayına Git
       </a>`
    : "";

  return baseBox(`
    <h2 style="margin:0 0 6px;font-size:18px;">Ziyaret Özeti (EK-1)</h2>
    <p style="margin:0 0 10px;color:#334155">
      <b>${esc(storeName)}</b>${storeCode ? ` <span style="color:#64748b">(${esc(storeCode)})</span>` : ""}<br/>
      ${customerTitle ? `<span style="color:#64748b">${esc(customerTitle)}</span><br/>` : ""}
      <span>${fmtDateTR(visitAt)}${startTime ? ` · ${esc(startTime)}${endTime ? " – " + esc(endTime) : ""}` : ""}</span>
    </p>

    <div style="margin:12px 0 8px">
      <div><b>Tür:</b> ${esc(visitType || "—")}</div>
      <div><b>Personel:</b> ${esc(employees || "—")}</div>
      ${targetPests ? `<div><b>Hedef Zararlılar:</b> ${esc(targetPests)}</div>` : ""}
      ${notes ? `<div><b>Notlar:</b> ${esc(notes)}</div>` : ""}
      ${ek1Status ? `<div><b>EK-1 Durumu:</b> ${esc(ek1Status)}</div>` : ""}
    </div>

    <div style="margin:12px 0 6px"><b>Uygulanan Biyosidaller</b></div>
    ${linesHtml}

    ${activations.length ? `<div style="margin:16px 0 6px"><b>İstasyon Aktivite Özeti</b></div>${actsHtml}` : ""}

    <div style="margin-top:12px">${pdfBtn}${detailBtn}</div>
  `);
}

function textVisitSummary(data) {
  const {
    storeName, storeCode, customerTitle,
    visitAt, startTime, endTime, visitType,
    employees, targetPests, notes, ek1Status,
  } = data;

  const when = `${fmtDateTR(visitAt)}${startTime ? ` · ${startTime}${endTime ? ` – ${endTime}` : ""}` : ""}`;
  return [
    `Ziyaret Özeti (EK-1)`,
    `${storeName}${storeCode ? ` (${storeCode})` : ""}`,
    customerTitle ? `${customerTitle}` : "",
    when,
    `Tür: ${visitType || "—"}`,
    `Personel: ${employees || "—"}`,
    targetPests ? `Hedef Zararlılar: ${targetPests}` : "",
    notes ? `Notlar: ${notes}` : "",
    ek1Status ? `EK-1 Durumu: ${ek1Status}` : "",
  ].filter(Boolean).join("\n");
}

export async function sendVisitSummaryMail({ to, subject, data }) {
  return sendMail({
    to,
    subject,
    html: htmlVisitSummary(data),
    text: textVisitSummary(data),
  });
}

// ---- lib/mailer.js (APP_URL tabanıyla FE link üret) ----
function appLink(pathname = "/") {
  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
  const p = String(pathname || "/").replace(/^\/+/, "");
  return `${base}/${p}`;
}
function truncate(str, max = 280) {
  const s = String(str || "");
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}
function fullName(user) {
  const f = (user?.firstName || "").trim();
  const l = (user?.lastName || "").trim();
  const joined = `${f} ${l}`.trim();
  return joined || user?.email || "Müşteri";
}

/* ============== ŞİKAYET: Admin e-postası ============== */
function htmlComplaintAdmin({ complaint, detailPath }) {
  const {
    id, title, message, type, image, createdAt, store, owner
  } = complaint || {};
  const storeLine = store
    ? `${store?.name || ""}${store?.code ? ` (${store.code})` : ""}${store?.city ? ` – ${store.city}` : ""}`
    : "";
  const ownerLine = fullName(owner);
  const detailUrl = appLink(detailPath || `/admin/complaints/${id}`);

  return baseBox(`
    <h2 style="margin:0 0 10px;font-size:18px;">Yeni Şikayet</h2>
    <div style="color:#334155;margin:0 0 8px"><b>#${id}</b> • <b>Tür:</b> ${esc(type || "—")}</div>
    ${storeLine ? `<div style="margin:0 0 6px"><b>Mağaza:</b> ${esc(storeLine)}</div>` : ""}
    <div style="margin:0 0 6px"><b>Şikayet Sahibi:</b> ${esc(ownerLine)}</div>
    <div style="margin:0 0 6px"><b>Tarih:</b> ${fmtDateTR(createdAt)}</div>

    <div style="margin:10px 0 6px"><b>Başlık:</b> ${esc(title || "—")}</div>
    <div style="margin:4px 0 10px;white-space:pre-wrap">${esc(truncate(message, 800))}</div>

    ${image ? `<div style="margin:10px 0">
      <img src="${absUrl(image)}" alt="Şikayet görseli" style="max-width:100%;border-radius:12px;border:1px solid #e5e7eb"/>
    </div>` : ""}

    <a href="${detailUrl}" target="_blank"
       style="display:inline-block;margin-top:8px;padding:10px 14px;border-radius:8px;background:#111827;color:#fff;text-decoration:none">
      Detay Sayfasını Aç
    </a>
  `);
}
function textComplaintAdmin({ complaint, detailPath }) {
  const { id, title, message, type, createdAt, store, owner } = complaint || {};
  const storeLine = store ? `${store?.name || ""}${store?.code ? ` (${store.code})` : ""}${store?.city ? ` – ${store.city}` : ""}` : "";
  const ownerLine = fullName(owner);
  const detailUrl = appLink(detailPath || `/admin/complaints/${id}`);

  return [
    `Yeni Şikayet #${id}`,
    `Tür: ${type || "-"}`,
    storeLine ? `Mağaza: ${storeLine}` : "",
    `Sahip: ${ownerLine}`,
    `Tarih: ${fmtDateTR(createdAt)}`,
    `Başlık: ${title || "-"}`,
    "",
    truncate(message, 800),
    "",
    `Detay: ${detailUrl}`,
  ].filter(Boolean).join("\n");
}
export async function sendComplaintCreatedToAdmins({ to, complaint, detailPath }) {
  const subject = `${process.env.APP_NAME || "Pest Control"}: Yeni Şikayet #${complaint?.id}`;
  return sendMail({
    to,
    subject,
    html: htmlComplaintAdmin({ complaint, detailPath }),
    text: textComplaintAdmin({ complaint, detailPath }),
  });
}

/* ============== ÖNERİ: Admin e-postası ============== */
function htmlSuggestionAdmin({ suggestion, detailPath }) {
  const { id, title, message, createdAt, owner } = suggestion || {};
  const ownerLine = fullName(owner);
  const detailUrl = appLink(detailPath || `/admin/suggestions/${id}`);

  return baseBox(`
    <h2 style="margin:0 0 10px;font-size:18px;">Yeni Öneri</h2>
    <div style="color:#334155;margin:0 0 6px"><b>#${id}</b> • <b>Gönderen:</b> ${esc(ownerLine)}</div>
    <div style="margin:0 0 6px"><b>Tarih:</b> ${fmtDateTR(createdAt)}</div>

    <div style="margin:10px 0 6px"><b>Başlık:</b> ${esc(title || "—")}</div>
    <div style="margin:4px 0 10px;white-space:pre-wrap">${esc(truncate(message, 1000))}</div>

    <a href="${detailUrl}" target="_blank"
       style="display:inline-block;margin-top:8px;padding:10px 14px;border-radius:8px;background:#111827;color:#fff;text-decoration:none">
      Detay Sayfasını Aç
    </a>
  `);
}
function textSuggestionAdmin({ suggestion, detailPath }) {
  const { id, title, message, createdAt, owner } = suggestion || {};
  const ownerLine = fullName(owner);
  const detailUrl = appLink(detailPath || `/admin/suggestions/${id}`);

  return [
    `Yeni Öneri #${id}`,
    `Gönderen: ${ownerLine}`,
    `Tarih: ${fmtDateTR(createdAt)}`,
    `Başlık: ${title || "-"}`,
    "",
    truncate(message, 1000),
    "",
    `Detay: ${detailUrl}`,
  ].filter(Boolean).join("\n");
}
export async function sendSuggestionCreatedToAdmins({ to, suggestion, detailPath }) {
  const subject = `${process.env.APP_NAME || "Pest Control"}: Yeni Öneri #${suggestion?.id}`;
  return sendMail({
    to,
    subject,
    html: htmlSuggestionAdmin({ suggestion, detailPath }),
    text: textSuggestionAdmin({ suggestion, detailPath }),
  });
}

// lib/mailer.js  (dosyanın SONUNA ekleyin)

// --- ziyaret atama maili ---
function htmlVisitPlannedToEmployee({ title, employeeName, storeName, storeCode, city, start, end, detailUrl }) {
  const when = `${fmtDateTR(start)} – ${fmtDateTR(end)}`;
  const storeLine = [storeName, storeCode ? `(${storeCode})` : null, city ? `– ${city}` : null].filter(Boolean).join(" ");
  const btnUrl = detailUrl || `${process.env.APP_URL?.replace(/\/+$/,"") || ""}/calendar/visit/${esc(title)}`;
  return baseBox(`
    <h2 style="margin:0 0 10px;font-size:18px;">${APP_NAME} – Ziyaret Size Atandı</h2>
    <p style="margin:0 0 8px;">Merhaba ${esc(employeeName || "")}, aşağıdaki ziyaret size atandı:</p>
    <div style="margin:8px 0;color:#334155">
      <div><b>Başlık:</b> ${esc(title || "Ziyaret")}</div>
      <div><b>Mağaza:</b> ${esc(storeLine || "—")}</div>
      <div><b>Zaman:</b> ${esc(when)}</div>
    </div>
    <a href="${detailUrl}" target="_blank"
       style="display:inline-block;margin-top:10px;background:#111827;color:#fff;text-decoration:none;padding:8px 12px;border-radius:8px;">
      Detayı Aç
    </a>
  `);
}
function textVisitPlannedToEmployee({ title, employeeName, storeName, storeCode, city, start, end, detailUrl }) {
  const when = `${fmtDateTR(start)} – ${fmtDateTR(end)}`;
  const storeLine = [storeName, storeCode ? `(${storeCode})` : null, city ? `– ${city}` : null].filter(Boolean).join(" ");
  return [
    `${APP_NAME} – Ziyaret Size Atandı`,
    `Başlık: ${title || "Ziyaret"}`,
    `Mağaza: ${storeLine || "—"}`,
    `Zaman: ${when}`,
    `Detay: ${detailUrl || (APP_URL ? APP_URL + "/calendar" : "")}`
  ].join("\n");
}

export async function sendVisitPlannedToEmployee({ to, data }) {
  if (!to) return { skipped: true };
  const subject = `${APP_NAME}: Ziyaret size atandı`;
  return sendMail({
    to,
    subject,
    html: htmlVisitPlannedToEmployee(data),
    text: textVisitPlannedToEmployee(data),
  });
}

