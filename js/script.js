let map;
let countryBorders;
let countryLayer;
let currentCountry = null;
let globalExchangeRate = null;
let globalCurrencyCode = null;
let modalIsLoading = false;

let airportLayer = L.markerClusterGroup();
let cityLayer = L.markerClusterGroup();
let earthquakeLayer = L.markerClusterGroup();

const icons = {
  airport: L.icon({ iconUrl: "images/airport.png", iconSize: [40, 40] }),
  city: L.icon({ iconUrl: "images/location-pin.png", iconSize: [30, 30] }),
  earthquake: L.icon({ iconUrl: "images/earthquake.png", iconSize: [30, 30] })
};

const streetView = L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenTopoMap contributors"
});
const imageView = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
  attribution: "Tiles &copy; Esri"
});

function initMap() {
  map = L.map("map", {
    center: [20, 0],
    zoom: 2,
    layers: [streetView]
  });

  const baseMaps = { "Street View": streetView, "Image View": imageView };
  const overlayMaps = { "Airports": airportLayer, "Cities": cityLayer, "Earthquakes": earthquakeLayer };
  L.control.layers(baseMaps, overlayMaps, { collapsed: true }).addTo(map);

  map.on("overlayadd", (e) => {
    if (!currentCountry) return;
    if (e.name === "Airports") fetchLayerData("airports");
    if (e.name === "Cities") fetchLayerData("cities");
    if (e.name === "Earthquakes") fetchLayerData("earthquakes");
  });

  map.on("overlayremove", (e) => {
    if (e.name === "Airports") airportLayer.clearLayers();
    if (e.name === "Cities") cityLayer.clearLayers();
    if (e.name === "Earthquakes") earthquakeLayer.clearLayers();
  });

  loadBorders();
  setupSearchFilter();
  initEasyButtons();
}

function loadBorders() {
  fetch("data/countryBorders.geo.json")
    .then(res => {
      if (!res.ok) throw new Error("Failed to load borders");
      return res.json();
    })
    .then(geojson => {
      countryBorders = geojson;
      populateDropdown(geojson.features);
      detectUserLocation();
    })
    .catch(err => {
      console.error("Error loading borders:", err);
      alert("Failed to load country borders data");
    });
}

function detectUserLocation() {
  if (!navigator.geolocation) return alert("Geolocation not supported.");
  navigator.geolocation.getCurrentPosition(
    pos => reverseGeocode(pos.coords.latitude, pos.coords.longitude),
    () => alert("Location access denied."),
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

function reverseGeocode(lat, lon) {
  fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`)
    .then(res => res.json())
    .then(data => {
      const detectedCountry = data.address?.country;
      if (detectedCountry) {
        const match = countryBorders.features.find(f =>
          f.properties.name.toLowerCase() === detectedCountry.toLowerCase()
        );
        if (match) {
          currentCountry = match;
          highlightCountry(match);
          document.getElementById("countrySelect").value = match.properties.iso_a2;
          showModal("all");
        }
      }
    })
    .catch(err => console.error("Reverse geocoding failed:", err));
}

function highlightCountry(feature) {
  currentCountry = feature;
  if (countryLayer) map.removeLayer(countryLayer);
  countryLayer = L.geoJSON(feature, {
    style: { color: "blue", weight: 2, fillOpacity: 0.2 }
  }).addTo(map);
  map.fitBounds(countryLayer.getBounds());
  if (map.hasLayer(airportLayer)) fetchLayerData("airports");
  if (map.hasLayer(cityLayer)) fetchLayerData("cities");
  if (map.hasLayer(earthquakeLayer)) fetchLayerData("earthquakes");
}

function populateDropdown(features) {
  const select = document.getElementById("countrySelect");
  features.forEach(f => {
    const opt = document.createElement("option");
    opt.value = f.properties.iso_a2;
    opt.textContent = f.properties.name;
    select.appendChild(opt);
  });

  select.addEventListener("change", function() {
    const match = features.find(f => f.properties.iso_a2 === this.value);
    if (match) {
      highlightCountry(match);
      showModal("all");
    }
  });
}

function setupSearchFilter() {
  document.getElementById("searchInput").addEventListener("input", function() {
    const value = this.value.toLowerCase();
    Array.from(document.getElementById("countrySelect").options).forEach(opt => {
      opt.style.display = opt.text.toLowerCase().includes(value) ? "" : "none";
    });
  });
}

function fetchLayerData(type) {
  if (!currentCountry) return;
  const code = currentCountry.properties.iso_a2;
  const url = `php/getGeoNamesData.php?type=${type}&code=${code}`;
  let layer, icon, label;

  if (type === "airports") { 
    airportLayer.clearLayers(); 
    layer = airportLayer; 
    icon = icons.airport; 
    label = "Airport"; 
  }
  else if (type === "cities") { 
    cityLayer.clearLayers(); 
    layer = cityLayer; 
    icon = icons.city; 
    label = "City"; 
  }
  else if (type === "earthquakes") { 
    earthquakeLayer.clearLayers(); 
    layer = earthquakeLayer; 
    icon = icons.earthquake; 
    label = "Magnitude"; 
  }

  fetch(url)
    .then(res => {
      if (!res.ok) throw new Error(`Failed to load ${type}`);
      return res.json();
    })
    .then(data => {
      if (!Array.isArray(data)) throw new Error("Invalid data format");
      
      data.forEach(item => {
        if (item.lat && item.lng) {
          const title = item.name || `${label}: ${item.magnitude || "?"}`;
          const marker = L.marker([item.lat, item.lng], { icon })
            .bindPopup(`<strong>${label}:</strong> ${title}`);
          
          if (type === "earthquakes" && item.magnitude) {
            marker.bindPopup(`
              <strong>Earthquake</strong><br>
              Magnitude: ${item.magnitude}<br>
              Depth: ${item.depth} km
            `);
          }
          
          marker.addTo(layer);
        }
      });
    })
    .catch(err => {
      console.error(`Error loading ${type} data:`, err);
      layer.bindPopup(`Failed to load ${type} data`).openPopup();
    });
}

function initEasyButtons() {
  const buttons = [
    { icon: 'fa-home', label: 'Full Info', type: 'all' },
    { icon: 'fa-landmark', label: 'Capital', type: 'capital' },
    { icon: 'fa-globe', label: 'Region', type: 'region' },
    { icon: 'fa-compass', label: 'Subregion', type: 'subregion' },
    { icon: 'fa-users', label: 'Population', type: 'population' },
    { icon: 'fa-dollar-sign', label: 'Currency', type: 'currency' },
    { icon: 'fa-cloud', label: 'Weather', type: 'weather' },
    { icon: 'fa-brands fa-wikipedia-w', label: 'Wikipedia', type: 'wikipedia' }
  ];

  buttons.forEach(btn => {
    L.easyButton(`fa ${btn.icon}`, () => {
      if (currentCountry) {
        showModal(btn.type);
      } else {
        alert("Please select a country first.");
      }
    }, btn.label).addTo(map);
  });
}

async function showModal(type) {
  if (!currentCountry || modalIsLoading) return;
  modalIsLoading = true;

  const infoModal = bootstrap.Modal.getOrCreateInstance(document.getElementById("infoModal"));
  document.getElementById("modalTitle").innerText = currentCountry.properties.name;
  document.getElementById("modalBody").innerHTML = `<div class="text-center p-3"><div class="spinner-border text-primary"></div><p>Fetching data...</p></div>`;
  infoModal.show();

  try {
    const countryCodeA2 = currentCountry.properties.iso_a2;
    const countryCodeA3 = currentCountry.properties.iso_a3;
    const countryName = currentCountry.properties.name;
    const [lon, lat] = currentCountry.geometry.coordinates[0][0];
    let countryData = null;
    let countryDataRes = await fetch(`php/getCountryData.php?code=${countryCodeA3}`);
    
    if (!countryDataRes.ok) {
      countryDataRes = await fetch(`php/getCountryData.php?code=${countryCodeA2}`);
      if (!countryDataRes.ok) throw new Error("Country data failed");
    }
    countryData = await countryDataRes.json();
    if (countryData.error) throw new Error(countryData.error);
    if (!countryData.name) {
      countryData = {
        name: { common: countryName },
        capital: ["N/A"],
        population: "N/A",
        region: "N/A",
        subregion: "N/A",
        currencies: null,
        flags: { png: "" }
      };
    }
    let currencyCode = "";
    let currencyName = "N/A";
    let currencySymbol = "-";
    
    if (countryData.currencies && Object.keys(countryData.currencies).length > 0) {
      const [code, info] = Object.entries(countryData.currencies)[0];
      currencyCode = code;
      currencyName = info?.name || "N/A";
      currencySymbol = info?.symbol || "-";
    }
    let weatherLat = lat;
    let weatherLng = lon;
    
    if (countryData.capitalInfo?.latlng) {
      [weatherLat, weatherLng] = countryData.capitalInfo.latlng;
    }
    const [weatherRes, rateRes] = await Promise.allSettled([
      fetch(`php/getWeather.php?lat=${weatherLat}&lng=${weatherLng}`),
      currencyCode ? fetch(`php/getCurrencyRate.php?currency=${currencyCode}`) : Promise.resolve(null)
    ]);

    const weather = weatherRes.status === "fulfilled" ? await weatherRes.value.json() : {};
    const rateData = rateRes.status === "fulfilled" && rateRes.value ? await rateRes.value.json() : {};

    globalExchangeRate = rateData?.rate || null;
    globalCurrencyCode = currencyCode;
    const name = countryData.name.common || countryName;
    const capital = countryData.capital?.[0] || "N/A";
    const population = countryData.population ? countryData.population.toLocaleString() : "N/A";
    const region = countryData.region || "N/A";
    const subregion = countryData.subregion || "N/A";
    const coat = countryData.coatOfArms?.png || "";
    const flag = countryData.flags?.png || "";
    const wiki = `https://en.wikipedia.org/wiki/${encodeURIComponent(name)}`;

    const rows = [];

    if (type === "all" || type === "capital") rows.push(makeRow("fa-flag", "Capital city", capital));
    if (type === "all" || type === "region") rows.push(makeRow("fa-globe", "Region", region));
    if (type === "all" || type === "subregion") rows.push(makeRow("fa-compass", "Subregion", subregion));
    if (type === "all" || type === "population") rows.push(makeRow("fa-users", "Population", population));
    
    if (type === "all" || type === "currency") {
      rows.push(makeRow("fa-dollar-sign", "Currency Symbol", currencySymbol));
      rows.push(makeRow("fa-coins", "Currency Name", `${currencyName} (${currencyCode}) <button class='btn btn-sm btn-outline-info ms-2 m-2 p-2' onclick="openCurrencyModal()">Convert</button>`));
      if (globalExchangeRate) {
        rows.push(makeRow("fa-exchange-alt", "Exchange Rate", `1 USD = ${globalExchangeRate.toFixed(2)} ${currencyCode}`));
      }
    }

    if ((type === "all" || type === "weather") && weather.main) {
      rows.push(`<div class="info-row"><span class="info-label w-100">${makeWeatherCard(weather)}</span></div>`);
    }

    if (type === "all" || type === "wikipedia") {
      rows.push(`<div class="info-row"><span class="info-icon"><i class="fa-brands fa-wikipedia-w"></i></span><span class="info-label">Wikipedia</span><span class="info-value"><a href="${wiki}" target="_blank">Click Here</a></span></div>`);
    }

    if (type === "all" && coat) {
      rows.push(`<div class="info-row"><span class="info-icon"><i class="fa fa-certificate"></i></span><span class="info-label">Coat of Arms</span><span class="info-value"><img src="${coat}" class="coat" /></span></div>`);
    }

    document.getElementById("modalTitle").innerHTML = flag ? 
      `<img src="${flag}" alt="Flag" style="height:30px; margin-right:10px; vertical-align:middle;" /> ${name}` : 
      name;
    document.getElementById("modalBody").innerHTML = rows.length ? rows.join("") : "<p>No data available for this section.</p>";

  } catch (err) {
    console.error("Modal error:", err);
    document.getElementById("modalBody").innerHTML = `
      <p class="text-danger">Failed to load complete country information.</p>
      <p>Basic information:</p>
      <div class="info-row">
        <span class="info-icon"><i class="fa fa-flag"></i></span>
        <span class="info-label">Country</span>
        <span class="info-value">${currentCountry.properties.name}</span>
      </div>
    `;
  } finally {
    modalIsLoading = false;
  }
}

function makeRow(icon, label, value) {
  return `<div class="info-row"><span class="info-icon"><i class="fa ${icon}"></i></span><span class="info-label">${label}</span><span class="info-value">${value}</span></div>`;
}

function makeWeatherCard(weather) {
  const icon = weather.weather?.[0]?.icon || "01d";
  const description = weather.weather?.[0]?.description || "";
  const temp = weather.main.temp;
  const pressure = weather.main.pressure;
  const humidity = weather.main.humidity;
  const wind = weather.wind.speed;
  const dewPoint = weather.main?.dew_point ?? "-";
  const visibility = weather.visibility ? (weather.visibility / 1000).toFixed(1) : "-";
  const precipitation = weather.rain?.["1h"] || 0;

  return `
    <div class="p-4 rounded shadow text-white" style="background: linear-gradient(to right, #3a7bd5, #3a6073);">
      <div class="d-flex justify-content-between align-items-center">
        <div>
          <div class="fs-1 fw-bold">${Math.round(temp)}°C</div>
          <div class="text-capitalize">${description}</div>
        </div>
        <img src="https://openweathermap.org/img/wn/${icon}@2x.png" class="weather-icon" />
      </div>
      <div class="row text-center mt-4">
        ${makeWeatherStat("fa-tint", "Humidity", `${humidity}%`, "#51C4D3")}
        ${makeWeatherStat("fa-tachometer-alt", "Pressure", `${pressure} hPa`, "#3E8EDE")}
        ${makeWeatherStat("fa-thermometer-quarter", "Dew Point", `${dewPoint}°C`, "#9BCF53")}
        ${makeWeatherStat("fa-wind", "Wind", `${wind} km/h`, "#6C63FF")}
        ${makeWeatherStat("fa-eye", "Visibility", `${visibility} km`, "#FFA500")}
        ${makeWeatherStat("fa-cloud-showers-heavy", "Rain", `${precipitation} mm`, "#00ADB5")}
      </div>
    </div>`;
}

function makeWeatherStat(icon, label, value, bg) {
  return `
    <div class="col-6 col-md-4 mb-3">
      <div class="rounded p-3 shadow text-white" style="background:${bg}">
        <div><i class="fa ${icon} fa-lg mb-1"></i></div>
        <div class="fw-bold">${label}</div>
        <div>${value}</div>
      </div>
    </div>`;
}

function openCurrencyModal() {
  const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById("currencyModal"));
  document.getElementById("amountInput").value = "";
  document.getElementById("convertedAmount").innerText = "";
  document.getElementById("convertDirection").value = "usdToLocal";
  
  if (globalCurrencyCode && globalExchangeRate) {
    document.getElementById("converterInfo").innerText = 
      `1 USD = ${globalExchangeRate.toFixed(2)} ${globalCurrencyCode}`;
  } else {
    document.getElementById("converterInfo").innerText = 
      "Currency conversion rate not available";
  }
  
  modal.show();
}

function convertCurrency() {
  const amount = parseFloat(document.getElementById("amountInput").value);
  const direction = document.getElementById("convertDirection").value;

  if (!amount || isNaN(amount)) {
    document.getElementById("convertedAmount").innerText = "Please enter a valid amount";
    return;
  }

  if (!globalExchangeRate || !globalCurrencyCode) {
    document.getElementById("convertedAmount").innerText = "Currency conversion rate not available";
    return;
  }

  const result = direction === "usdToLocal" ? 
    amount * globalExchangeRate : 
    amount / globalExchangeRate;

  const output = direction === "usdToLocal" ?
    `${amount} USD = ${result.toFixed(2)} ${globalCurrencyCode}` :
    `${amount} ${globalCurrencyCode} = ${result.toFixed(2)} USD`;

  document.getElementById("convertedAmount").innerText = output;
}
document.getElementById("currencyModal").addEventListener("hidden.bs.modal", () => {
  document.getElementById("amountInput").value = "";
  document.getElementById("convertedAmount").innerText = "";
  document.getElementById("convertDirection").value = "usdToLocal";
});
document.getElementById("infoModal").addEventListener("hidden.bs.modal", () => {
  document.getElementById("modalTitle").innerHTML = "";
  document.getElementById("modalBody").innerHTML = "";
});
document.addEventListener("DOMContentLoaded", initMap);