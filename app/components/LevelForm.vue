<template>
  <section class="card">
    <div class="card-head">
      <h2>Ton niveau</h2>
      <span v-if="flatPace10k" class="hint">≈ {{ formatPace(flatPace10k) }} /km sur 10 km plat</span>
    </div>

    <div class="tabs" role="tablist">
      <button v-for="m in modes" :key="m.id" type="button" role="tab" :class="{ active: settings.mode === m.id }" @click="settings.mode = m.id">
        {{ m.label }}
      </button>
    </div>

    <div v-if="settings.mode === 'allure'" class="row">
      <label class="field grow">
        <span>Allure que tu tiens sur 10 km (min:s /km)</span>
        <input v-model="settings.pace" type="text" inputmode="numeric" placeholder="5:30" :class="{ invalid: !parsePace(settings.pace) }">
      </label>
    </div>

    <div v-else-if="settings.mode === 'chrono'" class="row">
      <label class="field">
        <span>Distance (km)</span>
        <input v-model.number="settings.chronoKm" type="number" min="1" step="0.1">
      </label>
      <label class="field grow">
        <span>Chrono récent sur route (h:mm:ss)</span>
        <input v-model="settings.chronoTime" type="text" placeholder="0:55:00" :class="{ invalid: !parseTime(settings.chronoTime) }">
      </label>
    </div>

    <div v-else class="calib">
      <p class="hint">
        Le plus précis : donne le GPX d'une course que tu as faite et ton temps. Ravito en déduit ton niveau sur un terrain comparable.
      </p>
      <div class="row">
        <div class="field grow">
          <span>GPX de la course passée</span>
          <div class="file-row">
            <label class="btn ghost small">
              {{ calibName ? 'Changer' : 'Choisir un GPX' }}
              <input type="file" accept=".gpx" hidden @change="onCalib">
            </label>
            <span v-if="calibProfile" class="muted">
              {{ calibName }} · {{ formatKm(calibProfile.distance) }} km · {{ Math.round(calibProfile.gain) }} m D+
            </span>
            <button v-if="calibName" class="btn icon" type="button" title="Retirer" @click="clearCalibration">✕</button>
          </div>
          <span v-if="calibError" class="err">{{ calibError }}</span>
        </div>
        <label class="field">
          <span>Ton temps (h:mm:ss)</span>
          <input v-model="settings.calibTime" type="text" placeholder="2:45:00" :class="{ invalid: !!settings.calibTime && !parseTime(settings.calibTime) }">
        </label>
      </div>
    </div>

    <div class="row">
      <label class="field">
        <span>Heure de départ</span>
        <input v-model="settings.start" type="time">
      </label>
      <label class="field grow">
        <span>Terrain de la course</span>
        <select v-model.number="settings.technicite">
          <option :value="1">Route, chemins roulants</option>
          <option :value="1.08">Sentiers faciles</option>
          <option :value="1.18">Sentiers techniques (cailloux, racines)</option>
          <option :value="1.3">Très technique (pierriers, haute montagne)</option>
        </select>
      </label>
    </div>

    <details class="advanced">
      <summary>Réglages fins</summary>
      <label class="field">
        <span>En descente : {{ descenteLabel }}</span>
        <input v-model.number="settings.descente" type="range" min="0.2" max="0.9" step="0.05">
        <span class="scale"><span>Prudent</span><span>Engagé</span></span>
      </label>
      <label class="field">
        <span>Endurance sur la durée : {{ enduranceLabel }}</span>
        <input v-model.number="settings.endurance" type="range" min="1.03" max="1.15" step="0.01" class="reverse">
        <span class="scale"><span>Je tiens très bien</span><span>Je coince sur le long</span></span>
      </label>
      <p class="hint">
        Le temps tient compte de la pente mètre par mètre (coût énergétique de la course, Minetti 2002)
        et de la baisse d'allure sur la durée (loi de Riegel, exposant {{ settings.endurance.toFixed(2) }}).
      </p>
    </details>
  </section>
</template>

<script setup lang="ts">
const { settings, flatPace10k, calibName, calibProfile, loadCalibration, clearCalibration } = usePlan()

const modes = [
  { id: 'allure', label: 'Allure' },
  { id: 'chrono', label: 'Chrono récent' },
  { id: 'course', label: 'Course passée' },
] as const

const calibError = ref('')

async function onCalib(e: Event) {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  input.value = ''
  if (!f) return
  calibError.value = loadCalibration(await f.text(), f.name.replace(/\.gpx$/i, ''))
}

const descenteLabel = computed(() => {
  const v = settings.descente
  return v < 0.35 ? 'prudent' : v < 0.6 ? 'à l\'aise' : 'engagé'
})
const enduranceLabel = computed(() => {
  const v = settings.endurance
  return v <= 1.05 ? 'excellente' : v <= 1.08 ? 'bonne' : v <= 1.11 ? 'moyenne' : 'à travailler'
})
</script>

<style scoped>
.tabs { display: flex; gap: 4px; background: var(--panel-2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 3px; margin-bottom: 14px; }
.tabs button {
  flex: 1;
  font: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  border: none;
  background: transparent;
  color: var(--text-soft);
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
}
.tabs button.active { background: #fff; color: var(--forest); box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08); }

.row { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
.row .field { min-width: 120px; }
.grow { flex: 1; }
.calib .hint { margin-bottom: 10px; }
.file-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; min-height: 36px; font-size: 0.85rem; }
.err { color: var(--bad); font-size: 0.82rem; }

.advanced { border-top: 1px solid var(--border); padding-top: 10px; }
.advanced summary { cursor: pointer; font-weight: 600; font-size: 0.88rem; color: var(--forest); margin-bottom: 8px; }
.advanced .field { margin-bottom: 12px; }
.scale { display: flex; justify-content: space-between; font-size: 0.75rem !important; font-weight: 400 !important; color: var(--text-dim) !important; }
</style>
