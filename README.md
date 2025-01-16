# Online Notepad App
## Descrizione
Online Notepad App è un'applicazione web progettata per offrire un'esperienza avanzata nella gestione di note, checklist, diari e documenti. Ideale per studenti, lavoratori e utenti casuali, la piattaforma consente di creare, visualizzare, modificare e condividere note in qualsiasi momento e da qualsiasi dispositivo.

L'obiettivo principale è fornire uno strumento moderno, semplice da usare, con funzionalità di condivisione avanzate e il supporto per modifiche collaborative.

## Funzionalità
Gestione delle note personalizzate:
- Appunti semplici.
- Checklist.
- Diario.

Lettura e modifica di file:
- Supporto per caricamento e modifica di documenti direttamente nell'app.

Account personali:
- Registrazione e login sicuro tramite email e password.
- Supporto OAuth2 (es. Google, Facebook, ecc.).

Condivisione:
- Condividi le note con altri utenti registrati.
- Sincronizzazione tra dispositivi.

PWA ready (in futuro):
- Accesso offline e installazione su dispositivi mobili.

Sicurezza:
- Autenticazione basata su JWT (JSON Web Tokens).
- Autorizzazione per limitare l'accesso alle risorse.
## Stack Tecnologico
Frontend
- Linguaggio: JavaScript (ES6+)
- Framework: React.js
- Stato globale: Redux Toolkit
- Chiamate API: Axios
- UI Design:
  - Tailwind CSS: Per uno stile modulare e moderno.
  - Quill.js: Per l'editor avanzato di testo.

Backend
- Linguaggio: Java
- Framework: Spring Boot
- Autenticazione e Sicurezza:
  - Spring Security con JWT.
  - OAuth2 per login tramite provider esterni.
- Database: MongoDB: Database NoSQL flessibile e scalabile.
- Build Tool: Maven

Integrazioni e Altre Tecnologie
Service Worker e PWA:
Workbox (futuro sviluppo).
Test:
Backend: JUnit e Mockito per test unitari e di integrazione.
Frontend: Jest e React Testing Library per test sui componenti React.
End-to-End (E2E): Cypress.
Requisiti di sistema
Backend:
Java 11 o superiore.
Maven 3.6+.
MongoDB Community Server.
Frontend:
Node.js 16+.
npm o yarn.
Installazione
Clonazione del repository
bash
Copia
Modifica
git clone https://github.com/tuo-username/online-notepad.git
cd online-notepad
Configurazione Backend
Vai nella directory del backend:
bash
Copia
Modifica
cd backend
Configura le variabili d'ambiente per il database e le chiavi JWT:
application.properties:
properties
Copia
Modifica
spring.data.mongodb.uri=mongodb://localhost:27017/notepad-db
jwt.secret=<chiave-segreta-jwt>
Avvia l'applicazione Spring Boot:
bash
Copia
Modifica
mvn spring-boot:run
Configurazione Frontend
Vai nella directory del frontend:
bash
Copia
Modifica
cd frontend
Installa le dipendenze:
bash
Copia
Modifica
npm install
Avvia il server di sviluppo:
bash
Copia
Modifica
npm start
Apri l'app nel browser:
arduino
Copia
Modifica
http://localhost:3000
API Endpoints
Autenticazione
POST /api/auth/register: Registra un nuovo utente.
POST /api/auth/login: Autentica un utente e restituisce un JWT.
Gestione Note
GET /api/notes: Recupera tutte le note dell'utente.
POST /api/notes: Crea una nuova nota.
PUT /api/notes/{id}: Modifica una nota esistente.
DELETE /api/notes/{id}: Elimina una nota.
Roadmap
 Configurazione base di Spring Boot con MongoDB.
 Autenticazione JWT e OAuth2.
 Frontend React con Redux Toolkit.
 Supporto PWA (Workbox).
 Implementazione offline-first (IndexedDB).
 Condivisione avanzata tra utenti.
Contributi
Contributi, bug report e suggerimenti sono i benvenuti! Per contribuire:

Fai un fork del repository.
Crea un branch per la tua feature/bugfix:
bash
Copia
Modifica
git checkout -b feature/nome-feature
Invia una pull request.
