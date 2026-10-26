<#--
  Shared layout of all HTML mails. Mail clients ignore <style> blocks and CSS variables, so all
  styling is inline. Colours follow the app: brand #2563eb, background #f3f4f8, text #020617.
-->
<#macro emailLayout>
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>${realmName!'FamDok'}</title>
</head>
<body style="margin:0; padding:0; background-color:#f3f4f8; color:#020617; font-family:system-ui,-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f3f4f8;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
          <tr>
            <td style="padding:0 4px 16px; font-size:20px; font-weight:600; color:#020617;">
              <span style="display:inline-block; width:14px; height:14px; margin-right:8px; border-radius:4px; background-color:#2563eb; vertical-align:-1px;"></span>${realmName!'FamDok'}
            </td>
          </tr>
          <tr>
            <td style="padding:32px; background-color:#ffffff; border:1px solid #e2e4ea; border-radius:14px; font-size:15px; line-height:1.6;">
              <#nested>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 4px; font-size:12px; line-height:1.5; color:#6b7280;">
              Diese E-Mail wurde automatisch von ${realmName!'FamDok'} versendet. Bitte antworten Sie nicht darauf.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
</#macro>

<#-- Greeting with the first name, if known -->
<#macro greeting>
<p style="margin:0 0 16px;">Hallo<#if (user.firstName)?has_content> ${user.firstName}</#if>,</p>
</#macro>

<#-- Primary call-to-action, plus the raw link for clients that block buttons -->
<#macro button href label>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
  <tr>
    <td style="border-radius:10px; background-color:#2563eb;">
      <a href="${href}" target="_blank" style="display:inline-block; padding:12px 24px; font-size:15px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:10px;">${label}</a>
    </td>
  </tr>
</table>
<p style="margin:0 0 16px; font-size:13px; color:#4b5563;">
  Falls der Button nicht funktioniert, kopieren Sie diesen Link in Ihren Browser:<br>
  <a href="${href}" target="_blank" style="color:#2563eb; word-break:break-all;">${href}</a>
</p>
</#macro>
