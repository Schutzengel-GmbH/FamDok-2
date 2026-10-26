<#ftl output_format="plainText">
<#import "template.ftl" as layout>
<@layout.greeting/>


für Ihr Konto bei ${realmName} wurde ein neues Passwort angefordert. Über den folgenden Link können Sie es festlegen:

${link}

Der Link ist ${linkExpirationFormatter(linkExpiration)} gültig.

Sie haben das nicht angefordert? Dann können Sie diese E-Mail ignorieren – Ihr bisheriges Passwort bleibt gültig.
<@layout.footer/>
