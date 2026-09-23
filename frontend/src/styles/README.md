# Styles

Einstiegspunkt: `src/global.scss` → `styles/_index.scss` (Reihenfolge = Kaskade).
Bootstrap, Bootstrap-Icons und das ng-select-Theme kommen über `angular.json` → `styles`.

```
styles/
├─ abstracts/    Nur Werkzeuge, erzeugen kein CSS
│  ├─ _tokens      SCSS-Variablen (Farben, Radien, Breakpoints, Timing)
│  └─ _mixins      media-down(), panel(), pill(), lift-card(), thin-scrollbar() …
├─ base/         Laufzeit-Variablen (--bs-*, --app-*, Light/Dark), Reset, Dokument-Layout
├─ vendors/      Anpassungen an Bootstrap und ng-select
├─ components/   Globale, wiederverwendbare Klassen (.badge-soft, .status-dot, .section-title …)
└─ patterns/     Mixin-Sammlungen für wiederkehrende Seitenaufbauten (list-page)
```

## In Komponenten-Styles

```scss
@use "abstracts" as *;               // Tokens + Mixins (Pfad via stylePreprocessorOptions.includePaths)
@use "patterns/list-page" as *;      // nur bei Listen-Seiten

@include media-down("md") { … }      // Namen: xs 479.98 · sm 576 · nav 754 · md 767.98 · lg 992 · xl 1199.98
```

## Regeln

- Wird eine Klasse in **zwei oder mehr** Komponenten gebraucht → nach `components/` (global) oder als Mixin nach `abstracts/`/`patterns/`.
- Farben nie als Hex/rgba hart codieren: `--bs-*`-Variablen bzw. `$brand-*`/`$slate-*` aus `_tokens`.
- Media-Queries über `media-down()`, keine losen Pixelwerte (Ausnahme: einmalige Sonderfälle).
- Keine leeren Style-Dateien anlegen; `styleUrl` erst hinzufügen, wenn es Styles gibt.
