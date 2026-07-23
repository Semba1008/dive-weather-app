(() => {
  const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";
  const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
  const MARINE_URL = "https://marine-api.open-meteo.com/v1/marine";
  const FORECAST_DAYS = 8;

  const THRESH = {
    wind: { good: 5, warn: 8 },       // m/s
    wave: { good: 0.5, warn: 1.2 },   // m
    precip: { good: 30, warn: 60 },   // %
  };
  const THUNDER_CODES = new Set([95, 96, 99]);

  const CLOUD_SHAPE = `<circle cx="9" cy="12.8" r="3.2"/><circle cx="13.2" cy="10.5" r="4"/><circle cx="16.4" cy="13" r="2.6"/><rect x="6" y="13" width="12.6" height="4.5" rx="2.25"/>`;

  const ICONS = {
    sun: `<circle cx="12" cy="12" r="4.3"/><rect x="11.25" y="1" width="1.5" height="3.3" rx="0.75"/><rect x="11.25" y="19.7" width="1.5" height="3.3" rx="0.75"/><rect x="1" y="11.25" width="3.3" height="1.5" rx="0.75"/><rect x="19.7" y="11.25" width="3.3" height="1.5" rx="0.75"/><rect x="11.25" y="1" width="1.5" height="3.3" rx="0.75" transform="rotate(45 12 12)"/><rect x="11.25" y="1" width="1.5" height="3.3" rx="0.75" transform="rotate(135 12 12)"/><rect x="11.25" y="1" width="1.5" height="3.3" rx="0.75" transform="rotate(225 12 12)"/><rect x="11.25" y="1" width="1.5" height="3.3" rx="0.75" transform="rotate(315 12 12)"/>`,
    cloud: CLOUD_SHAPE,
    cloudSun: `<circle cx="7.3" cy="6.8" r="2.6"/><rect x="6.55" y="1" width="1.5" height="2.6" rx="0.75" transform="rotate(0 7.3 6.8)"/>${CLOUD_SHAPE}`,
    fog: `<rect x="3" y="6" width="18" height="2" rx="1"/><rect x="6" y="10.3" width="15" height="2" rx="1"/><rect x="3" y="14.6" width="18" height="2" rx="1"/><rect x="7" y="18.9" width="12" height="2" rx="1"/>`,
    cloudRain: `${CLOUD_SHAPE}<rect x="8.35" y="18" width="1.3" height="3.6" rx="0.65" transform="rotate(15 9 19.8)"/><rect x="12.35" y="18" width="1.3" height="3.6" rx="0.65" transform="rotate(15 13 19.8)"/><rect x="15.85" y="17.6" width="1.3" height="3.6" rx="0.65" transform="rotate(15 16.5 19.4)"/>`,
    cloudSnow: `${CLOUD_SHAPE}<circle cx="9" cy="19.3" r="1.1"/><circle cx="13" cy="19.8" r="1.1"/><circle cx="16.6" cy="19.1" r="1.1"/>`,
    cloudLightning: `${CLOUD_SHAPE}<polygon points="13.2,17 9.6,21.6 12.1,21.6 10.9,24 15.1,19.4 12.4,19.4"/>`,
    thermometer: `<rect x="10" y="2.5" width="4" height="13.5" rx="2"/><circle cx="12" cy="18.5" r="4"/>`,
    droplet: `<path d="M12 2.5c3.6 4.4 6.2 7.9 6.2 10.9a6.2 6.2 0 1 1-12.4 0c0-3 2.6-6.5 6.2-10.9z"/>`,
    wind: `<path d="M3 8h11a2.4 2.4 0 1 0-2.3-3.1"/><path d="M3 12.2h15.2a2.4 2.4 0 1 1-2.3 3.1"/><path d="M3 16.4h9"/>`,
    waves: `<path d="M2 9.3c1.5-2 3.5-2 5 0s3.5 2 5 0 3.5-2 5 0 3.5 2 5 0"/><path d="M2 15.3c1.5-2 3.5-2 5 0s3.5 2 5 0 3.5-2 5 0 3.5 2 5 0"/>`,
    checkCircle: `<circle cx="12" cy="12" r="9"/><path d="M8 12.3l2.6 2.6 5-5.6"/>`,
    alertTriangle: `<path d="M12 3.3l9.3 16.4h-18.6z" stroke-linejoin="round"/><line x1="12" y1="9.7" x2="12" y2="14.3"/><circle cx="12" cy="17.2" r="0.9" fill="currentColor" stroke="none"/>`,
    alertCircle: `<circle cx="12" cy="12" r="9"/><line x1="12" y1="7.3" x2="12" y2="13"/><circle cx="12" cy="16.2" r="0.9" fill="currentColor" stroke="none"/>`,
  };
  const FILLED_ICONS = new Set(["sun", "cloud", "cloudSun", "fog", "cloudRain", "cloudSnow", "cloudLightning", "thermometer", "droplet"]);

  function svgIcon(name, extraClass = "") {
    const cls = `icon ${FILLED_ICONS.has(name) ? "icon-filled" : ""} ${extraClass}`.trim();
    return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ""}</svg>`;
  }

  const WEATHER_INFO = {
    0: ["sun", "快晴"], 1: ["sun", "晴れ"], 2: ["cloudSun", "薄曇り"], 3: ["cloud", "曇り"],
    45: ["fog", "霧"], 48: ["fog", "霧氷"],
    51: ["cloudRain", "小雨"], 53: ["cloudRain", "霧雨"], 55: ["cloudRain", "強い霧雨"],
    56: ["cloudRain", "着氷性霧雨"], 57: ["cloudRain", "着氷性霧雨"],
    61: ["cloudRain", "小雨"], 63: ["cloudRain", "雨"], 65: ["cloudRain", "大雨"],
    66: ["cloudRain", "着氷性の雨"], 67: ["cloudRain", "着氷性の雨"],
    71: ["cloudSnow", "小雪"], 73: ["cloudSnow", "雪"], 75: ["cloudSnow", "大雪"], 77: ["cloudSnow", "霧雪"],
    80: ["cloudRain", "にわか雨"], 81: ["cloudRain", "にわか雨"], 82: ["cloudRain", "激しいにわか雨"],
    85: ["cloudSnow", "にわか雪"], 86: ["cloudSnow", "激しいにわか雪"],
    95: ["cloudLightning", "雷雨"], 96: ["cloudLightning", "雷雨(雹)"], 99: ["cloudLightning", "雷雨(雹)"],
  };

  const $ = (id) => document.getElementById(id);
  const form = $("search-form");
  const placeInput = $("place-input");
  const dateInput = $("date-input");
  const searchBtn = $("search-btn");
  const statusArea = $("status-area");
  const candidatesEl = $("candidates");
  const resultEl = $("result");

  function todayLocalISO(offsetDays = 0) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  dateInput.min = todayLocalISO(0);
  dateInput.max = todayLocalISO(FORECAST_DAYS - 1);
  dateInput.value = todayLocalISO(0);

  function setStatus(msg, isError = false) {
    if (!msg) {
      statusArea.hidden = true;
      statusArea.textContent = "";
      return;
    }
    statusArea.hidden = false;
    statusArea.textContent = msg;
    statusArea.classList.toggle("error", isError);
  }

  function clearCandidates() {
    candidatesEl.hidden = true;
    candidatesEl.innerHTML = "";
  }

  function classify(value, thresh, higherIsWorse = true) {
    if (value == null || Number.isNaN(value)) return null;
    if (higherIsWorse) {
      if (value <= thresh.good) return "good";
      if (value <= thresh.warn) return "warning";
      return "critical";
    }
    return "good";
  }

  const STATUS_RANK = { good: 0, warning: 1, critical: 2 };
  const STATUS_ICON = { good: "checkCircle", warning: "alertTriangle", critical: "alertCircle" };
  const STATUS_LABEL = { good: "ダイビング日和", warning: "コンディション注意", critical: "ダイビング非推奨" };

  async function fetchJSON(url) {
    const res = await fetch(url);
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return res.json();
  }

  async function geocode(name) {
    const url = `${GEOCODE_URL}?name=${encodeURIComponent(name)}&count=8&language=ja&format=json`;
    const data = await fetchJSON(url);
    return data.results || [];
  }

  async function fetchForecast(lat, lon) {
    const params = new URLSearchParams({
      latitude: lat,
      longitude: lon,
      hourly: "temperature_2m,precipitation_probability,weathercode,windspeed_10m,windgusts_10m",
      wind_speed_unit: "ms",
      timezone: "auto",
      forecast_days: String(FORECAST_DAYS),
    });
    return fetchJSON(`${FORECAST_URL}?${params.toString()}`);
  }

  async function fetchMarine(lat, lon) {
    const params = new URLSearchParams({
      latitude: lat,
      longitude: lon,
      hourly: "wave_height,wave_period,wind_wave_height,swell_wave_height,sea_surface_temperature",
      timezone: "auto",
      forecast_days: String(FORECAST_DAYS),
    });
    try {
      return await fetchJSON(`${MARINE_URL}?${params.toString()}`);
    } catch (e) {
      return null;
    }
  }

  function dayIndices(times, dateStr) {
    const idx = [];
    times.forEach((t, i) => { if (t.startsWith(dateStr)) idx.push(i); });
    return idx;
  }

  function daytimeIndices(times, dateStr, fromHour = 6, toHour = 18) {
    return dayIndices(times, dateStr).filter((i) => {
      const hour = parseInt(times[i].slice(11, 13), 10);
      return hour >= fromHour && hour <= toHour;
    });
  }

  function stats(arr) {
    const vals = arr.filter((v) => v != null && !Number.isNaN(v));
    if (!vals.length) return null;
    return {
      min: Math.min(...vals),
      max: Math.max(...vals),
      avg: vals.reduce((a, b) => a + b, 0) / vals.length,
    };
  }

  function fmt(n, digits = 1) {
    return n == null || Number.isNaN(n) ? "-" : n.toFixed(digits);
  }

  function badgeText(status, textMap) {
    return status ? textMap[status] : "";
  }

  function badgeHTML(status, textMap) {
    if (!status) return "";
    return `<span class="tile-badge ${status}">${svgIcon(STATUS_ICON[status])} ${textMap[status]}</span>`;
  }

  function renderTiles(container, tiles) {
    container.innerHTML = tiles.map((t) => `
      <div class="tile${t.status ? ` status-${t.status}` : ""}">
        ${t.icon ? `<div class="tile-icon-chip">${svgIcon(t.icon)}</div>` : ""}
        <div class="tile-label">${t.label}</div>
        <div class="tile-value">${t.value}</div>
        ${t.sub ? `<div class="tile-sub">${t.sub}</div>` : ""}
        ${t.badge || ""}
      </div>
    `).join("");
  }

  function buildChart(svgEl, points, color, thresholds, unit) {
    svgEl.innerHTML = "";
    const W = 720, H = 160, padTop = 14, padBottom = 24, padX = 6;
    const plotH = H - padTop - padBottom;
    const values = points.map((p) => p.value).filter((v) => v != null);
    if (!values.length) return;
    const maxVal = Math.max(...values, thresholds.warn * 1.15);
    const minVal = Math.min(0, ...values);
    const xFor = (i) => padX + (i / (points.length - 1)) * (W - padX * 2);
    const yFor = (v) => padTop + plotH - ((v - minVal) / (maxVal - minVal || 1)) * plotH;

    const ns = "http://www.w3.org/2000/svg";
    const makeEl = (tag, attrs) => {
      const el = document.createElementNS(ns, tag);
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
      return el;
    };

    // daytime band (6-18)
    const dayStartIdx = points.findIndex((p) => p.hour === 6);
    const dayEndIdx = points.findIndex((p) => p.hour === 18);
    if (dayStartIdx >= 0 && dayEndIdx >= 0) {
      svgEl.appendChild(makeEl("rect", {
        x: xFor(dayStartIdx), y: padTop, width: xFor(dayEndIdx) - xFor(dayStartIdx), height: plotH,
        fill: "var(--gridline)", opacity: "0.35",
      }));
    }

    // gridlines (good / warn thresholds)
    [thresholds.good, thresholds.warn].forEach((th) => {
      if (th > maxVal) return;
      const y = yFor(th);
      svgEl.appendChild(makeEl("line", {
        x1: padX, x2: W - padX, y1: y, y2: y, stroke: "var(--baseline)", "stroke-width": 1,
        "stroke-dasharray": "4 4", opacity: "0.7",
      }));
    });

    // baseline
    svgEl.appendChild(makeEl("line", {
      x1: padX, x2: W - padX, y1: H - padBottom, y2: H - padBottom, stroke: "var(--baseline)", "stroke-width": 1,
    }));

    // line path
    let d = "";
    points.forEach((p, i) => {
      if (p.value == null) return;
      const cmd = d === "" ? "M" : "L";
      d += `${cmd}${xFor(i).toFixed(1)},${yFor(p.value).toFixed(1)} `;
    });
    svgEl.appendChild(makeEl("path", {
      d, fill: "none", stroke: color, "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round",
    }));

    // hour labels (every 4h)
    points.forEach((p, i) => {
      if (p.hour % 6 !== 0) return;
      svgEl.appendChild(makeEl("text", {
        x: xFor(i), y: H - 6, "text-anchor": "middle", "font-size": "10", fill: "var(--text-muted)",
      })).textContent = `${p.hour}時`;
    });

    // hover targets
    const tooltip = $("chart-tooltip");
    const wrap = svgEl.closest(".chart-wrap");
    points.forEach((p, i) => {
      if (p.value == null) return;
      const cx = xFor(i), cy = yFor(p.value);
      const dot = makeEl("circle", { cx, cy, r: 8, fill: "transparent" });
      dot.addEventListener("mouseenter", () => {
        const visDot = makeEl("circle", { cx, cy, r: 3.5, fill: color, class: "hover-dot" });
        svgEl.appendChild(visDot);
        dot._visDot = visDot;
        const rect = svgEl.getBoundingClientRect();
        const wrapRect = wrap.getBoundingClientRect();
        const px = rect.left - wrapRect.left + (cx / W) * rect.width;
        const py = rect.top - wrapRect.top + (cy / H) * rect.height;
        tooltip.style.left = `${px}px`;
        tooltip.style.top = `${py}px`;
        tooltip.textContent = `${p.hour}時: ${fmt(p.value)}${unit}`;
        tooltip.hidden = false;
      });
      dot.addEventListener("mouseleave", () => {
        if (dot._visDot) { dot._visDot.remove(); dot._visDot = null; }
        tooltip.hidden = true;
      });
      svgEl.appendChild(dot);
    });
  }

  async function loadWeather(place) {
    setStatus("天気データを取得中...");
    resultEl.hidden = true;
    try {
      const [forecast, marine] = await Promise.all([
        fetchForecast(place.latitude, place.longitude),
        fetchMarine(place.latitude, place.longitude),
      ]);

      const dateStr = dateInput.value;
      const times = forecast.hourly.time;
      const dIdx = daytimeIndices(times, dateStr);
      if (!dIdx.length) {
        setStatus("この日付の予報データが取得できませんでした（最大7日先まで対応しています）。", true);
        return;
      }
      const allDayIdx = dayIndices(times, dateStr);

      const temp = stats(dIdx.map((i) => forecast.hourly.temperature_2m[i]));
      const wind = stats(dIdx.map((i) => forecast.hourly.windspeed_10m[i]));
      const gust = stats(dIdx.map((i) => forecast.hourly.windgusts_10m[i]));
      const precip = stats(dIdx.map((i) => forecast.hourly.precipitation_probability[i]));
      const codesInDay = dIdx.map((i) => forecast.hourly.weathercode[i]);
      const hasThunder = codesInDay.some((c) => THUNDER_CODES.has(c));

      let marineTimes = null, mIdx = [], wave = null, swell = null, waterTemp = null;
      if (marine && marine.hourly) {
        marineTimes = marine.hourly.time;
        mIdx = daytimeIndices(marineTimes, dateStr);
        if (mIdx.length) {
          wave = stats(mIdx.map((i) => marine.hourly.wave_height[i]));
          swell = stats(mIdx.map((i) => marine.hourly.swell_wave_height[i]));
          waterTemp = stats(mIdx.map((i) => marine.hourly.sea_surface_temperature[i]));
        }
      }

      const windStatus = classify(wind ? wind.max : null, THRESH.wind);
      const waveStatus = wave ? classify(wave.max, THRESH.wave) : null;
      const precipStatus = classify(precip ? precip.max : null, THRESH.precip);

      const statuses = [windStatus, waveStatus, precipStatus].filter(Boolean);
      let overall = statuses.reduce((worst, s) => STATUS_RANK[s] > STATUS_RANK[worst] ? s : worst, "good");
      const reasons = [];
      if (windStatus && windStatus !== "good") reasons.push(`風速 最大${fmt(wind.max)}m/s`);
      if (waveStatus && waveStatus !== "good") reasons.push(`波高 最大${fmt(wave.max)}m`);
      if (precipStatus && precipStatus !== "good") reasons.push(`降水確率 最大${Math.round(precip.max)}%`);
      if (hasThunder) {
        overall = "critical";
        reasons.unshift("雷を伴う天気の可能性");
      }

      $("verdict").className = `verdict ${overall}`;
      $("verdict-icon").innerHTML = svgIcon(STATUS_ICON[overall]);
      $("verdict-place").textContent = `${place.name}${place.admin1 ? " / " + place.admin1 : ""}${place.country ? " / " + place.country : ""} — ${dateStr}`;
      $("verdict-label").textContent = STATUS_LABEL[overall];

      const chipDefs = [
        windStatus && { status: windStatus, icon: "wind", text: `風速 ${badgeText(windStatus, { good: "良好", warning: "やや強め", critical: "危険" })}` },
        waveStatus && { status: waveStatus, icon: "waves", text: `波高 ${badgeText(waveStatus, { good: "穏やか", warning: "やや高い", critical: "高波注意" })}` },
        precipStatus && { status: precipStatus, icon: "droplet", text: `降水 ${badgeText(precipStatus, { good: "低い", warning: "やや高い", critical: "高い" })}` },
      ].filter(Boolean);
      $("verdict-chips").innerHTML = chipDefs.map((c) => `
        <span class="verdict-chip status-${c.status}">${svgIcon(c.icon)}${c.text}</span>
      `).join("") || `<span class="verdict-chip">この地点では海洋データ（波浪）が取得できませんでした</span>`;

      const tiles = [];
      if (temp) {
        tiles.push({ icon: "thermometer", label: "気温 (6-18時)", value: `${fmt(temp.min, 0)}〜${fmt(temp.max, 0)}℃` });
      }
      if (wind) {
        tiles.push({
          icon: "wind",
          status: windStatus,
          label: "風速 (6-18時)",
          value: `平均${fmt(wind.avg)} / 最大${fmt(wind.max)} m/s`,
          sub: gust ? `突風 最大${fmt(gust.max)} m/s` : null,
          badge: badgeHTML(windStatus, { good: "良好", warning: "やや強め", critical: "危険" }),
        });
      }
      if (wave) {
        tiles.push({
          icon: "waves",
          status: waveStatus,
          label: "波高 (6-18時)",
          value: `平均${fmt(wave.avg)} / 最大${fmt(wave.max)} m`,
          badge: badgeHTML(waveStatus, { good: "穏やか", warning: "やや高い", critical: "高波注意" }),
        });
      } else {
        tiles.push({ icon: "waves", label: "波高", value: "データなし", sub: "内陸・湖沼の可能性があります" });
      }
      if (swell) {
        tiles.push({ icon: "waves", label: "うねり", value: `平均${fmt(swell.avg)} m` });
      }
      if (waterTemp) {
        tiles.push({ icon: "thermometer", label: "水温 (海面水温)", value: `約${fmt(waterTemp.avg, 1)}℃` });
      }
      if (precip) {
        tiles.push({
          icon: "droplet",
          status: precipStatus,
          label: "降水確率 (6-18時)",
          value: `最大${Math.round(precip.max)}%`,
          badge: badgeHTML(precipStatus, { good: "低い", warning: "やや高い", critical: "高い" }),
        });
      }
      renderTiles($("tiles"), tiles);

      // charts across full day (0-23) using allDayIdx (fallback to dIdx if not full)
      const hourPoints = (arr, srcTimes, srcIdx) => {
        const byHour = new Map();
        srcIdx.forEach((i) => {
          const h = parseInt(srcTimes[i].slice(11, 13), 10);
          byHour.set(h, arr[i]);
        });
        const pts = [];
        for (let h = 0; h <= 23; h++) pts.push({ hour: h, value: byHour.has(h) ? byHour.get(h) : null });
        return pts;
      };

      const windPoints = hourPoints(forecast.hourly.windspeed_10m, times, allDayIdx);
      buildChart($("wind-chart"), windPoints, "var(--series-blue)", THRESH.wind, "m/s");

      const waveWrap = $("wave-chart-wrap");
      if (marine && marineTimes && wave) {
        const allMarineDayIdx = dayIndices(marineTimes, dateStr);
        const wavePoints = hourPoints(marine.hourly.wave_height, marineTimes, allMarineDayIdx);
        buildChart($("wave-chart"), wavePoints, "var(--series-aqua)", THRESH.wave, "m");
        waveWrap.hidden = false;
      } else {
        waveWrap.hidden = true;
      }

      $("chart-legend").innerHTML = `
        <span><span class="dot" style="background:var(--baseline)"></span>点線 = 目安ライン(良好/注意)</span>
        <span><span class="dot" style="background:var(--gridline)"></span>網掛け = 日中 (6-18時)</span>
      `;

      // hourly cards (every 2h, 6-18)
      const cards = [];
      for (let h = 6; h <= 18; h += 2) {
        const i = times.findIndex((t) => t === `${dateStr}T${String(h).padStart(2, "0")}:00`);
        if (i === -1) continue;
        const code = forecast.hourly.weathercode[i];
        const info = WEATHER_INFO[code] || ["cloud", "?"];
        const w = forecast.hourly.windspeed_10m[i];
        const t = forecast.hourly.temperature_2m[i];
        const p = forecast.hourly.precipitation_probability[i];
        let waveVal = null;
        if (marine && marineTimes) {
          const mi = marineTimes.findIndex((t2) => t2 === `${dateStr}T${String(h).padStart(2, "0")}:00`);
          if (mi !== -1) waveVal = marine.hourly.wave_height[mi];
        }
        const wStatus = classify(w, THRESH.wind);
        const pStatus = classify(p, THRESH.precip);
        const cardStatus = STATUS_RANK[wStatus] > STATUS_RANK[pStatus] ? wStatus : pStatus;
        cards.push(`
          <div class="hour-card status-${cardStatus}">
            <div class="hour-time">${h}:00</div>
            ${svgIcon(info[0])}
            <div class="hour-weather-label">${info[1]}</div>
            <div class="hour-temp">${fmt(t, 0)}℃</div>
            <div class="hour-metric status-${wStatus}">${svgIcon("wind")}${fmt(w)}m/s</div>
            <div class="hour-metric">${svgIcon("waves")}${waveVal != null ? fmt(waveVal) + "m" : "-"}</div>
            <div class="hour-metric status-${pStatus}">${svgIcon("droplet")}${Math.round(p)}%</div>
          </div>
        `);
      }
      $("hour-strip").innerHTML = cards.join("");

      setStatus(null);
      resultEl.hidden = false;
    } catch (e) {
      console.error(e);
      setStatus("天気データの取得に失敗しました。しばらくしてから再度お試しください。", true);
    }
  }

  const PIN_ICON = `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-7.5 7-12A7 7 0 0 0 5 9c0 4.5 7 12 7 12z"/><circle cx="12" cy="9" r="2.3"/></svg>`;

  function renderCandidates(results) {
    candidatesEl.innerHTML = `<div class="status-area">複数の候補が見つかりました。地点を選択してください:</div>` +
      results.map((r, i) => `
        <button type="button" class="candidate-btn" data-idx="${i}">
          ${PIN_ICON}<span>${r.name}<span class="cand-sub">${[r.admin1, r.country].filter(Boolean).join(" / ")} (緯度${r.latitude.toFixed(2)}, 経度${r.longitude.toFixed(2)})</span></span>
        </button>
      `).join("");
    candidatesEl.hidden = false;
    candidatesEl.querySelectorAll(".candidate-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        clearCandidates();
        loadWeather(results[Number(btn.dataset.idx)]);
      });
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = placeInput.value.trim();
    if (!name) return;
    clearCandidates();
    resultEl.hidden = true;
    searchBtn.disabled = true;
    searchBtn.classList.add("loading");
    setStatus("地点を検索中...");
    try {
      const results = await geocode(name);
      if (!results.length) {
        setStatus(`「${name}」に一致する地名が見つかりませんでした。別の表記でお試しください。`, true);
        return;
      }
      if (results.length === 1) {
        setStatus(null);
        await loadWeather(results[0]);
      } else {
        setStatus(null);
        renderCandidates(results);
      }
    } catch (err) {
      console.error(err);
      setStatus("地点検索に失敗しました。しばらくしてから再度お試しください。", true);
    } finally {
      searchBtn.disabled = false;
      searchBtn.classList.remove("loading");
    }
  });
})();
