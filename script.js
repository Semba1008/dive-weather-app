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

  const WEATHER_INFO = {
    0: ["☀️", "快晴"], 1: ["🌤️", "晴れ"], 2: ["⛅", "薄曇り"], 3: ["☁️", "曇り"],
    45: ["🌫️", "霧"], 48: ["🌫️", "霧氷"],
    51: ["🌦️", "小雨"], 53: ["🌦️", "霧雨"], 55: ["🌧️", "強い霧雨"],
    56: ["🌧️", "着氷性霧雨"], 57: ["🌧️", "着氷性霧雨"],
    61: ["🌧️", "小雨"], 63: ["🌧️", "雨"], 65: ["🌧️", "大雨"],
    66: ["🌧️", "着氷性の雨"], 67: ["🌧️", "着氷性の雨"],
    71: ["❄️", "小雪"], 73: ["❄️", "雪"], 75: ["❄️", "大雪"], 77: ["❄️", "霧雪"],
    80: ["🌦️", "にわか雨"], 81: ["🌧️", "にわか雨"], 82: ["🌧️", "激しいにわか雨"],
    85: ["🌨️", "にわか雪"], 86: ["🌨️", "激しいにわか雪"],
    95: ["⛈️", "雷雨"], 96: ["⛈️", "雷雨(雹)"], 99: ["⛈️", "雷雨(雹)"],
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
  const STATUS_ICON = { good: "✅", warning: "⚠️", critical: "⛔" };
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

  function badgeHTML(status, textMap) {
    if (!status) return "";
    return `<span class="tile-badge ${status}">${STATUS_ICON[status]} ${textMap[status]}</span>`;
  }

  function renderTiles(container, tiles) {
    container.innerHTML = tiles.map((t) => `
      <div class="tile">
        <div class="tile-label">${t.icon ? `<span>${t.icon}</span>` : ""}${t.label}</div>
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
      $("verdict-icon").textContent = STATUS_ICON[overall];
      $("verdict-place").textContent = `${place.name}${place.admin1 ? " / " + place.admin1 : ""}${place.country ? " / " + place.country : ""} — ${dateStr}`;
      $("verdict-label").textContent = STATUS_LABEL[overall];
      $("verdict-reason").textContent = reasons.length
        ? `注意点: ${reasons.join(" / ")}`
        : (statuses.length ? "風・波・降水いずれも良好な見込みです。" : "この地点では海洋データ（波浪）が取得できませんでした。");

      const tiles = [];
      if (temp) {
        tiles.push({ icon: "🌡️", label: "気温 (6-18時)", value: `${fmt(temp.min, 0)}〜${fmt(temp.max, 0)}℃` });
      }
      if (wind) {
        tiles.push({
          icon: "💨",
          label: "風速 (6-18時)",
          value: `平均${fmt(wind.avg)} / 最大${fmt(wind.max)} m/s`,
          sub: gust ? `突風 最大${fmt(gust.max)} m/s` : null,
          badge: badgeHTML(windStatus, { good: "良好", warning: "やや強め", critical: "危険" }),
        });
      }
      if (wave) {
        tiles.push({
          icon: "🌊",
          label: "波高 (6-18時)",
          value: `平均${fmt(wave.avg)} / 最大${fmt(wave.max)} m`,
          badge: badgeHTML(waveStatus, { good: "穏やか", warning: "やや高い", critical: "高波注意" }),
        });
      } else {
        tiles.push({ icon: "🌊", label: "波高", value: "データなし", sub: "内陸・湖沼の可能性があります" });
      }
      if (swell) {
        tiles.push({ icon: "〰️", label: "うねり", value: `平均${fmt(swell.avg)} m` });
      }
      if (waterTemp) {
        tiles.push({ icon: "🌡️", label: "水温 (海面水温)", value: `約${fmt(waterTemp.avg, 1)}℃` });
      }
      if (precip) {
        tiles.push({
          icon: "☔",
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

      // hourly table (every 2h, 6-18)
      const rows = [];
      for (let h = 6; h <= 18; h += 2) {
        const i = times.findIndex((t) => t === `${dateStr}T${String(h).padStart(2, "0")}:00`);
        if (i === -1) continue;
        const code = forecast.hourly.weathercode[i];
        const info = WEATHER_INFO[code] || ["", "?"];
        const w = forecast.hourly.windspeed_10m[i];
        const t = forecast.hourly.temperature_2m[i];
        const p = forecast.hourly.precipitation_probability[i];
        let waveVal = "-";
        if (marine && marineTimes) {
          const mi = marineTimes.findIndex((t2) => t2 === `${dateStr}T${String(h).padStart(2, "0")}:00`);
          if (mi !== -1) waveVal = fmt(marine.hourly.wave_height[mi]) + "m";
        }
        const wStatus = classify(w, THRESH.wind);
        const pStatus = classify(p, THRESH.precip);
        rows.push(`
          <tr>
            <td>${h}:00</td>
            <td>${info[0]} ${info[1]}</td>
            <td>${fmt(t, 0)}℃</td>
            <td class="${wStatus === "critical" ? "flag-critical" : wStatus === "warning" ? "flag-warning" : ""}">${fmt(w)}m/s</td>
            <td>${waveVal}</td>
            <td class="${pStatus === "critical" ? "flag-critical" : pStatus === "warning" ? "flag-warning" : ""}">${Math.round(p)}%</td>
          </tr>
        `);
      }
      $("hourly-body").innerHTML = rows.join("");

      setStatus(null);
      resultEl.hidden = false;
    } catch (e) {
      console.error(e);
      setStatus("天気データの取得に失敗しました。しばらくしてから再度お試しください。", true);
    }
  }

  function renderCandidates(results) {
    candidatesEl.innerHTML = `<div class="status-area">複数の候補が見つかりました。地点を選択してください:</div>` +
      results.map((r, i) => `
        <button type="button" class="candidate-btn" data-idx="${i}">
          ${r.name}<span class="cand-sub">${[r.admin1, r.country].filter(Boolean).join(" / ")} (緯度${r.latitude.toFixed(2)}, 経度${r.longitude.toFixed(2)})</span>
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
