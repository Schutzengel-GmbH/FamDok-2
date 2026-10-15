<#ftl output_format="plainText">
<#import "template.ftl" as layout>
<@layout.greeting/>


bitte bestätigen Sie, dass diese E-Mail-Adresse zu Ihrem Konto bei ${realmName} gehört:

${link}

Der Link ist ${linkExpirationFormatter(linkExpiration)} gültig.

Sie haben kein Konto bei ${realmName}? Dann können Sie diese E-Mail ignorieren.
<@layout.footer/>
