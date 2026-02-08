const monthsNL = [
  "januari",
  "februari",
  "maart",
  "april",
  "mei",
  "juni",
  "juli",
  "augustus",
  "september",
  "oktober",
  "november",
  "december",
];

let currentAudio = null;

function displayCollection(list = collection) {
  const container = document.getElementById("collection");
  const emptyMsg = document.getElementById("emptyMessage");
  const filter = document.getElementById("collectionFilter").value;
  container.innerHTML = "";
  if (list.length === 0) {
    emptyMsg.classList.remove("hidden");
    return;
  }
  emptyMsg.classList.add("hidden");

  let grouped = {};
  let sortedList = [...list];

  if (filter === "artist") {
    sortedList.sort((a, b) => a.artist.localeCompare(b.artist));
    sortedList.forEach((item) => {
      (grouped[item.artist] ??= []).push(item);
    });
  } else if (filter === "year") {
    sortedList.sort((a, b) => (a.year || 0) - (b.year || 0));
    sortedList.forEach((item) => {
      (grouped[item.year] ??= []).push(item);
    });
  } else if (filter === "recent") {
    sortedList.sort((a, b) => b.added - a.added);
    grouped["Recent toegevoegd"] = sortedList;
  } else {
    sortedList.sort((a, b) => a.album.localeCompare(b.album));
    grouped["Alle albums"] = sortedList;
  }

  for (const group in grouped) {
    if (group !== "Alle albums" && group !== "Recent toegevoegd")
      container.innerHTML += `<div class="group-label"><span>${group}</span></div>`;
    else if (group === "Recent toegevoegd")
      container.innerHTML += `<div class="group-label"><span>Recent toegevoegd</span></div>`;

    container.innerHTML += `<div class="grid" id="group-${group}"></div>`;
    const groupContainer = document.getElementById(`group-${group}`);
    grouped[group].forEach((item) => {
      groupContainer.innerHTML += `
            <div class="card" onclick="openAlbumDetails('${escapeQuotes(item.artist)}','${escapeQuotes(item.album)}')">
              <div class="card-content">
                <img src="${item.cover}">
                <p><strong>${item.artist}</strong><br>${item.album} (${item.year})</p>
              </div>
              <button class="remove-btn" onclick="removeFromCollection(${collection.indexOf(item)});event.stopPropagation();">Verwijderen</button>
            </div>
            `;
    });
  }
}

function filterCollection() {
  const term = document.getElementById("collectionSearch").value.toLowerCase();
  const filtered = collection.filter((item) => {
    const tracks =
      item.tracks?.some((t) => t.name.toLowerCase().includes(term)) || false;
    return (
      item.artist.toLowerCase().includes(term) ||
      item.album.toLowerCase().includes(term) ||
      tracks
    );
  });
  displayCollection(filtered);
}

function removeFromCollection(index) {
  collection.splice(index, 1);
  saveCollection();
  filterCollection();
}
function openModal() {
  document.getElementById("modal").style.display = "flex";
  document.body.style.overflow = "hidden";
}
function closeModal() {
  document.getElementById("modal").style.display = "none";
  document.getElementById("results").innerHTML = "";
  document.getElementById("searchInput").value = "";
  document.body.style.overflow = "auto";
}

function searchAlbums() {
  const query = document.getElementById("searchInput").value.trim();
  const resultsDiv = document.getElementById("results");
  resultsDiv.innerHTML = "";
  if (!query) return;

  fetch(
    `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=album&limit=20`,
  )
    .then((res) => res.json())
    .then((data) => {
      data.results.forEach((album) => {
        const year = album.releaseDate ? album.releaseDate.slice(0, 4) : "—";
        const cover = album.artworkUrl100.replace("100x100", "300x300");
        const exists = collection.some(
          (item) =>
            item.artist === album.artistName &&
            item.album === album.collectionName,
        );
        const buttonHTML = exists
          ? '<button class="remove-btn" disabled>✅ Toegevoegd</button>'
          : `<button onclick="addToCollection('${escapeQuotes(album.artistName)}','${escapeQuotes(album.collectionName)}','${year}','${cover}','${album.collectionId}')">Toevoegen</button>`;

        resultsDiv.innerHTML += `
          <div class="card">
            <div class="card-content" onclick="openAlbumDetails('${escapeQuotes(album.artistName)}','${escapeQuotes(album.collectionName)}')">
              <img src="${cover}">
              <p><strong>${album.artistName}</strong><br>${album.collectionName} (${year})</p>
            </div>
            ${buttonHTML}
          </div>
        `;
      });
    });
}

function addToCollection(artist, album, year, cover, collectionId) {
  const exists = collection.some(
    (item) => item.artist === artist && item.album === album,
  );
  if (exists) {
    alert("Staat al in je collectie!");
    return;
  }

  // Fetch tracks immediately to store for search
  fetch(`https://itunes.apple.com/lookup?id=${collectionId}&entity=song`)
    .then((res) => res.json())
    .then((data) => {
      const tracks = data.results
        .filter((t) => t.wrapperType === "track")
        .map((t) => ({
          trackNumber: t.trackNumber,
          name: t.trackName,
          previewUrl: t.previewUrl,
          explicit: t.trackExplicitness,
        }));
      collection.push({
        artist,
        album,
        year,
        cover,
        added: Date.now(),
        tracks,
      });
      saveCollection();
      closeModal();
      filterCollection();
    });
}

function escapeQuotes(str) {
  return str.replace(/'/g, "\\'").replace(/"/g, '\\"');
}

function openAlbumDetails(artist, album) {
  document.getElementById("albumModal").style.display = "flex";
  document.body.style.overflow = "hidden";
  const infoDiv = document.getElementById("albumInfo");
  const tracksDiv = document.getElementById("albumTracks");
  infoDiv.innerHTML = "Laden...";
  tracksDiv.innerHTML = '<div class="loader"></div>';

  fetch(
    `https://itunes.apple.com/search?term=${encodeURIComponent(artist + " " + album)}&entity=album&limit=1`,
  )
    .then((res) => res.json())
    .then((data) => {
      if (!data.results || !data.results[0]) {
        infoDiv.innerHTML = "Album informatie niet gevonden";
        tracksDiv.innerHTML = "";
        return;
      }
      const albumData = data.results[0];
      const cover = albumData.artworkUrl100.replace("100x100", "300x300");
      const date = new Date(albumData.releaseDate);
      const dateNL = `${date.getDate()} ${monthsNL[date.getMonth()]} ${date.getFullYear()}`;
      infoDiv.innerHTML = `
              <img src="${cover}">
              <h2>${albumData.collectionName}</h2>
              <div class="info"><strong>Artiest:</strong> ${albumData.artistName}</div>
              <div class="info"><strong>Uitgebracht:</strong> ${dateNL}</div>
              <div class="info"><strong>Totaal nummers:</strong> ${albumData.trackCount}</div>
            `;

      fetch(
        `https://itunes.apple.com/lookup?id=${albumData.collectionId}&entity=song`,
      )
        .then((res) => res.json())
        .then((trackData) => {
          const tracks = trackData.results.filter(
            (t) => t.wrapperType === "track",
          );
          const grouped = {};
          tracks.forEach((t) => {
            (grouped[t.discNumber] ??= []).push(t);
          });
          tracksDiv.innerHTML = "";
          for (const disc in grouped) {
            tracksDiv.innerHTML += `<div class="disc-title">Schijf ${disc} (Nummers: ${grouped[disc].length})</div>`;
            grouped[disc].forEach((t) => {
              const minutes = Math.floor(t.trackTimeMillis / 60000);
              const seconds = Math.floor((t.trackTimeMillis % 60000) / 1000)
                .toString()
                .padStart(2, "0");
              const duration = `${minutes}:${seconds}`;
              const explicitTag =
                t.trackExplicitness === "explicit" ||
                t.trackExplicitness === "cleaned"
                  ? '<span class="explicit-tag">Expliciet</span>'
                  : "";
              tracksDiv.innerHTML += `
                      <div class="track-item">
                        <span class="track-left">${t.trackNumber}. ${t.trackName} ${explicitTag}</span>
                        <span class="track-right">
                          ${duration} 
                          <audio controls src="${t.previewUrl}"></audio>
                        </span>
                      </div>
                    `;
            });
          }

          const audios = tracksDiv.querySelectorAll("audio");
          audios.forEach((a) => {
            a.addEventListener("play", () => {
              audios.forEach((o) => {
                if (o !== a) {
                  o.pause();
                  o.currentTime = 0;
                }
              });
            });
          });
        });
    });
}

function closeAlbumModal() {
  document.getElementById("albumModal").style.display = "none";
  document.body.style.overflow = "auto";
  const audios = document
    .getElementById("albumTracks")
    .querySelectorAll("audio");
  audios.forEach((a) => {
    a.pause();
    a.currentTime = 0;
  });
}

displayCollection();
