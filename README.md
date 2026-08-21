# FH Digihub

Digitale Fachanwendung zur Dokumentation von Fällen im Bereich **Frühe Hilfen**, entwickelt für die Schutzengel GmbH Flensburg. Die Anwendung ermöglicht Fachkräften die strukturierte Erfassung und Verwaltung von Familienfällen, Kontakten, Formularen und Zielvereinbarungen sowie eine rollenbasierte Statistikübersicht.

---

## Inhaltsverzeichnis

- [Tech-Stack](#tech-stack)
- [Architektur](#architektur)
- [Voraussetzungen](#voraussetzungen)
- [Lokale Entwicklung](#lokale-entwicklung)
- [Umgebungsvariablen](#umgebungsvariablen)
- [Datenbankschema](#datenbankschema)
- [Rollen & Berechtigungen](#rollen--berechtigungen)
- [Anwendungsrouten](#anwendungsrouten)
- [API-Übersicht](#api-übersicht)
- [Produktiv-Deployment](#produktiv-deployment)
- [Nützliche Befehle](#nützliche-befehle)
- [Projektstruktur](#projektstruktur)

---

## Tech-Stack und Architektur

| Bereich           | Technologie                                        |
| ----------------- | -------------------------------------------------- |
| Frontend          | Angular 20, Bootstrap 5, Bootstrap Icons, Chart.js |
| Backend           | Node.js, Express 5, TypeScript                     |
| Datenbank         | PostgreSQL 15                                      |
| ORM               | Prisma 6                                           |
| Authentifizierung | Keycloak 24 (OIDC / Bearer-Token)                  |
| Containerisierung | Docker / Docker Compose                            |
| Shared Types      | Prisma-generierte Typen (gemeinsam genutzt)        |

---

Das Projekt ist als **Monorepo** aufgebaut:

```
FH_Digihub/
├── frontend/          # Angular-SPA
├── backend/           # Express-REST-API
├── shared/            # Gemeinsam genutzte generierte Typen (Prisma, Keycloak-Config)
├── docker-compose.yaml          # Produktiv-Stack
└── docker-compose-dev.yaml      # Entwicklungsinfrastruktur (Keycloak + DB)
```

**Datenfluß:**

```
Browser (Angular)
    │  HTTP + Bearer-Token
    ▼
Express Backend (Port 3000)
    │  Passport.js (Bearer-Token-Validierung gegen Keycloak)
    ▼
Keycloak (OIDC – Authentifizierung & Token-Ausstellung)
    │
    ▼
PostgreSQL (Anwendungsdaten via Prisma)
```

Die Prisma-Client-Typen werden in `shared/generated/prisma` generiert und sowohl im Frontend als auch im Backend genutzt, sodass Typen nie doppelt gepflegt werden müssen.

---

## Voraussetzungen

- **Node.js** ≥ 20
- **npm** ≥ 10
- **Docker** + **Docker Compose** (für Keycloak und PostgreSQL)
- **Angular CLI** (`npm install -g @angular/cli`)

---

## Lokale Entwicklung

### Schnellstart

Nach einmaligem `npm install` (Root, `backend/`, `frontend/`) und `cp .env.example .env`:

```bash
npm run dev
```

Das startet die Dev-Infrastruktur (wartet auf gesunde DB-Container), führt `prisma migrate dev` + `generate:keycloak` aus (Schema- und Realm-Sync) und startet Backend (nodemon) und Frontend (`ng serve`) parallel in einem Terminal — Hot-Reload bleibt für beide erhalten. Zum Stoppen der Infrastruktur: `npm run infra:down`.

Die einzelnen Schritte lassen sich auch separat ausführen (z. B. zum Debuggen): `npm run infra:up`, `npm run db:sync`, `npm run kc:sync`, `npm run dev:backend`, `npm run dev:frontend`.

### Manueller Ablauf (Einzelschritte)

#### 1. Infrastruktur starten (Keycloak + Datenbank)

```bash
docker compose -f docker-compose-dev.yaml up -d
```

Startet:

- **PostgreSQL** für die Anwendungsdaten auf Port `5432`
- **Keycloak** auf Port `8090` (Admin-UI: `http://localhost:8090`, User: `admin`, Passwort: `admin`)

Das Keycloak-Realm `fh-realm` wird beim Start automatisch aus `shared/keycloak-config/` importiert.

#### 2. Abhängigkeiten installieren

```bash
# Root-Abhängigkeiten
npm install

# Backend
cd backend && npm install

# Frontend
cd frontend && npm install
```

#### 3. Umgebungsvariablen konfigurieren

```bash
cp .env.example .env
```

Die Standardwerte in der `.env` (Projekt-Root) passen zur Dev-Infrastruktur aus Schritt 1 und müssen für die lokale Entwicklung nicht geändert werden.

#### 4. Datenbank migrieren & Keycloak-Benutzer anlegen

```bash
cd backend
npm run db:dev           # Prisma-Migrationen ausführen + Client generieren
npm run generate:keycloak  # Test-Benutzer in Keycloak anlegen
```

Optional – Datenbank mit Testdaten befüllen:

```bash
cd backend
npm run populate
```

#### 5. Backend starten

```bash
cd backend
npm run dev   # nodemon + ts-node, Hot-Reload aktiv
```

Backend läuft auf `http://localhost:3000`.

#### 6. Frontend starten

```bash
cd frontend
npm start     # ng serve
```

Frontend läuft auf `http://localhost:4200`.

---

## Umgebungsvariablen

Alle Variablen werden in **einer einzigen `.env` im Projekt-Root** gesetzt (Vorlage: `.env.example`). Backend, Frontend-Container und beide `docker-compose*.yaml` lesen daraus – nichts muss mehr an mehreren Stellen gepflegt werden.

| Variable               | Beschreibung                                       | Standardwert                                       |
| ----------------------- | --------------------------------------------------- | ----------------------------------------------------- |
| `POSTGRES_DB`           | Name der Anwendungs-Datenbank                       | `db`                                                |
| `POSTGRES_USER`         | Anwendungs-DB-Benutzer                              | `postgres`                                          |
| `POSTGRES_PASSWORD`     | Anwendungs-DB-Passwort                              | `postgres`                                          |
| `DATABASE_URL`          | PostgreSQL-Connection-String (Backend außerhalb Docker) | `postgresql://postgres:postgres@localhost:5432/db` |
| `KEYCLOAK_DB_NAME`      | Name der Keycloak-Datenbank                         | `keycloak`                                          |
| `KEYCLOAK_DB_USER`      | Keycloak-DB-Benutzer                                | `keycloak`                                          |
| `KEYCLOAK_DB_PASSWORD`  | Keycloak-DB-Passwort                                | `secret`                                            |
| `KC_ADMIN_USER`         | Keycloak-Admin-Username (Bootstrap + Admin-Client)  | `admin`                                             |
| `KC_ADMIN_PASSWORD`     | Keycloak-Admin-Passwort                             | `admin`                                             |
| `KEYCLOAK_PORT`         | Host-Port für Keycloak (beide Compose-Dateien); nicht `8080`, da `docker-compose.yaml` den Frontend-Container ebenfalls auf Host-Port `8080` legt | `8090` |
| `KC_BASE_URL`           | Extern erreichbare Keycloak-URL (Browser + Host-Dev-Backend); der containerisierte Backend-Service in `docker-compose.yaml` überschreibt seine eigene Kopie auf `http://keycloak:8080` | `http://localhost:8090` |
| `KC_REALM`              | Keycloak-Realm-Name (Änderung erfordert auch manuelles Anpassen von `shared/keycloak-config/realm-import.json`) | `fh-realm` |
| `KC_CLIENT`             | Keycloak-Client-ID (siehe Hinweis bei `KC_REALM`)   | `fh-app`                                            |
| `API_BASE_URL`          | Eigene Backend-URL                                  | `http://localhost:3000`                             |
| `FRONTEND_BASE_URL`     | Frontend-URL (CORS-Whitelist)                       | `http://localhost:4200`                             |
| `PRODUCTION`            | Produktions-Flag                                    | `false`                                             |
| `UPLOAD_DIR`            | Upload-Verzeichnis (Container überschreibt dies)    | `./uploads`                                         |
| `MAX_UPLOAD_SIZE_MB`    | Maximale Upload-Größe pro Datei in MB               | `25`                                                |

`backend/prisma/seed-prod.config.json` (Vorlage: `seed-prod.config.example.json`) bleibt bewusst eine separate, gitignorede Konfigurationsdatei – sie enthält einmalige Instanz-Seed-Daten (Organisationsname, Admin-Identität), keine Deployment-Konfiguration.

---

## Datenbankschema

Das Schema wird via Prisma verwaltet (`backend/prisma/schema.prisma`). Kernentitäten:

```
Organisation
  ├── SubOrganisation
  ├── CaseForm / GeneralForm (optional org-gebunden, sonst global)
  └── User (Rolle: Admin | Controller | OrgController | OrgCoordinator | SubOrgCoordinator | User)

Family
  ├── Child (mit Gesundheitsdaten)
  └── Caregiver (Bezugsperson, Relation: mother | father | grandparent | partner | other)

Case (Betreuungsfall, 1:1 mit Family, optional SubOrganisation zugeordnet)
  ├── CaseFormResponse[]    – Ausgefüllte Formulare
  ├── ContactDocumentation[] – Kontaktprotokolle (Intensivberatungen)
  ├── Zielvereinbarung[]    – Zielvereinbarungen mit Status (inProgress | done | failed)
  └── Handover[]            – Übergaben zwischen Fachkräften

CaseForm → CaseFormResponse   (fallbezogene Formulare)
GeneralForm → GeneralFormResponse  (allgemeine Formulare)
```

### Migrationen

```bash
# Neue Migration erstellen
cd backend
npx prisma migrate dev --name beschreibung_der_aenderung

# Prisma-Client neu generieren (nach Schema-Änderungen)
npx prisma generate
```

---

## Rollen & Berechtigungen

| Rolle                | Beschreibung                                                                | Startet auf   |
| -------------------- | ---------------------------------------------------------------------------- | ------------- |
| `Admin`              | Vollzugriff: Familien, Fälle, Formulare, User-Admin, Statistik               | `/user-admin` |
| `Controller`         | Anonyme Statistik über alle Organisationen; verwaltet globale Formulare      | `/stats`      |
| `OrgController`      | Wie `Controller`, beschränkt auf die eigene Organisation                     | `/stats`      |
| `OrgCoordinator`     | Wie `User`, zusätzlich Lesezugriff auf Fälle/Familien der eigenen Organisation | `/dashboard`  |
| `SubOrgCoordinator`  | Wie `User`, zusätzlich Lesezugriff auf Fälle/Familien der eigenen Unterorganisation | `/dashboard`  |
| `User`               | Standardzugriff: Familien, eigene Fälle, Formulare                           | `/dashboard`  |

Die Berechtigungen werden im Frontend über Route Guards (`roleGuard`) und im Backend über je eine `authFns`-Datei pro Ressource (`backend/controller/authFns/`) durchgesetzt, die von der Passport-Bearer-Strategie mit Keycloak-Token-Validierung aufgerufen wird.

Das Dashboard (Route `/`) leitet nach dem Login automatisch rollenabhängig weiter (`Controller`/`OrgController` → `/stats`, `Admin` → `/user-admin`, alle anderen → `/dashboard`). `OrgCoordinator`/`SubOrgCoordinator` können auf ihrem Dashboard per Toggle zwischen ihren eigenen Fällen und denen ihrer Organisation/Unterorganisation wechseln.

`CaseForm`/`GeneralForm`-Definitionen können global (für alle Organisationen sichtbar) oder einer einzelnen Organisation zugeordnet sein. `Controller` verwaltet globale Formulare, `OrgController` nur die seiner eigenen Organisation.

---

## Anwendungsrouten

| Route                             | Komponente                     | Erlaubte Rollen                                    |
| ---------------------------------- | ------------------------------- | ---------------------------------------------------- |
| `/dashboard`                      | Dashboard                      | User, Admin, OrgCoordinator, SubOrgCoordinator     |
| `/stats`                          | Statistik-Übersicht            | Admin, Controller, OrgController, OrgCoordinator, SubOrgCoordinator |
| `/familien`                       | Familienübersicht              | User, Admin, OrgCoordinator, SubOrgCoordinator     |
| `/create-family`                  | Familie anlegen                | User, Admin, OrgCoordinator, SubOrgCoordinator     |
| `/edit-family/:id`                | Familie bearbeiten             | User, Admin, OrgCoordinator, SubOrgCoordinator     |
| `/contact-documentation/:caseId`  | Kontaktdokumentation           | User, Admin, OrgCoordinator, SubOrgCoordinator     |
| `/surveys` / `/formulare`         | Fallbezogene Formulare         | User, Admin, OrgCoordinator, SubOrgCoordinator     |
| `/responses/:caseFormId`          | Formularantwort                | User, Admin, OrgCoordinator, SubOrgCoordinator     |
| `/general-responses`              | Allgemeine Formulare           | User, Admin, OrgCoordinator, SubOrgCoordinator     |
| `/gesundheits-daten/:caseId`      | Gesundheitsdaten Kinder        | User, Admin, OrgCoordinator, SubOrgCoordinator     |
| `/my-responses`                   | Eigene Antworten               | User, Admin, OrgCoordinator, SubOrgCoordinator     |
| `/allgemeine-formulare/*`         | Formular-Editor (allgemein)    | Admin, Controller, OrgController                   |
| `/fallbezogene-formulare/*`       | Formular-Editor (fallbezogen)  | Admin, Controller, OrgController                   |
| `/me`                             | Eigenes Profil                 | alle Rollen                                        |
| `/user-admin`                     | Benutzerverwaltung             | Admin                                              |
| `/import/survey`                  | Formulardefinition importieren | Admin                                              |
| `/all-stats`                      | Rohdaten-Ansicht               | authentifiziert                                    |
| `/error`                          | Fehlerseite                    | –                                                   |

---

## API-Übersicht

Alle Endpunkte erfordern einen gültigen Keycloak Bearer-Token im `Authorization`-Header. Das Backend läuft auf Port `3000`.

| Prefix                  | Controller                   | Beschreibung                                            |
| ----------------------- | ---------------------------- | ------------------------------------------------------- |
| `/family`               | FamilyController             | CRUD für Familien, Kinder, Bezugspersonen               |
| `/case`                 | CaseController               | CRUD für Betreuungsfälle, Zielvereinbarungen, Übergaben |
| `/case-form-definition` | CaseFormDefinitionController | Formulardefinitionen verwalten                          |
| `/case-form-response`   | CaseFormResponseController   | Formularantworten erfassen                              |
| `/general-form`         | GeneralFormController        | Allgemeine Formulare & Antworten                        |
| `/user`                 | UserController               | Benutzerverwaltung                                      |
| `/me`                   | MeRouter                     | Eigenes Profil                                          |
| `/org`                  | OrgController                | Organisationen & Sub-Organisationen                     |
| `/stats`                | StatsController              | Anonymisierte Statistiken & Auswertungen                |

---

## Produktiv-Deployment

Der Produktiv-Stack baut Frontend und Backend als Docker-Images und startet alle Dienste:

```bash
docker compose up -d --build
```

**Dienste:**

| Service       | Port   | Beschreibung               |
| ------------- | ------ | -------------------------- |
| `frontend`    | `8080` | Angular-App (via Nginx)    |
| `backend`     | `3000` | Express-API                |
| `keycloak`    | `8090` (`KEYCLOAK_PORT`) | Keycloak-Server |
| `app-db`      | intern | PostgreSQL Anwendungsdaten |
| `keycloak-db` | intern | PostgreSQL Keycloak-Daten  |

**Wichtige Umgebungsvariablen für Produktion** (in der Root-`.env`, siehe [Umgebungsvariablen](#umgebungsvariablen)):

```env
PRODUCTION=true
KC_BASE_URL=https://your-keycloak-domain.de
FRONTEND_BASE_URL=https://your-frontend-domain.de
POSTGRES_PASSWORD=ein-echtes-passwort
KEYCLOAK_DB_PASSWORD=ein-echtes-passwort
KC_ADMIN_PASSWORD=ein-echtes-passwort
```

`KC_BASE_URL` steuert sowohl Keycloaks eigenes `KC_HOSTNAME_URL` als auch die vom Frontend/Backend verwendete URL – ein einziger Wert genügt. Beachte: `shared/keycloak-config/realm-import.json` hardcoded aktuell `redirectUris: ["http://localhost:4200/*"]` und muss für eine echte Domain manuell angepasst werden (nicht Teil der `.env`-Konsolidierung).

**Instanz initialisieren:**

Vor dem ersten Login braucht eine frische Instanz einen Admin-Benutzer, eine Organisation und die Formulardefinitionen. Dafür `backend/prisma/seed-prod.config.example.json` nach `backend/prisma/seed-prod.config.json` kopieren, ausfüllen (Organisationsname, Admin-E-Mail/Name, optional der Name des Formulars, das als Abschlussdokumentation dient) und dann:

```bash
cd backend
npm run seed:prod
```

`seed-prod.config.json` ist gitignored (enthält instanzspezifische Werte, kein Code) und wird nicht committet. Das Skript ist idempotent – bereits vorhandene Organisation/Admin/Formulare werden übersprungen. Es setzt kein Keycloak-Passwort für den Admin; das initiale Passwort über die Keycloak-Admin-Konsole vergeben.

---

## Nützliche Befehle

```bash
# Dev-Infrastruktur zurücksetzen (Prisma-Reset + Keycloak neu anlegen)
./resetDevEnvironment.sh

# Datenbank mit Testdaten befüllen (Dev-Seed, idempotent)
cd backend && npm run seed:dev

# Produktivinstanz initialisieren (Admin, Org, Formulare - benötigt seed-prod.config.json)
cd backend && npm run seed:prod

# Prisma Studio (Datenbank-Browser)
cd backend && npx prisma studio

# Datenbank-Schema visualisieren
cd backend && npx prisma migrate status

# Frontend-Build
cd frontend && npm run build

# Backend-Build (TypeScript kompilieren)
cd backend && npm run build

# Linting Frontend
cd frontend && npm run lint
```

---

## Projektstruktur

```
FH_Digihub/
│
├── backend/
│   ├── controller/          # Business-Logik pro Entität
│   ├── middleware/          # Passport-Auth, SuperJSON, etc.
│   ├── prisma/
│   │   ├── schema.prisma    # Datenbankschema
│   │   ├── migrations/      # Migrationsverlauf
│   │   ├── seed-dev.ts      # Entwicklungs-Seed (Testdaten)
│   │   ├── seed-prod.ts     # Produktions-Seed (Admin, Org, Formulare)
│   │   └── seed-prod.config.example.json  # Vorlage für seed-prod.config.json (nicht committet)
│   ├── routes/              # Express-Router pro Ressource
│   ├── config.ts            # Umgebungsvariablen
│   ├── loadEnv.ts           # Lädt die Root-.env (einmalig, pfadsicher)
│   ├── index.ts             # App-Einstiegspunkt
│   └── keycloak.ts          # Keycloak-Admin-Setup
│
├── frontend/
│   └── src/app/
│       ├── auth/            # Guards, Keycloak-Integration
│       ├── components/      # Wiederverwendbare Komponenten
│       ├── interceptors/    # HTTP-Interceptoren (Token, SuperJSON)
│       ├── pages/           # Seitenkomponenten (je Route eine)
│       ├── services/        # Angular-Services (API-Kommunikation)
│       ├── pipes/           # Datentransformations-Pipes
│       └── app.routes.ts    # Routing-Konfiguration
│
├── shared/
│   ├── generated/prisma/    # Auto-generierte Prisma-Typen (nicht manuell editieren)
│   ├── keycloak-config/     # Realm-Export für automatischen Import
│   └── sharedGlobals.ts     # Globale Typ-Erweiterungen
│
├── docker-compose.yaml          # Produktiv-Stack
├── docker-compose-dev.yaml      # Dev-Infrastruktur
├── .env.example                 # Vorlage für die Root-.env (alle Dienste)
└── resetDevEnvironment.sh       # Dev-Umgebung zurücksetzen
```

---

## Hinweise zur Entwicklung

- **Shared Types**: Prisma-Typen werden in `shared/generated/prisma` generiert und direkt in Frontend und Backend importiert. Nach jeder Schema-Änderung `npx prisma generate` ausführen.
- **SuperJSON**: Wird als Middleware im Backend und als HTTP-Interceptor im Frontend verwendet, um Dates und andere nicht-JSON-serialisierbare Typen korrekt zu übertragen.
- **Anonymisierte Statistiken**: Der `/stats`-Endpunkt liefert ausschließlich aggregierte, nicht-personenbezogene Daten für das Statistik-Dashboard. `Admin`/`Controller` sehen alle Organisationen; `OrgController`, `OrgCoordinator` und `SubOrgCoordinator` erhalten serverseitig erzwungen nur die Daten ihrer eigenen Organisation/Unterorganisation.
- **Formular-Sichtbarkeit**: `CaseForm`/`GeneralForm` haben ein optionales `organisationId`-Feld. `null` bedeutet global sichtbar/nutzbar, ein gesetzter Wert bindet die Definition an eine Organisation. Beim Auflisten werden Nutzern automatisch nur globale plus die Formulare der eigenen Organisation angezeigt.
