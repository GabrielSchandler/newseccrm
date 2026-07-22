import "server-only";
import type { CompanyUserProfile } from "@/types/user";

type SignatureUser = Pick<
  CompanyUserProfile,
  "full_name" | "nickname" | "phone" | "role" | "legal_role"
> | null;

type SignatureOptions = {
  sender: SignatureUser;
  senderEmail: string | null;
  senderDisplayName?: string | null;
  companyName?: string | null;
  companyWebsite?: string | null;
};

function escapeHtml(value: string | null | undefined) {
  return (value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function textToHtml(value: string) {
  return escapeHtml(value).replace(/\r?\n/g, "<br />");
}

function formatPhone(value: string | null | undefined) {
  const digits = (value ?? "").replace(/\D/g, "");

  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }

  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return value?.trim() || "11 91546-6717";
}

function senderName(sender: SignatureUser, senderDisplayName?: string | null) {
  return (
    sender?.nickname?.trim() ||
    sender?.full_name?.trim() ||
    senderDisplayName?.trim() ||
    "Atendimento"
  );
}

function senderTitle(sender: SignatureUser) {
  if (sender?.legal_role === "consultant") {
    return "Jurídico";
  }

  return "Administrativo";
}

export function buildGrsEmailSignatureHtml(options: SignatureOptions) {
  const name = escapeHtml(senderName(options.sender, options.senderDisplayName));
  const title = escapeHtml(senderTitle(options.sender));
  const phone = escapeHtml(formatPhone(options.sender?.phone));
  const email = escapeHtml(options.senderEmail || "");
  const companyName = escapeHtml(options.companyName || "CRM");
  const [brandFirst, ...brandRest] = companyName.split(/\s+/);
  const brandLineOne = brandFirst || companyName;
  const brandLineTwo = brandRest.join(" ");
  const website = escapeHtml(
    options.companyWebsite
      ?.trim()
      .replace(/^https?:\/\//i, "")
      .replace(/\/+$/g, "") || "",
  );

  return `
<br />
<br />
<table cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;color:#111111;">
  <tr>
    <td style="padding:0 18px 0 0;vertical-align:middle;">
      <div style="font-size:30px;line-height:32px;font-weight:800;letter-spacing:0;color:#050505;">${brandLineOne}</div>
      ${brandLineTwo ? `<div style="font-size:16px;line-height:19px;font-weight:800;letter-spacing:0;color:#e31b23;">${brandLineTwo}</div>` : ""}
    </td>
    <td style="width:1px;background:#111111;font-size:1px;line-height:1px;">&nbsp;</td>
    <td style="padding:0 0 0 18px;vertical-align:middle;">
      <div style="font-size:24px;line-height:28px;font-weight:700;color:#050505;">${name}</div>
      <div style="font-size:15px;line-height:19px;font-weight:700;color:#e31b23;">${title}</div>
      <div style="margin-top:8px;font-size:13px;line-height:20px;color:#111111;">
        <div><span style="color:#e31b23;font-weight:700;">Tel.</span> ${phone}</div>
        ${email ? `<div><span style="color:#e31b23;font-weight:700;">E-mail</span> ${email}</div>` : ""}
        ${website ? `<div><span style="color:#111111;font-weight:700;">Site</span> ${website}</div>` : ""}
      </div>
    </td>
  </tr>
</table>`;
}

export function buildSignedEmailHtml(body: string, options: SignatureOptions) {
  return `${textToHtml(body)}${buildGrsEmailSignatureHtml(options)}`;
}
