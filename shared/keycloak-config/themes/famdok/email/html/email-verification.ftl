<#-- Sent when a user has to confirm their email address on its own (e.g. after it changed). -->
<#import "template.ftl" as layout>
<@layout.emailLayout>
<@layout.greeting/>
<p style="margin:0;">bitte bestätigen Sie, dass diese E-Mail-Adresse zu Ihrem Konto bei <strong>${realmName}</strong> gehört:</p>
<@layout.button href=link label="E-Mail-Adresse bestätigen"/>
<p style="margin:0 0 16px; font-size:13px; color:#4b5563;">Der Link ist ${linkExpirationFormatter(linkExpiration)} gültig.</p>
<p style="margin:0; font-size:13px; color:#4b5563;">Sie haben kein Konto bei ${realmName}? Dann können Sie diese E-Mail ignorieren.</p>
</@layout.emailLayout>
