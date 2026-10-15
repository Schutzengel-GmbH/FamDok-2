<#--
  Sent when an admin asks a user to complete account actions. The app uses it as the invite for
  new users (UPDATE_PASSWORD + VERIFY_EMAIL) and for "Einladung senden".
-->
<#import "template.ftl" as layout>
<#assign actions = requiredActions![]>
<#assign isInvite = actions?seq_contains("UPDATE_PASSWORD")>
<@layout.emailLayout>
<@layout.greeting/>
<#if isInvite>
<p style="margin:0 0 16px;">für Sie wurde ein Zugang zu <strong>${realmName}</strong> eingerichtet. Ihr Benutzername ist Ihre E-Mail-Adresse.</p>
<p style="margin:0;">Bitte legen Sie über den folgenden Link Ihr Passwort fest. Damit wird auch Ihre E-Mail-Adresse bestätigt.</p>
<@layout.button href=link label="Passwort festlegen"/>
<#else>
<p style="margin:0 0 8px;">Ihr Administrator bittet Sie, Folgendes in Ihrem Konto bei <strong>${realmName}</strong> zu erledigen:</p>
<ul style="margin:0 0 8px; padding-left:20px;">
<#list actions as action><li>${msg("requiredAction.${action}")}</li></#list>
</ul>
<@layout.button href=link label="Konto aktualisieren"/>
</#if>
<p style="margin:0; font-size:13px; color:#4b5563;">Der Link ist ${linkExpirationFormatter(linkExpiration)} gültig. Ist er abgelaufen, wenden Sie sich bitte an Ihren Administrator.</p>
</@layout.emailLayout>
