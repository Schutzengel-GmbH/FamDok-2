<#ftl output_format="plainText">
<#-- Shared helpers of the plain-text mails (the fallback for clients without HTML). -->
<#macro greeting>Hallo<#if (user.firstName)?has_content> ${user.firstName}</#if>,</#macro>
<#macro footer>
--
Diese E-Mail wurde automatisch von ${realmName!'FamDok'} versendet. Bitte antworten Sie nicht darauf.</#macro>
