/**
 * Jarvis Battery HUD — Custom Lovelace Card
 * ----------------------------------------
 * A HUD-style State of Charge gauge with a center ring + three corner stat tiles,
 * themed for the Jarvis Interface (cyan / Orbitron / Rajdhani / glassmorphic).
 *
 * Visual:
 *   - Center: multi-ring SVG arc showing SoC %, with tick marks + ornaments
 *   - Top corner:    PV In (W)
 *   - Left corner:   L1 Load (W)
 *   - Right corner:  Genset In (W)
 *
 * Color buckets (reactive on SoC):
 *   > 50%  → cyan   (#00D9FF, drop-shadow glow)
 *   20-50% → amber  (#FFB347)
 *   < 20%  → red    (#FF4D6D)
 *
 * Sizes: card_size: "small" | "medium" | "large" (default "medium")
 *   - small:  240×240, single ring, compact corners
 *   - medium: 320×320, three rings, full corner panels (default — matches mockup)
 *   - large:  400×400, three rings + extra tick density, larger text
 *
 * Required YAML:
 *   type: custom:jarvis-battery-hud
 *   entity_soc: sensor.gx_device_dc_battery_charge      # 0-100
 *   entity_pv_in: sensor.jarvis_total_pv_power          # W
 *   entity_load:  sensor.gx_device_consumption_power_l1 # W
 *   entity_genset: sensor.gx_device_genset_load_l1      # W (optional)
 *   charging_is_positive: false  # false = discharge is positive on your system
 */

const LIT_VERSION = "2.8.0";
const CARD_VERSION = "1.0.2";

// ---------------------------------------------------------------------------
// Lit core (loaded via dynamic import, matches HA frontend pattern)
// ---------------------------------------------------------------------------
const litPromise = import(
  `https://cdn.jsdelivr.net/npm/lit@${LIT_VERSION}/+esm`
);

const { LitElement, html, css, svg } = await litPromise;

// ---------------------------------------------------------------------------
// Card definition
// ---------------------------------------------------------------------------
class JarvisBatteryHud extends LitElement {
  static get properties() {
    return {
      hass: { state: true },
      _config: { state: true },
    };
  }

  constructor() {
    super();
    this._config = null;
  }

  static get styles() {
    return css`
      :host {
        --jarvis-cyan: #00D9FF;
        --jarvis-cyan-dim: rgba(0, 217, 255, 0.35);
        --jarvis-cyan-faint: rgba(0, 217, 255, 0.1);
        --jarvis-amber: #FFB347;
        --jarvis-amber-dim: rgba(255, 179, 71, 0.35);
        --jarvis-red: #FF4D6D;
        --jarvis-red-dim: rgba(255, 77, 109, 0.4);
        --jarvis-orange: #FF8C42;
        --jarvis-bg: rgba(8, 14, 22, 0.55);
        --jarvis-bg-solid: rgba(8, 14, 22, 0.85);
        --jarvis-stroke: rgba(0, 217, 255, 0.25);
        --jarvis-text: #E0F2FF;
        --jarvis-text-dim: rgba(224, 242, 255, 0.5);

        --ring-color: var(--jarvis-cyan);
        --ring-dim: var(--jarvis-cyan-dim);
        --ring-faint: var(--jarvis-cyan-faint);
        --glow: 0 0 12px var(--ring-color), 0 0 24px var(--ring-dim);
        --text-glow: 0 0 8px var(--ring-color);
      }

      :host([soc-low]) {
        --ring-color: var(--jarvis-red);
        --ring-dim: var(--jarvis-red-dim);
        --ring-faint: rgba(255, 77, 109, 0.1);
      }
      :host([soc-mid]) {
        --ring-color: var(--jarvis-amber);
        --ring-dim: var(--jarvis-amber-dim);
        --ring-faint: rgba(255, 179, 71, 0.1);
      }

      ha-card {
        background: var(--jarvis-bg);
        backdrop-filter: blur(6px);
        border: 1px solid var(--jarvis-stroke);
        border-radius: 14px;
        padding: 0;
        overflow: hidden;
        position: relative;
        box-shadow:
          0 0 24px rgba(0, 217, 255, 0.08) inset,
          0 4px 16px rgba(0, 0, 0, 0.4);
      }

      .frame {
        position: relative;
        width: 100%;
        aspect-ratio: 1 / 1;
        display: grid;
        place-items: center;
      }

      .corner {
        position: absolute;
        width: 24px;
        height: 24px;
        border-color: var(--ring-color);
        opacity: 0.7;
        transition: border-color 400ms ease;
        z-index: 3;
      }
      .corner.tl { top: 8px; left: 8px; border-top: 2px solid; border-left: 2px solid; }
      .corner.tr { top: 8px; right: 8px; border-top: 2px solid; border-right: 2px solid; }
      .corner.bl { bottom: 8px; left: 8px; border-bottom: 2px solid; border-left: 2px solid; }
      .corner.br { bottom: 8px; right: 8px; border-bottom: 2px solid; border-right: 2px solid; }

      .panel {
        position: absolute;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        font-family: "Rajdhani", "Helvetica Neue", sans-serif;
        color: var(--jarvis-text);
        min-width: 70px;
        z-index: 4;
        /* Solid backdrop so the SVG ring never bleeds through panel text */
        background: var(--jarvis-bg-solid);
        backdrop-filter: blur(4px);
        border-radius: 6px;
        padding: 4px 8px;
      }
      .panel .label {
        font-size: 0.7rem;
        font-weight: 500;
        letter-spacing: 0.18em;
        color: var(--jarvis-text-dim);
        text-transform: uppercase;
        margin-bottom: 4px;
      }
      .panel .value {
        font-family: "Orbitron", "Courier New", monospace;
        font-weight: 700;
        font-size: 1.4rem;
        line-height: 1;
        color: var(--ring-color);
        text-shadow: var(--text-glow);
        transition: color 400ms ease, text-shadow 400ms ease;
      }
      .panel .sub {
        font-size: 0.65rem;
        letter-spacing: 0.12em;
        color: var(--jarvis-text-dim);
        margin-top: 3px;
        text-transform: uppercase;
      }
      .panel.unavailable .value {
        color: var(--jarvis-text-dim);
        text-shadow: none;
      }

      /* Panels sit OUTSIDE the ring's visual edge.
         Ring outer radius is ~75% of frame, so panels must be near the edges. */
      .panel.top    { top: 28px;    left: 50%; transform: translateX(-50%); }
      .panel.left   { top: 50%;     left: 28px;  transform: translateY(-50%); }
      .panel.right  { top: 50%;     right: 28px; transform: translateY(-50%); }

      .ring-host {
        position: relative;
        width: 70%;
        aspect-ratio: 1 / 1;
        display: grid;
        place-items: center;
        z-index: 1;
      }
      .ring-host svg {
        width: 100%;
        height: 100%;
        transform: rotate(-90deg);
      }
      .ring-track {
        fill: none;
        stroke: var(--ring-faint);
        stroke-width: 2;
      }
      .ring-fill {
        fill: none;
        stroke: var(--ring-color);
        stroke-linecap: round;
        filter: drop-shadow(0 0 6px var(--ring-color));
        transition:
          stroke-dashoffset 800ms cubic-bezier(0.4, 0, 0.2, 1),
          stroke 400ms ease;
      }
      .ring-ticks {
        fill: none;
        stroke: var(--jarvis-stroke);
        stroke-width: 1.2;
      }
      .ring-ticks-major {
        stroke: var(--ring-dim);
      }
      .ring-arc-deco {
        fill: none;
        stroke: var(--ring-dim);
        stroke-width: 1;
        stroke-dasharray: 4 6;
        opacity: 0.7;
      }

      .dot {
        fill: var(--jarvis-orange);
        filter: drop-shadow(0 0 3px var(--jarvis-orange));
        animation: pulse 2.4s ease-in-out infinite;
      }
      .dot.d2 { animation-delay: 0.3s; }
      .dot.d3 { animation-delay: 0.6s; }
      .dot.d4 { animation-delay: 0.9s; }
      @keyframes pulse {
        0%, 100% { opacity: 0.5; transform: scale(0.9); }
        50%      { opacity: 1;   transform: scale(1.15); }
      }

      .center {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        pointer-events: none;
        z-index: 2;
      }
      .soc-pct {
        font-family: "Orbitron", "Courier New", monospace;
        font-weight: 800;
        font-size: clamp(2rem, 9cqi, 4.5rem);
        line-height: 1;
        color: var(--ring-color);
        text-shadow: var(--text-glow);
        transition: color 400ms ease, text-shadow 400ms ease;
      }
      .soc-pct .unit {
        font-size: 0.45em;
        font-weight: 500;
        margin-left: 0.15em;
        color: var(--jarvis-text-dim);
        text-shadow: none;
      }
      .soc-label {
        margin-top: 6px;
        font-family: "Rajdhani", sans-serif;
        font-weight: 500;
        font-size: 0.7rem;
        letter-spacing: 0.35em;
        color: var(--jarvis-text-dim);
        text-transform: uppercase;
      }
      .state-badge {
        margin-top: 10px;
        padding: 3px 12px;
        border: 1px solid currentColor;
        border-radius: 4px;
        font-family: "Rajdhani", sans-serif;
        font-weight: 600;
        font-size: 0.7rem;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        transition: color 400ms ease;
      }
      .state-badge.charging    { color: var(--jarvis-cyan); background: rgba(0, 217, 255, 0.08); }
      .state-badge.discharging { color: var(--jarvis-amber); background: rgba(255, 179, 71, 0.08); }
      .state-badge.idle        { color: var(--jarvis-text-dim); background: transparent; }

      .chevron {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        font-family: "Orbitron", monospace;
        color: var(--ring-dim);
        font-size: 1.1rem;
        letter-spacing: -2px;
        z-index: 1;
      }
      .chevron.l { left: 6px; }
      .chevron.r { right: 6px; }

      /* Size variants — :host([size]) is set from updated() */
      :host([size="small"]) .panel { min-width: 56px; padding: 3px 6px; }
      :host([size="small"]) .panel .value { font-size: 1rem; }
      :host([size="small"]) .panel .label { font-size: 0.6rem; }
      :host([size="small"]) .soc-pct { font-size: clamp(1.6rem, 7cqi, 2.4rem); }
      :host([size="small"]) .soc-label { font-size: 0.55rem; letter-spacing: 0.25em; }
      :host([size="small"]) .state-badge { font-size: 0.6rem; padding: 2px 8px; }

      :host([size="large"]) .panel { min-width: 92px; padding: 5px 10px; }
      :host([size="large"]) .panel .value { font-size: 1.9rem; }
      :host([size="large"]) .panel .label { font-size: 0.8rem; letter-spacing: 0.22em; }
      :host([size="large"]) .soc-pct { font-size: clamp(2.4rem, 10cqi, 5.5rem); }
      :host([size="large"]) .soc-label { font-size: 0.8rem; letter-spacing: 0.4em; }

      .footer {
        position: absolute;
        bottom: 6px;
        left: 0; right: 0;
        text-align: center;
        font-family: "Orbitron", monospace;
        font-size: 0.55rem;
        letter-spacing: 0.3em;
        color: var(--jarvis-text-dim);
        text-transform: uppercase;
        z-index: 1;
      }
    `;
  }

  setConfig(config) {
    if (!config.entity_soc) {
      throw new Error("Jarvis Battery HUD: entity_soc is required");
    }
    this._config = {
      card_size: config.card_size || "medium",
      entity_soc: config.entity_soc,
      entity_pv_in: config.entity_pv_in,
      entity_load: config.entity_load,
      entity_genset: config.entity_genset,
      entity_state: config.entity_state, // optional explicit state entity
      charging_is_positive:
        config.charging_is_positive !== undefined
          ? config.charging_is_positive
          : false, // your system: negative = charging
      title: config.title || "BATTERY",
      show_pv: config.show_pv !== false,
      show_load: config.show_load !== false,
      show_genset: config.show_genset !== false,
    };
    this.setAttribute("size", this._config.card_size);
  }

  updated(changed) {
    if (!this.hass || !this._config) return;
    const soc = this._readSoc();
    if (soc !== null) {
      if (soc < 20) this.setAttribute("soc-low", "");
      else this.removeAttribute("soc-low");
      if (soc >= 20 && soc <= 50) this.setAttribute("soc-mid", "");
      else this.removeAttribute("soc-mid");
    }
  }

  // ---------- data helpers ----------

  _state(entityId) {
    if (!entityId || !this.hass || !this.hass.states[entityId]) return null;
    return this.hass.states[entityId];
  }

  _readSoc() {
    const s = this._state(this._config.entity_soc);
    if (!s) return null;
    const v = parseFloat(s.state);
    return Number.isFinite(v) ? v : null;
  }

  _readPower(entityId) {
    const s = this._state(entityId);
    if (!s || s.state === "unavailable" || s.state === "unknown") return null;
    const v = parseFloat(s.state);
    return Number.isFinite(v) ? v : null;
  }

  _deriveState() {
    // Prefer explicit state entity if provided; else derive from power sign
    if (this._config.entity_state) {
      const s = this._state(this._config.entity_state);
      if (s) return s.state.toLowerCase();
    }
    const p = this._readPower("sensor.gx_device_dc_battery_power");
    if (p === null) return "idle";
    if (this._config.charging_is_positive) {
      return p > 5 ? "charging" : p < -5 ? "discharging" : "idle";
    } else {
      return p < -5 ? "charging" : p > 5 ? "discharging" : "idle";
    }
  }

  _formatPower(w) {
    if (w === null || w === undefined) return "—";
    const abs = Math.abs(w);
    if (abs >= 1000) return (w / 1000).toFixed(2) + " kW";
    return w.toFixed(0) + " W";
  }

  // ---------- SVG ring math ----------

  _arcPath(r, pct) {
    // returns "M x y A r r 0 large-arc sweep x y"
    const c = 2 * Math.PI * r;
    const dash = c * (pct / 100);
    const gap = c - dash;
    // we'll use stroke-dasharray on a circle, not a path — simpler.
    return { circumference: c, dash, gap };
  }

  _renderRings() {
    const size = this._config.card_size;
    const rOuter = 140;
    const rMid = 120;
    const rInner = 96;

    const soc = this._readSoc() || 0;
    const outer = this._arcPath(rOuter, Math.max(0, Math.min(100, soc)));

    // tick count: small=20, medium=40, large=60
    const tickCount = size === "large" ? 60 : size === "small" ? 20 : 40;
    const ticksMajor = size === "large" ? 12 : size === "small" ? 4 : 8;
    const ticks = [];
    for (let i = 0; i < tickCount; i++) {
      const angle = (i / tickCount) * Math.PI * 2 - Math.PI / 2;
      const isMajor = i % Math.max(1, Math.floor(tickCount / ticksMajor)) === 0;
      const r1 = rOuter + (isMajor ? 12 : 8);
      const r2 = rOuter + (isMajor ? 18 : 12);
      const x1 = 160 + Math.cos(angle) * r1;
      const y1 = 160 + Math.sin(angle) * r1;
      const x2 = 160 + Math.cos(angle) * r2;
      const y2 = 160 + Math.sin(angle) * r2;
      ticks.push(svg`
        <line class="ring-ticks ${isMajor ? "ring-ticks-major" : ""}"
              x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" />
      `);
    }

    // decorative dashed arc on mid ring — 90° sweep centered on top
    // (kept clear of all three corner panels)
    const arcR = rMid;
    const startAngle = -Math.PI * 0.75;  // -135° = upper-left
    const endAngle   = -Math.PI * 0.25;  //  -45° = upper-right
    const a1 = startAngle;
    const a2 = endAngle;
    const x1 = 160 + Math.cos(a1) * arcR;
    const y1 = 160 + Math.sin(a1) * arcR;
    const x2 = 160 + Math.cos(a2) * arcR;
    const y2 = 160 + Math.sin(a2) * arcR;
    const decoPath = `M ${x1} ${y1} A ${arcR} ${arcR} 0 1 1 ${x2} ${y2}`;

    // orange dots — 4 around inner ring at cardinal-ish positions
    const dotAngles = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
    const dots = dotAngles.map((a, i) => {
      const r = rInner - 6;
      const x = 160 + Math.cos(a) * r;
      const y = 160 + Math.sin(a) * r;
      return svg`<circle class="dot d${i + 1}" cx="${x}" cy="${y}" r="2.5" />`;
    });

    return svg`
      <svg viewBox="0 0 320 320">
        <!-- outer track -->
        <circle class="ring-track" cx="160" cy="160" r="${rOuter}" />
        <!-- outer fill -->
        <circle class="ring-fill"
                cx="160" cy="160" r="${rOuter}"
                stroke-dasharray="${outer.circumference}"
                stroke-dashoffset="${outer.gap}"
                stroke-width="6" />
        <!-- mid track -->
        <circle class="ring-track" cx="160" cy="160" r="${rMid}" />
        <!-- decorative dashed arc on mid -->
        <path class="ring-arc-deco" d="${decoPath}" />
        <!-- inner track -->
        <circle class="ring-track" cx="160" cy="160" r="${rInner}" stroke-width="1" />
        <!-- ticks -->
        ${ticks}
        <!-- pulse dots -->
        ${dots}
      </svg>
    `;
  }

  _renderPanel(pos, label, value, sub, cls) {
    const unavailable = value === "—" || value === null;
    return html`
      <div class="panel ${pos} ${cls || ""} ${unavailable ? "unavailable" : ""}">
        <div class="label">${label}</div>
        <div class="value">${value}</div>
        ${sub ? html`<div class="sub">${sub}</div>` : ""}
      </div>
    `;
  }

  render() {
    if (!this._config) return html``;
    if (!this.hass) return html`<ha-card><div class="frame">Loading…</div></ha-card>`;

    const soc = this._readSoc();
    const state = this._deriveState();

    const pv = this._readPower(this._config.entity_pv_in);
    const load = this._readPower(this._config.entity_load);
    const genset = this._readPower(this._config.entity_genset);

    return html`
      <ha-card>
        <div class="frame">
          <div class="corner tl"></div>
          <div class="corner tr"></div>
          <div class="corner bl"></div>
          <div class="corner br"></div>

          <div class="chevron l">&gt;&gt;</div>
          <div class="chevron r">&lt;&lt;</div>

          ${this._config.show_pv
            ? this._renderPanel("top", "PV In", this._formatPower(pv), "SOLAR")
            : ""}
          ${this._config.show_load
            ? this._renderPanel("left", "L1 Load", this._formatPower(load), "CONSUMPTION")
            : ""}
          ${this._config.show_genset
            ? this._renderPanel("right", "Genset In", this._formatPower(genset), "GENERATOR")
            : ""}

          <div class="ring-host">${this._renderRings()}</div>

          <div class="center">
            <div class="soc-pct">
              ${soc !== null ? soc.toFixed(1) : "—"}<span class="unit">%</span>
            </div>
            <div class="soc-label">${this._config.title}</div>
            <div class="state-badge ${state}">${state}</div>
          </div>

          <div class="footer">Jarvis Battery HUD v${CARD_VERSION}</div>
        </div>
      </ha-card>
    `;
  }

  getCardSize() {
    const size = this._config?.card_size || "medium";
    if (size === "small") return 3;
    if (size === "large") return 6;
    return 4;
  }

  static getConfigElement() {
    return document.createElement("jarvis-battery-hud-editor");
  }
}

// ---------------------------------------------------------------------------
// Minimal editor — fields only, no schema validation
// ---------------------------------------------------------------------------
class JarvisBatteryHudEditor extends LitElement {
  static get properties() {
    return { hass: {}, _config: { state: true } };
  }

  constructor() {
    super();
    this._config = {};
  }

  setConfig(config) {
    this._config = { ...config };
  }

  _valueChanged(ev) {
    const t = ev.target;
    const cfg = { ...this._config, [t.dataset.key]: t.value };
    this._config = cfg;
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: cfg },
        bubbles: true,
        composed: true,
      })
    );
  }

  static get styles() {
    return css`
      .row { display: grid; grid-template-columns: 1fr; gap: 8px; padding: 8px; }
      label { font-size: 0.8rem; color: var(--secondary-text-color); }
      input, select {
        width: 100%; padding: 6px; border-radius: 4px;
        border: 1px solid var(--divider-color);
        background: var(--card-background-color);
        color: var(--primary-text-color);
      }
    `;
  }

  render() {
    if (!this.hass) return html``;
    return html`
      <div class="row">
        <label>Card size
          <select data-key="card_size" .value=${this._config.card_size || "medium"} @change=${this._valueChanged}>
            <option value="small">Small (240×240)</option>
            <option value="medium">Medium (320×320)</option>
            <option value="large">Large (400×400)</option>
          </select>
        </label>
        <label>SoC entity
          <input data-key="entity_soc" .value=${this._config.entity_soc || ""} @input=${this._valueChanged} />
        </label>
        <label>PV In entity (W)
          <input data-key="entity_pv_in" .value=${this._config.entity_pv_in || ""} @input=${this._valueChanged} />
        </label>
        <label>L1 Load entity (W)
          <input data-key="entity_load" .value=${this._config.entity_load || ""} @input=${this._valueChanged} />
        </label>
        <label>Genset entity (W, optional)
          <input data-key="entity_genset" .value=${this._config.entity_genset || ""} @input=${this._valueChanged} />
        </label>
        <label>Charging is positive
          <select data-key="charging_is_positive" .value=${String(this._config.charging_is_positive ?? false)} @change=${(e) => { e.target.dataset.bool="1"; this._valueChanged({target:{...e.target, value: e.target.value === "true"}}); }}>
            <option value="false">No (negative = charging, Victron default)</option>
            <option value="true">Yes (positive = charging)</option>
          </select>
        </label>
      </div>
    `;
  }
}

customElements.define("jarvis-battery-hud", JarvisBatteryHud);
customElements.define("jarvis-battery-hud-editor", JarvisBatteryHudEditor);

// ---------------------------------------------------------------------------
// Lovelace card registration
// ---------------------------------------------------------------------------
window.customCards = window.customCards || [];
window.customCards.push({
  type: "jarvis-battery-hud",
  name: "Jarvis Battery HUD",
  description: "HUD-style battery SoC gauge with three corner stat tiles.",
  preview: true,
  documentationURL: "https://github.com/28labsnz/jarvis-battery-hud",
});

console.info(
  `%cJARVIS BATTERY HUD v${CARD_VERSION} loaded`,
  "color: #00D9FF; font-weight: bold;"
);