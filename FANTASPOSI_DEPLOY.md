# Fantasposi online

## Deploy rapido su Render

1. Crea un repository GitHub con questo progetto.
2. Vai su Render e crea un nuovo `Blueprint`.
3. Collega il repository.
4. Render leggerà `render.yaml`.
5. Dopo il deploy avrai un URL pubblico tipo:
   `https://fantasposi.onrender.com`

## Link utili

- Invitati: `/fantasposi.html`
- Admin: `/fantasposi-admin.html`

Esempio:

- `https://fantasposi.onrender.com/fantasposi.html`
- `https://fantasposi.onrender.com/fantasposi-admin.html`

## Dati

Il file evento viene salvato in `FANTASPOSI_DATA_DIR`.
Su Render il file `render.yaml` monta un disco su `/var/data`, cosi tavoli,
iscritti, sfide e punteggi non si perdono a ogni riavvio.

## Nota importante

Il pannello admin al momento non ha ancora password. Non condividere il link admin
con gli invitati. La prossima cosa da aggiungere e un PIN admin.
