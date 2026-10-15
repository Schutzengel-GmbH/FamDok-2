<#ftl output_format="plainText">
<#import "template.ftl" as layout>
<#assign actions = requiredActions![]>
<@layout.greeting/>


<#if actions?seq_contains("UPDATE_PASSWORD")>
für Sie wurde ein Zugang zu ${realmName} eingerichtet. Ihr Benutzername ist Ihre E-Mail-Adresse.

Bitte legen Sie über den folgenden Link Ihr Passwort fest. Damit wird auch Ihre E-Mail-Adresse bestätigt:
<#else>
Ihr Administrator bittet Sie, Folgendes in Ihrem Konto bei ${realmName} zu erledigen:
<#list actions as action>
- ${msg("requiredAction.${action}")}
</#list>

Link:
</#if>
${link}

Der Link ist ${linkExpirationFormatter(linkExpiration)} gültig. Ist er abgelaufen, wenden Sie sich bitte an Ihren Administrator.
<@layout.footer/>
