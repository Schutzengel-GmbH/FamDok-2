<#-- Sent when a user requests a new password via "Passwort vergessen?" on the login page. -->
<#import "template.ftl" as layout>
<@layout.emailLayout>
<@layout.greeting/>
<p style="margin:0;">für Ihr Konto bei <strong>${realmName}</strong> wurde ein neues Passwort angefordert. Über den folgenden Link können Sie es festlegen:</p>
<@layout.button href=link label="Neues Passwort festlegen"/>
<p style="margin:0 0 16px; font-size:13px; color:#4b5563;">Der Link ist ${linkExpirationFormatter(linkExpiration)} gültig.</p>
<p style="margin:0; font-size:13px; color:#4b5563;">Sie haben das nicht angefordert? Dann können Sie diese E-Mail ignorieren – Ihr bisheriges Passwort bleibt gültig.</p>
</@layout.emailLayout>
