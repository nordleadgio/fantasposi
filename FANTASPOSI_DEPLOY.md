# Scheda sposi online

## Deploy rapido su Render

1. Crea o aggiorna il repository GitHub con questo progetto.
2. Vai su Render e crea/aggiorna il Blueprint collegato al repository.
3. Render leggerà `render.yaml`.
4. Dopo il deploy avrai un URL pubblico tipo:
   `https://fantasposi.onrender.com`

## Link principali

- Admin scheda sposi: `/admin`
- Admin alternativo: `/schede-musicali-admin`
- Link sposi: `/scheda-musicale/CODICE_SCHEDA`

Esempio:

- `https://fantasposi.onrender.com/admin`
- `https://fantasposi.onrender.com/scheda-musicale/abc123`

## Link vecchio Fantasposi

Il vecchio Fantasposi resta disponibile, ma non e piu l'app principale.

- Invitati Fantasposi: `/fantasposi.html`
- Admin Fantasposi: `/fantasposi-admin.html`

## Dati

I dati vengono salvati in `FANTASPOSI_DATA_DIR`.
Su Render il file `render.yaml` monta un disco su `/var/data`, cosi schede,
risposte e dati Fantasposi non si perdono a ogni riavvio.

## Sicurezza

Imposta su Render una password admin sicura con la variabile:

`FANTASPOSI_ADMIN_PASSWORD`
