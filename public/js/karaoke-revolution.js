const italianDate =
    new Intl.DateTimeFormat("it-IT", {
        day: "2-digit",
        month: "long",
        year: "numeric"
    });

const italianWeekday =
    new Intl.DateTimeFormat("it-IT", {
        weekday: "long"
    });

loadSite();

async function loadSite() {

    try {

        const response =
            await fetch("/api/karaoke-revolution/public");

        const data =
            await response.json();

        renderSettings(data.settings || {});
        renderEvents(data.events || []);
        renderPartners(data.partners || []);

    } catch (err) {

        document.getElementById("eventsGrid").innerHTML =
            `<div class="emptyState">Le serate non sono disponibili al momento.</div>`;

        document.getElementById("partnersGrid").innerHTML =
            `<div class="emptyState">I locali partner non sono disponibili al momento.</div>`;

    }

}

function renderSettings(settings) {

    setLink("instagramHero", settings.instagramUrl);
    setLink("instagramSection", settings.instagramUrl);
    setLink("instagramContact", settings.instagramUrl);
    setLink("whatsappLink", settings.whatsappUrl);
    setLink("appLink", settings.appUrl || "/karaoke.html");

    const emailLink =
        document.getElementById("emailLink");

    if (emailLink) {
        emailLink.href = `mailto:${settings.email || "info@karaokerevolution.it"}`;
    }

}

function renderEvents(events) {

    const grid =
        document.getElementById("eventsGrid");

    if (!events.length) {
        grid.innerHTML =
            `<div class="emptyState">Nessuna serata pubblicata. Torna presto per le nuove date.</div>`;
        return;
    }

    grid.innerHTML =
        events.map(event => {

            const date =
                parseDate(event.date);

            const calendarUrl =
                buildCalendarUrl(event, date);

            return `
                <article class="eventCard">
                    ${event.imageUrl ? `<img class="eventPoster" src="${escapeAttr(event.imageUrl)}" alt="Locandina ${escapeAttr(event.venue)}">` : ""}
                    <div class="eventMeta">
                        <span class="pill">${date ? italianWeekday.format(date) : ""}</span>
                        <span class="pill">${date ? italianDate.format(date) : escapeHtml(event.date)}</span>
                        <span class="pill">${escapeHtml(event.time)}</span>
                    </div>
                    <h3>${escapeHtml(event.venue)}</h3>
                    <p><strong>${escapeHtml(event.city)}</strong></p>
                    <p>${escapeHtml(event.description)}</p>
                    <div class="cardActions">
                        <a class="button secondary" href="${escapeAttr(event.mapsUrl || "#")}" target="_blank" rel="noreferrer">Apri Maps</a>
                        <a class="button ghost" href="${calendarUrl}">Aggiungi al calendario</a>
                    </div>
                </article>
            `;

        }).join("");

}

function renderPartners(partners) {

    const grid =
        document.getElementById("partnersGrid");

    if (!partners.length) {
        grid.innerHTML =
            `<div class="emptyState">I locali partner saranno pubblicati a breve.</div>`;
        return;
    }

    grid.innerHTML =
        partners.map(partner => `
            <article class="partnerCard">
                <h3>${escapeHtml(partner.name)}</h3>
                <p>${escapeHtml(partner.city)}</p>
                <p>${escapeHtml(partner.recurringDay)}</p>
                <a class="button ghost" href="${escapeAttr(partner.mapsUrl || "#")}" target="_blank" rel="noreferrer">Apri Maps</a>
            </article>
        `).join("");

}

function setLink(id, url) {

    const element =
        document.getElementById(id);

    if (element && url) {
        element.href = url;
    }

}

function buildCalendarUrl(event, date) {

    if (!date) {
        return "#";
    }

    const start =
        compactDateTime(event.date, event.time);

    const endDate =
        new Date(date.getTime());

    const [hours, minutes] =
        String(event.time || "21:30").split(":").map(Number);

    endDate.setHours(hours + 3, minutes || 0, 0, 0);

    const params =
        new URLSearchParams({
            action: "TEMPLATE",
            text: `KARAOKE R-EVOLUTION - ${event.venue}`,
            dates: `${start}/${compactDateObject(endDate)}`,
            details: event.description || "Serata KARAOKE R-EVOLUTION",
            location: event.address || event.city || event.venue
        });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;

}

function compactDateTime(date, time) {
    return `${date.replaceAll("-", "")}T${String(time || "21:30").replace(":", "")}00`;
}

function compactDateObject(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}${month}${day}T${hours}${minutes}00`;
}

function parseDate(value) {

    const date =
        new Date(`${value}T12:00:00`);

    return Number.isNaN(date.getTime()) ? null : date;

}

function escapeHtml(value) {
    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
    return escapeHtml(value);
}
