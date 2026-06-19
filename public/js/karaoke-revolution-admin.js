const tokenKey =
    "kreAdminToken";

let state = null;

const loginPanel =
    document.getElementById("loginPanel");

const dashboard =
    document.getElementById("adminDashboard");

document.getElementById("loginForm").addEventListener("submit", login);
document.getElementById("eventForm").addEventListener("submit", saveEvent);
document.getElementById("partnerForm").addEventListener("submit", savePartner);
document.getElementById("saveSettings").addEventListener("click", saveSettings);
document.getElementById("resetEventForm").addEventListener("click", resetEventForm);
document.getElementById("resetPartnerForm").addEventListener("click", resetPartnerForm);
document.getElementById("generateRecurring").addEventListener("click", generateRecurring);

if (localStorage.getItem(tokenKey)) {
    loadAdminState();
}

async function login(event) {

    event.preventDefault();

    const message =
        document.getElementById("loginMessage");

    message.textContent = "";

    try {

        const response =
            await fetch("/api/karaoke-revolution/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    password: document.getElementById("passwordInput").value
                })
            });

        const data =
            await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Accesso non riuscito");
        }

        localStorage.setItem(tokenKey, data.token);
        await loadAdminState();

    } catch (err) {
        message.textContent = err.message;
    }

}

async function loadAdminState() {

    try {

        state =
            await api("/api/karaoke-revolution/admin/state");

        loginPanel.classList.add("hidden");
        dashboard.classList.remove("hidden");
        renderAdmin();

    } catch (err) {
        localStorage.removeItem(tokenKey);
        loginPanel.classList.remove("hidden");
        dashboard.classList.add("hidden");
    }

}

function renderAdmin() {
    renderSettings();
    renderEvents();
    renderPartners();
}

function renderSettings() {

    const settings =
        state.settings || {};

    value("settingsWhatsapp", settings.whatsappUrl);
    value("settingsInstagram", settings.instagramUrl);
    value("settingsEmail", settings.email);
    value("settingsApp", settings.appUrl);

}

function renderEvents() {

    const list =
        document.getElementById("eventsList");

    if (!state.events.length) {
        list.innerHTML = `<div class="emptyState">Nessun evento inserito.</div>`;
        return;
    }

    list.innerHTML =
        state.events.map(event => `
            <article class="adminItem">
                <div>
                    <h3>${escapeHtml(event.venue)} - ${escapeHtml(event.city)}</h3>
                    <p>${escapeHtml(event.date)} alle ${escapeHtml(event.time)} ${event.visible ? "" : " - nascosto"}</p>
                </div>
                <div class="adminItemActions">
                    <button class="button ghost" type="button" data-action="edit-event" data-id="${event.id}">Modifica</button>
                    <button class="button secondary" type="button" data-action="duplicate-event" data-id="${event.id}">Duplica</button>
                    <button class="button ghost" type="button" data-action="delete-event" data-id="${event.id}">Elimina</button>
                </div>
            </article>
        `).join("");

    list.querySelectorAll("button").forEach(button => {
        button.addEventListener("click", handleListAction);
    });

}

function renderPartners() {

    const list =
        document.getElementById("partnersList");

    if (!state.partners.length) {
        list.innerHTML = `<div class="emptyState">Nessun locale inserito.</div>`;
        return;
    }

    list.innerHTML =
        state.partners.map(partner => `
            <article class="adminItem">
                <div>
                    <h3>${escapeHtml(partner.name)} - ${escapeHtml(partner.city)}</h3>
                    <p>${escapeHtml(partner.recurringDay)} ${partner.visible ? "" : " - nascosto"}</p>
                </div>
                <div class="adminItemActions">
                    <button class="button ghost" type="button" data-action="edit-partner" data-id="${partner.id}">Modifica</button>
                    <button class="button ghost" type="button" data-action="delete-partner" data-id="${partner.id}">Elimina</button>
                </div>
            </article>
        `).join("");

    list.querySelectorAll("button").forEach(button => {
        button.addEventListener("click", handleListAction);
    });

}

async function saveSettings() {

    state =
        await api(
            "/api/karaoke-revolution/admin/settings",
            {
                method: "PUT",
                body: {
                    whatsappUrl: value("settingsWhatsapp"),
                    instagramUrl: value("settingsInstagram"),
                    email: value("settingsEmail"),
                    appUrl: value("settingsApp")
                }
            }
        );

    renderAdmin();

}

async function saveEvent(event) {

    event.preventDefault();

    const id =
        value("eventId");

    state =
        await api(
            id ?
                `/api/karaoke-revolution/admin/events/${id}` :
                "/api/karaoke-revolution/admin/events",
            {
                method: id ? "PUT" : "POST",
                body: eventPayload()
            }
        );

    resetEventForm();
    renderAdmin();

}

async function savePartner(event) {

    event.preventDefault();

    const id =
        value("partnerId");

    state =
        await api(
            id ?
                `/api/karaoke-revolution/admin/partners/${id}` :
                "/api/karaoke-revolution/admin/partners",
            {
                method: id ? "PUT" : "POST",
                body: partnerPayload()
            }
        );

    resetPartnerForm();
    renderAdmin();

}

async function generateRecurring() {

    state =
        await api(
            "/api/karaoke-revolution/admin/events/recurring",
            {
                method: "POST",
                body: {
                    event: eventPayload(),
                    count: value("recurringCount"),
                    intervalDays: value("recurringInterval")
                }
            }
        );

    resetEventForm();
    renderAdmin();

}

async function handleListAction(event) {

    const action =
        event.currentTarget.dataset.action;

    const id =
        Number(event.currentTarget.dataset.id);

    if (action === "edit-event") {
        fillEventForm(state.events.find(item => item.id === id));
        return;
    }

    if (action === "edit-partner") {
        fillPartnerForm(state.partners.find(item => item.id === id));
        return;
    }

    if (action === "duplicate-event") {
        const source =
            state.events.find(item => item.id === id);

        state =
            await api(
                `/api/karaoke-revolution/admin/events/${id}/duplicate`,
                {
                    method: "POST",
                    body: {
                        date: source ? source.date : ""
                    }
                }
            );

        renderAdmin();
        return;
    }

    if (action === "delete-event") {
        state =
            await api(
                `/api/karaoke-revolution/admin/events/${id}`,
                {
                    method: "DELETE"
                }
            );
        renderAdmin();
        return;
    }

    if (action === "delete-partner") {
        state =
            await api(
                `/api/karaoke-revolution/admin/partners/${id}`,
                {
                    method: "DELETE"
                }
            );
        renderAdmin();
    }

}

function eventPayload() {

    return {
        date: value("eventDate"),
        time: value("eventTime"),
        venue: value("eventVenue"),
        city: value("eventCity"),
        address: value("eventAddress"),
        mapsUrl: value("eventMaps"),
        description: value("eventDescription"),
        imageUrl: value("eventImage"),
        visible: document.getElementById("eventVisible").checked
    };

}

function partnerPayload() {

    return {
        name: value("partnerName"),
        city: value("partnerCity"),
        recurringDay: value("partnerDay"),
        mapsUrl: value("partnerMaps"),
        visible: document.getElementById("partnerVisible").checked
    };

}

function fillEventForm(event) {

    if (!event) {
        return;
    }

    value("eventId", event.id);
    value("eventDate", event.date);
    value("eventTime", event.time);
    value("eventVenue", event.venue);
    value("eventCity", event.city);
    value("eventAddress", event.address);
    value("eventMaps", event.mapsUrl);
    value("eventDescription", event.description);
    value("eventImage", event.imageUrl);
    document.getElementById("eventVisible").checked = event.visible;
    document.getElementById("eventDate").focus();

}

function fillPartnerForm(partner) {

    if (!partner) {
        return;
    }

    value("partnerId", partner.id);
    value("partnerName", partner.name);
    value("partnerCity", partner.city);
    value("partnerDay", partner.recurringDay);
    value("partnerMaps", partner.mapsUrl);
    document.getElementById("partnerVisible").checked = partner.visible;
    document.getElementById("partnerName").focus();

}

function resetEventForm() {
    document.getElementById("eventForm").reset();
    value("eventId", "");
    value("eventTime", "21:30");
    document.getElementById("eventVisible").checked = true;
}

function resetPartnerForm() {
    document.getElementById("partnerForm").reset();
    value("partnerId", "");
    document.getElementById("partnerVisible").checked = true;
}

async function api(url, options = {}) {

    const response =
        await fetch(
            url,
            {
                method: options.method || "GET",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${localStorage.getItem(tokenKey) || ""}`
                },
                body: options.body ? JSON.stringify(options.body) : undefined
            }
        );

    const data =
        await response.json();

    if (!response.ok) {
        throw new Error(data.error || "Errore richiesta");
    }

    return data;

}

function value(id, nextValue) {

    const element =
        document.getElementById(id);

    if (arguments.length === 2) {
        element.value = nextValue || "";
        return "";
    }

    return element.value.trim();

}

function escapeHtml(value) {
    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
