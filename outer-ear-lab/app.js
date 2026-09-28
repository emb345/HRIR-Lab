const SPEED_OF_SOUND = 343;
const ANALYSIS_SAMPLE_RATE = 96000;
const FREQUENCIES = logSpace(20, 20000, 480);
const DB_RANGE = { min: -18, max: 24 };
const BINAURAL_SAMPLE_RATE = 48000;
const BINAURAL_FFT_SIZE = 2048;
const BINAURAL_REFERENCE_DELAY_SECONDS = 0.003;
const BINAURAL_TEST_CASES = [
  { label: "Median plane", azimuthDeg: 0, elevationDeg: 0, expected: "Near-zero ITD and ILD; localization is dominated by spectral structure." },
  { label: "Right lateral", azimuthDeg: 75, elevationDeg: 0, expected: "The right ear leads and the high-frequency right-minus-left ILD grows." },
  { label: "Elevated", azimuthDeg: 0, elevationDeg: 45, expected: "ITD/ILD stay small while pinna/concha peaks and notches move." },
];

const PARAMETER_DEFS = [
  {
    key: "canalLengthMm",
    label: "Canal length",
    unit: "mm",
    min: 20,
    max: 40,
    step: 0.5,
    defaultValue: 27,
  },
  {
    key: "canalDiameterMm",
    label: "Canal diameter",
    unit: "mm",
    min: 4,
    max: 10,
    step: 0.1,
    defaultValue: 7,
  },
  {
    key: "conchaDepthMm",
    label: "Concha depth",
    unit: "mm",
    min: 5,
    max: 20,
    step: 0.5,
    defaultValue: 12,
  },
  {
    key: "conchaVolumeCc",
    label: "Concha volume",
    unit: "cc",
    min: 1,
    max: 8,
    step: 0.1,
    defaultValue: 3,
  },
  {
    key: "conchaApertureMm",
    label: "Aperture radius",
    unit: "mm",
    min: 2,
    max: 8,
    step: 0.1,
    defaultValue: 4.5,
  },
  {
    key: "reflectorLengthMm",
    label: "Reflector length L",
    unit: "mm",
    min: 2,
    max: 12,
    step: 0.2,
    defaultValue: 5,
  },
  {
    key: "reflectorRadiusMm",
    label: "Reflector radius a",
    unit: "mm",
    min: 5,
    max: 18,
    step: 0.2,
    defaultValue: 10,
  },
  {
    key: "reflectionPathMm",
    label: "Base reflection path",
    unit: "mm",
    min: 8,
    max: 24,
    step: 0.2,
    defaultValue: 14,
  },
  {
    key: "reflectionStrength",
    label: "Reflection strength",
    unit: "",
    min: 0.05,
    max: 0.95,
    step: 0.01,
    defaultValue: 0.6,
  },
  {
    key: "azimuthDeg",
    label: "Source azimuth",
    unit: "deg",
    min: -90,
    max: 90,
    step: 1,
    defaultValue: 0,
  },
  {
    key: "elevationDeg",
    label: "Source elevation",
    unit: "deg",
    min: -45,
    max: 90,
    step: 1,
    defaultValue: 0,
  },
  {
    key: "headRadiusMm",
    label: "Head radius",
    unit: "mm",
    min: 65,
    max: 115,
    step: 0.5,
    defaultValue: 87.5,
  },
  {
    key: "middleInertance",
    label: "Eardrum + ossicle inertance",
    unit: "m.u.",
    min: 0.0004,
    max: 0.003,
    step: 0.0001,
    defaultValue: 0.0012,
  },
  {
    key: "middleCompliance",
    label: "Eardrum compliance",
    unit: "m.u.",
    min: 0.000008,
    max: 0.00006,
    step: 0.000001,
    defaultValue: 0.00002,
  },
  {
    key: "middleResistance",
    label: "Eardrum/joint resistance",
    unit: "m.u.",
    min: 0.1,
    max: 2,
    step: 0.05,
    defaultValue: 0.65,
  },
  {
    key: "middleCavityVolumeCc",
    label: "Middle-ear cavity volume",
    unit: "cc",
    min: 0.5,
    max: 3,
    step: 0.1,
    defaultValue: 1.5,
  },
  {
    key: "jointCompliance",
    label: "Incudo-stapedial compliance",
    unit: "m.u.",
    min: 0.000012,
    max: 0.00008,
    step: 0.000001,
    defaultValue: 0.000035,
  },
  {
    key: "cochlearLoad",
    label: "Cochlear load resistance",
    unit: "m.u.",
    min: 0.5,
    max: 4,
    step: 0.1,
    defaultValue: 1.8,
  },
];

const PARAMETER_LOOKUP = Object.fromEntries(
  PARAMETER_DEFS.map((definition) => [definition.key, definition]),
);

const DEFAULTS = Object.fromEntries(
  PARAMETER_DEFS.map((definition) => [definition.key, definition.defaultValue]),
);

const SWEEPABLE_KEYS = [
  "canalLengthMm",
  "canalDiameterMm",
  "conchaDepthMm",
  "conchaVolumeCc",
  "conchaApertureMm",
  "reflectorLengthMm",
  "reflectorRadiusMm",
  "reflectionPathMm",
  "reflectionStrength",
  "azimuthDeg",
  "elevationDeg",
  "headRadiusMm",
  "middleInertance",
  "middleCompliance",
  "middleResistance",
  "middleCavityVolumeCc",
  "jointCompliance",
  "cochlearLoad",
];

const COLORS = {
  outer: "#2a7f7a",
  middle: "#8b5b9d",
  total: "#d5673f",
  combined: "#d5673f",
  reflector: "#c4902f",
  concha: "#2a7f7a",
  canal: "#2f5f9d",
  reflection: "#b44c2d",
  left: "#2f5f9d",
  right: "#d5673f",
  ild: "#8b5b9d",
};

const MIDDLE_CIRCUIT_CONSTANTS = {
  cavityPassageCompliance: 0.000018,
  cavityPassageInertance: 0.0007,
  cavityPassageResistance: 0.08,
  cavityWallResistance: 0.18,
  eardrumSecondaryCompliance: 0.000035,
  eardrumSecondaryResistance: 0.28,
  cochlearCompliance: 0.00004,
  cochlearInertance: 0.00006,
  // The class diagram shows no source resistor, so use an ideal pressure source.
  sourceImpedance: 0,
  // Keep the transmission as a unit-normalized circuit ratio.
  transmissionScale: 1,
};

const dom = {
  parameterInputs: Array.from(document.querySelectorAll("[data-param]")),
  iecToggle: document.getElementById("iec318Enabled"),
  resetButton: document.getElementById("resetButton"),
  exportButton: document.getElementById("exportButton"),
  medianPreset: document.getElementById("medianPreset"),
  lateralPreset: document.getElementById("lateralPreset"),
  elevatedPreset: document.getElementById("elevatedPreset"),
  sweepParameter: document.getElementById("sweepParameter"),
  sweepTraceCount: document.getElementById("sweepTraceCount"),
  markerList: document.getElementById("markerList"),
  summaryChip: document.getElementById("summaryChip"),
  binauralSummaryChip: document.getElementById("binauralSummaryChip"),
  binauralMarkerList: document.getElementById("binauralMarkerList"),
  directionCheckList: document.getElementById("directionCheckList"),
  audioStatus: document.getElementById("audioStatus"),
  audioFileInput: document.getElementById("audioFileInput"),
  playNoiseButton: document.getElementById("playNoiseButton"),
  playSweepButton: document.getElementById("playSweepButton"),
  playFileButton: document.getElementById("playFileButton"),
  downloadBinauralButton: document.getElementById("downloadBinauralButton"),
  stopAudioButton: document.getElementById("stopAudioButton"),
  plots: {
    combined: document.getElementById("combinedPlot"),
    reflector: document.getElementById("reflectorPlot"),
    concha: document.getElementById("conchaPlot"),
    canal: document.getElementById("canalPlot"),
    reflection: document.getElementById("reflectionPlot"),
    middle: document.getElementById("middlePlot"),
    middlePhase: document.getElementById("middlePhasePlot"),
    middleImpedance: document.getElementById("middleImpedancePlot"),
    sweep: document.getElementById("sweepPlot"),
    hrtf: document.getElementById("hrtfPlot"),
    hrir: document.getElementById("hrirPlot"),
    ild: document.getElementById("ildPlot"),
    spatialCue: document.getElementById("spatialCuePlot"),
  },
};

const audioState = {
  context: null,
  source: null,
  sourceNodes: [],
  activeNodes: [],
  uploadedBuffer: null,
};

let latestModel = null;
let latestBinauralModel = null;

initialize();

function initialize() {
  buildSweepMenu();
  bindParameterEvents();
  bindActionEvents();
  refreshParameterReadouts();
  updateView();
}

function buildSweepMenu() {
  SWEEPABLE_KEYS.forEach((key) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = PARAMETER_LOOKUP[key].label;
    dom.sweepParameter.appendChild(option);
  });
  dom.sweepParameter.value = "canalLengthMm";
}

function bindParameterEvents() {
  dom.parameterInputs.forEach((input) => {
    input.addEventListener("input", () => {
      updateReadout(input.dataset.param, Number(input.value));
      updateView();
    });
  });

  dom.iecToggle.addEventListener("change", updateView);
  dom.sweepParameter.addEventListener("change", updateView);
  dom.sweepTraceCount.addEventListener("change", updateView);
}

function bindActionEvents() {
  dom.resetButton.addEventListener("click", resetParameters);
  dom.exportButton.addEventListener("click", exportReportSnippet);
  dom.medianPreset.addEventListener("click", () => applyDirectionPreset(0, 0));
  dom.lateralPreset.addEventListener("click", () => applyDirectionPreset(75, 0));
  dom.elevatedPreset.addEventListener("click", () => applyDirectionPreset(0, 45));
  dom.playNoiseButton.addEventListener("click", playNoisePreview);
  dom.playSweepButton.addEventListener("click", playToneSweepPreview);
  dom.stopAudioButton.addEventListener("click", stopAudio);
  dom.playFileButton.addEventListener("click", playUploadedAudio);
  dom.downloadBinauralButton.addEventListener("click", downloadBinauralExample);
  dom.audioFileInput.addEventListener("change", handleAudioUpload);
}

function applyDirectionPreset(azimuthDeg, elevationDeg) {
  getInput("azimuthDeg").value = azimuthDeg;
  getInput("elevationDeg").value = elevationDeg;
  updateReadout("azimuthDeg", azimuthDeg);
  updateReadout("elevationDeg", elevationDeg);
  updateView();
  setAudioStatus(`Loaded source direction ${azimuthDeg > 0 ? "+" : ""}${azimuthDeg}°, ${elevationDeg > 0 ? "+" : ""}${elevationDeg}°.`);
}

function refreshParameterReadouts() {
  PARAMETER_DEFS.forEach((definition) => {
    const input = getInput(definition.key);
    updateReadout(definition.key, Number(input.value));
  });
}

function resetParameters() {
  PARAMETER_DEFS.forEach((definition) => {
    const input = getInput(definition.key);
    input.value = definition.defaultValue;
  });
  dom.iecToggle.checked = true;
  refreshParameterReadouts();
  updateView();
  setAudioStatus("Parameters reset to the baseline anatomy.");
}

function updateReadout(key, value) {
  const output = document.getElementById(`${key}Value`);
  if (output) {
    output.textContent = formatParameterValue(key, value);
  }
}

function readParameters() {
  const parameters = {};
  PARAMETER_DEFS.forEach((definition) => {
    parameters[definition.key] = Number(getInput(definition.key).value);
  });
  parameters.iec318Enabled = dom.iecToggle.checked;
  return parameters;
}

function updateView() {
  const parameters = readParameters();
  const model = computeModel(parameters);
  latestModel = model;
  const binauralModel = computeBinauralModel(parameters);
  latestBinauralModel = binauralModel;

  renderPlot(dom.plots.combined, [
    { label: "Outer ear", values: model.outerDb, color: COLORS.outer },
    { label: "Middle ear", values: model.middleDb, color: COLORS.middle },
    { label: "Combined", values: model.combinedTotalDb, color: COLORS.total },
  ], {
    yRange: DB_RANGE,
    markers: [
      {
        frequency: model.metrics.reflector.breakHz,
        label: "Reflector break",
      },
      {
        frequency: model.metrics.concha.helmholtzHz,
        label: "Helmholtz",
      },
      {
        frequency: model.metrics.canal.f1,
        label: "Canal f1",
      },
      {
        frequency: model.metrics.reflection.notchHz,
        label: "Pinna notch",
      },
    ],
  });

  renderPlot(dom.plots.reflector, [
    { label: "Reflector", values: model.reflectorDb, color: COLORS.reflector },
  ], { yRange: DB_RANGE });

  renderPlot(dom.plots.concha, [
    { label: "Concha", values: model.conchaDb, color: COLORS.concha },
  ], { yRange: DB_RANGE });

  renderPlot(dom.plots.canal, [
    { label: "Canal", values: model.canalDb, color: COLORS.canal },
  ], { yRange: DB_RANGE });

  renderPlot(dom.plots.reflection, [
    {
      label: "Reflection",
      values: model.reflectionDb,
      color: COLORS.reflection,
    },
  ], { yRange: DB_RANGE });

  renderPlot(dom.plots.middle, [
    { label: "Middle ear", values: model.middleDb, color: COLORS.middle },
  ], {
    yRange: { min: -36, max: 12 },
    yTicks: [12, 6, 0, -6, -12, -18, -24, -30, -36],
    markers: [
      {
        frequency: model.metrics.middle.transmissionPeak.frequency,
        label: "Transmission peak",
      },
    ],
  });

  renderPlot(dom.plots.middlePhase, [
    { label: "Phase", values: model.middlePhaseDeg, color: COLORS.middle },
  ], {
    yRange: { min: -180, max: 180 },
    yTicks: [-180, -120, -60, 0, 60, 120, 180],
    yLabel: "Phase (degrees)",
  });

  renderPlot(dom.plots.middleImpedance, [
    {
      label: "Input impedance",
      values: model.middleInputImpedanceDb,
      color: COLORS.canal,
    },
  ], {
    yRange: { min: -12, max: 30 },
    yTicks: [30, 24, 18, 12, 6, 0, -6, -12],
  });

  renderPlot(dom.plots.sweep, buildSweepSeries(parameters), {
    yRange: DB_RANGE,
    showLegend: true,
  });

  renderMarkerList(model);
  renderSummaryChip(model);
  renderBinauralView(binauralModel, parameters);
}

function computeModel(parameters) {
  const reflector = computeReflectorResponse(parameters);
  const concha = computeConchaResponse(parameters);
  const canal = computeCanalResponse(parameters);
  const reflection = computeReflectionResponse(parameters);
  const middle = computeMiddleEarResponse(parameters);

  const combinedMagnitude = FREQUENCIES.map((_, index) => (
    reflector.magnitudes[index] *
    concha.magnitudes[index] *
    canal.magnitudes[index] *
    reflection.magnitudes[index]
  ));

  const outerDb = combinedMagnitude.map(magnitudeToDb);
  const combinedTotalMagnitude = combinedMagnitude.map(
    (magnitude, index) => magnitude * middle.magnitudes[index],
  );
  const combinedTotalDb = combinedTotalMagnitude.map(magnitudeToDb);
  const combinedPeak = findExtremum(FREQUENCIES, combinedTotalDb, "max");
  const highBandNotch = findExtremum(
    FREQUENCIES.filter((frequency) => frequency >= 4000),
    combinedTotalDb.slice(FREQUENCIES.findIndex((frequency) => frequency >= 4000)),
    "min",
  );

  return {
    parameters,
    reflectorDb: reflector.magnitudes.map(magnitudeToDb),
    conchaDb: concha.magnitudes.map(magnitudeToDb),
    canalDb: canal.magnitudes.map(magnitudeToDb),
    reflectionDb: reflection.magnitudes.map(magnitudeToDb),
    combinedDb: combinedTotalDb,
    outerDb,
    middleDb: middle.magnitudes.map(magnitudeToDb),
    middlePhaseDeg: middle.phasesDeg,
    middleInputImpedanceDb: middle.inputImpedanceMagnitudes.map(magnitudeToDb),
    combinedTotalDb,
    metrics: {
      reflector: reflector.metrics,
      concha: concha.metrics,
      canal: canal.metrics,
      reflection: reflection.metrics,
      middle: middle.metrics,
      combinedPeak,
      highBandNotch,
    },
  };
}

// Binaural model -----------------------------------------------------------
// The HRTF is intentionally built as a complex frequency response.  Its
// magnitude comes from the outer-ear and head-shadow terms; its phase comes
// from ear-specific pinna paths and the interaural delay.  The conjugate-
// symmetric spectrum below therefore produces a real HRIR after the IFFT.
function computeBinauralModel(parameters, sampleRate = BINAURAL_SAMPLE_RATE) {
  const positiveBinFrequencies = Array.from(
    { length: BINAURAL_FFT_SIZE / 2 + 1 },
    (_, index) => (index * sampleRate) / BINAURAL_FFT_SIZE,
  );
  const binPair = computeBinauralPairAtFrequencies(
    parameters,
    positiveBinFrequencies,
    sampleRate,
  );
  const displayPair = computeBinauralPairAtFrequencies(
    parameters,
    FREQUENCIES,
    sampleRate,
  );
  const leftSpectrum = makeConjugateSymmetricSpectrum(binPair.left);
  const rightSpectrum = makeConjugateSymmetricSpectrum(binPair.right);
  const hrirLeft = inverseFastFourierTransform(leftSpectrum).map(
    (value) => value.real,
  );
  const hrirRight = inverseFastFourierTransform(rightSpectrum).map(
    (value) => value.real,
  );
  const leftDb = displayPair.left.map((value) => magnitudeToDb(complexMagnitude(value)));
  const rightDb = displayPair.right.map((value) => magnitudeToDb(complexMagnitude(value)));
  const ildDb = rightDb.map((value, index) => value - leftDb[index]);
  const hrirArrivalLeft = findHrirArrival(hrirLeft);
  const hrirArrivalRight = findHrirArrival(hrirRight);
  const hrirOnsetItdSeconds =
    (hrirArrivalRight - hrirArrivalLeft) / sampleRate;

  return {
    parameters,
    sampleRate,
    fftSize: BINAURAL_FFT_SIZE,
    hrirLeft,
    hrirRight,
    leftDb,
    rightDb,
    ildDb,
    metrics: {
      modeledItdSeconds: binPair.metrics.itdSeconds,
      hrirOnsetItdSeconds,
      hrirArrivalLeft,
      hrirArrivalRight,
      ildAt1kDb: valueAtFrequency(FREQUENCIES, ildDb, 1000),
      ildAt8kDb: valueAtFrequency(FREQUENCIES, ildDb, 8000),
      leftNotch: findBandExtremum(FREQUENCIES, leftDb, 3500, 16000, "min"),
      rightNotch: findBandExtremum(FREQUENCIES, rightDb, 3500, 16000, "min"),
    },
  };
}

function computeBinauralPairAtFrequencies(parameters, frequencies, sampleRate) {
  const headRadiusMeters = millimetersToMeters(parameters.headRadiusMm);
  const azimuth = degreesToRadians(parameters.azimuthDeg);
  const elevation = degreesToRadians(parameters.elevationDeg);
  // Woodworth's spherical-head approximation, projected onto the horizontal
  // plane. Positive values mean that the right ear has the shorter path.
  const projectedAzimuth = Math.asin(
    clamp(Math.sin(azimuth) * Math.cos(elevation), -1, 1),
  );
  const itdSeconds =
    (headRadiusMeters / SPEED_OF_SOUND) *
    (projectedAzimuth + Math.sin(projectedAzimuth));
  const direction = { azimuth, elevation, itdSeconds };

  return {
    left: frequencies.map((frequency) =>
      computeEarHrtfComplex(frequency, parameters, -1, direction, sampleRate),
    ),
    right: frequencies.map((frequency) =>
      computeEarHrtfComplex(frequency, parameters, 1, direction, sampleRate),
    ),
    metrics: { itdSeconds },
  };
}

function computeEarHrtfComplex(frequency, parameters, earSide, direction, sampleRate) {
  const geometry = deriveBinauralEarGeometry(parameters, earSide, direction);
  const reflectorGain = dbToMagnitude(geometry.reflectorGainDb);
  const concha = makePeakingFilterForSampleRate(
    geometry.conchaHz,
    geometry.conchaQ,
    geometry.conchaGainDb,
    sampleRate,
  );
  const canalFilters = [
    makePeakingFilterForSampleRate(
      geometry.canalF1,
      geometry.canalQ1,
      geometry.canalGain1Db,
      sampleRate,
    ),
    makeNotchFilterForSampleRate(
      geometry.canalF2,
      geometry.canalQ2,
      geometry.canalNotchDepthDb,
      sampleRate,
    ),
    makePeakingFilterForSampleRate(
      geometry.canalF3,
      geometry.canalQ3,
      geometry.canalGain3Db,
      sampleRate,
    ),
  ];

  if (parameters.iec318Enabled) {
    canalFilters.push(
      makePeakingFilterForSampleRate(220, 0.85, 1.4, sampleRate),
      makePeakingFilterForSampleRate(2000, 1.05, 2.3, sampleRate),
    );
  }

  let response = complex(reflectorGain, 0);
  response = multiplyComplex(response, biquadComplexAtFrequency(concha, frequency));
  canalFilters.forEach((filter) => {
    response = multiplyComplex(response, biquadComplexAtFrequency(filter, frequency));
  });

  const angularFrequency = 2 * Math.PI * frequency;
  const pinnaReflection = addComplex(
    complex(1, 0),
    scaleComplex(
      complexDelay(angularFrequency, geometry.pinnaPathSeconds),
      geometry.reflectionStrength /
        Math.sqrt(1 + (frequency / 12000) ** 2),
    ),
  );
  response = multiplyComplex(response, pinnaReflection);
  const shadowFrequencyWeight =
    (frequency / 1800) ** 1.15 / (1 + (frequency / 1800) ** 1.15);
  const headShadowDb = -18 * geometry.contralateralness * shadowFrequencyWeight;
  response = scaleComplex(response, dbToMagnitude(headShadowDb));

  const earDelaySeconds =
    BINAURAL_REFERENCE_DELAY_SECONDS - earSide * direction.itdSeconds * 0.5;
  return multiplyComplex(response, complexDelay(angularFrequency, earDelaySeconds));
}

function deriveBinauralEarGeometry(parameters, earSide, direction) {
  const sinAzimuth = Math.sin(direction.azimuth);
  const sinElevation = Math.sin(direction.elevation);
  const ipsilateralness = earSide * sinAzimuth;
  const contralateralness = clamp(-ipsilateralness, 0, 1);
  const reflectorRadius = millimetersToMeters(parameters.reflectorRadiusMm);
  const reflectorLength = millimetersToMeters(parameters.reflectorLengthMm);
  const reflectorRatio = reflectorLength / reflectorRadius;
  const reflectorBreakHz = SPEED_OF_SOUND / (16 * reflectorRadius);
  const reflectorSlopeDbPerOctave = clamp(6 * (reflectorRatio / 0.5), 3.5, 9);
  const reflectorMaxGainDb = clamp(12 * Math.sqrt(reflectorRatio / 0.5), 6, 18);
  const effectiveReflectorHz = 7000;
  const reflectorGainDb = Math.min(
    reflectorMaxGainDb,
    Math.max(0, Math.log2(effectiveReflectorHz / reflectorBreakHz)) *
      reflectorSlopeDbPerOctave,
  );

  const conchaVolume = cubicCentimetersToCubicMeters(parameters.conchaVolumeCc);
  const conchaRadius = millimetersToMeters(parameters.conchaApertureMm);
  const conchaArea = Math.PI * conchaRadius ** 2;
  const conchaDepth = millimetersToMeters(parameters.conchaDepthMm);
  const conchaEffectiveLength = conchaDepth + 1.7 * conchaRadius;
  const baseConchaHz =
    (SPEED_OF_SOUND / (2 * Math.PI)) *
    Math.sqrt(conchaArea / (conchaVolume * conchaEffectiveLength));
  const baseConchaQ = clamp(
    0.7 + 2.2 * (conchaRadius / Math.max(conchaDepth, 0.001)),
    0.7,
    3.1,
  );
  const baseConchaGainDb = clamp(
    5 + 4 * Math.log2(Math.sqrt(conchaArea / (conchaVolume * conchaEffectiveLength)) / 32),
    2,
    12,
  );

  const canalRadius = millimetersToMeters(parameters.canalDiameterMm / 2);
  const canalLength = millimetersToMeters(parameters.canalLengthMm);
  const canalF1 = SPEED_OF_SOUND / (4 * (canalLength + 0.6 * canalRadius));
  const narrowness = clamp(Math.sqrt(7 / parameters.canalDiameterMm), 0.7, 1.55);
  const elevationShift = sinElevation;
  const pinnaPathMm = clamp(
    parameters.reflectionPathMm *
      (1 + 0.24 * ipsilateralness + 0.16 * elevationShift - 0.06 * (1 - Math.cos(direction.azimuth))),
    7,
    28,
  );
  return {
    conchaHz: clamp(
      baseConchaHz * (1 + 0.1 * ipsilateralness - 0.15 * elevationShift),
      350,
      8000,
    ),
    conchaQ: clamp(baseConchaQ * (1 + 0.1 * Math.abs(ipsilateralness)), 0.7, 3.5),
    conchaGainDb: baseConchaGainDb + 1.2 * ipsilateralness,
    reflectorGainDb,
    canalF1,
    canalF2: 2 * canalF1,
    canalF3: 3 * canalF1,
    canalQ1: clamp(1.25 * narrowness, 0.85, 2.3),
    canalQ2: clamp(1.05 * narrowness, 0.8, 2.1),
    canalQ3: clamp(1.7 * narrowness, 1, 2.8),
    canalGain1Db: clamp(6.5 * narrowness, 4, 11),
    canalNotchDepthDb: clamp(4.3 * narrowness, 2.5, 8),
    canalGain3Db: clamp(3.2 * narrowness, 1.5, 6.5),
    pinnaPathSeconds: millimetersToMeters(pinnaPathMm) / SPEED_OF_SOUND,
    reflectionStrength: clamp(
      parameters.reflectionStrength *
        (1 + 0.14 * ipsilateralness + 0.12 * Math.max(0, elevationShift)),
      0.03,
      0.95,
    ),
    // A smooth, frequency-dependent attenuation at the far ear.  It is an
    // interpretable head-shadow approximation, not a measured diffraction solution.
    contralateralness,
  };
}

function renderBinauralView(model, parameters) {
  renderSpatialCueDiagram(dom.plots.spatialCue, model, parameters);
  renderPlot(dom.plots.hrtf, [
    { label: "Left", values: model.leftDb, color: COLORS.left },
    { label: "Right", values: model.rightDb, color: COLORS.right },
  ], {
    yRange: { min: -30, max: 30 },
    yTicks: [-30, -20, -10, 0, 10, 20, 30],
    showLegend: true,
  });

  renderTimePlot(dom.plots.hrir, [
    { label: "Left", values: model.hrirLeft, color: COLORS.left },
    { label: "Right", values: model.hrirRight, color: COLORS.right },
  ], model.sampleRate, { durationSeconds: 0.012, showLegend: true });

  renderPlot(dom.plots.ild, [
    { label: "Right − Left", values: model.ildDb, color: COLORS.ild },
  ], {
    yRange: { min: -24, max: 24 },
    yTicks: [-24, -16, -8, 0, 8, 16, 24],
    yLabel: "ILD (dB)",
  });

  const metrics = model.metrics;
  const measuredItdMs = metrics.hrirOnsetItdSeconds * 1000;
  const leadingEar =
    Math.abs(measuredItdMs) < 0.02
      ? "Neither (median-plane cue)"
      : measuredItdMs < 0
        ? "Right"
        : "Left";
  const rows = [
    ["HRIR onset ITD (R − L)", `${formatSignedMilliseconds(measuredItdMs)} ms`],
    ["Leading ear", leadingEar],
    ["ILD at 1 kHz (R − L)", formatDb(metrics.ildAt1kDb)],
    ["ILD at 8 kHz (R − L)", formatDb(metrics.ildAt8kDb)],
    ["Left high-band notch", formatFrequency(metrics.leftNotch.frequency)],
    ["Right high-band notch", formatFrequency(metrics.rightNotch.frequency)],
  ];
  dom.binauralMarkerList.innerHTML = rows
    .map(([label, value]) => `<div class="marker-row"><strong>${label}</strong><span>${value}</span></div>`)
    .join("");
  dom.binauralSummaryChip.textContent =
    `${leadingEar} leads · HRIR ITD ${formatSignedMilliseconds(measuredItdMs)} ms · 8 kHz ILD ${formatDb(metrics.ildAt8kDb)}`;
  renderDirectionCheck(parameters);
}

function renderSpatialCueDiagram(svg, model, parameters) {
  const width = 760;
  const height = 260;
  const head = { x: 172, y: 138, radius: 50 };
  const azimuth = degreesToRadians(parameters.azimuthDeg);
  const elevation = degreesToRadians(parameters.elevationDeg);
  const orbitRadius = 92;
  const elevationLift = Math.sin(elevation) * 34;
  const source = {
    x: head.x + orbitRadius * Math.sin(azimuth),
    y: head.y - orbitRadius * Math.cos(azimuth) - elevationLift,
  };
  const ears = {
    left: { x: head.x - head.radius - 7, y: head.y, color: COLORS.left },
    right: { x: head.x + head.radius + 7, y: head.y, color: COLORS.right },
  };
  const leftArrivalMs = (model.metrics.hrirArrivalLeft / model.sampleRate) * 1000;
  const rightArrivalMs = (model.metrics.hrirArrivalRight / model.sampleRate) * 1000;
  const timeStart = 1.8;
  const timeEnd = 4.4;
  const timeline = { x: 426, width: 286, leftY: 95, rightY: 176 };
  const timeToX = (milliseconds) =>
    timeline.x + timeline.width * clamp((milliseconds - timeStart) / (timeEnd - timeStart), 0, 1);

  svg.innerHTML = "";
  svg.appendChild(createSvgElement("rect", {
    x: 0,
    y: 0,
    width,
    height,
    rx: 16,
    fill: "transparent",
  }));

  const sceneTitle = createSvgText(28, 28, "Source geometry", "spatial-cue-title");
  svg.appendChild(sceneTitle);
  const timeTitle = createSvgText(timeline.x, 28, "IR arrival timeline", "spatial-cue-title");
  svg.appendChild(timeTitle);

  // A faint orbit makes azimuth movement legible; the vertical stem on the
  // source dot grows with elevation to keep that second direction visible too.
  svg.appendChild(createSvgElement("circle", {
    cx: head.x,
    cy: head.y,
    r: orbitRadius,
    fill: "none",
    stroke: "rgba(113, 86, 68, 0.2)",
    "stroke-width": 1.2,
    "stroke-dasharray": "4 5",
  }));
  svg.appendChild(createSvgElement("line", {
    x1: source.x,
    y1: source.y + elevationLift,
    x2: source.x,
    y2: source.y,
    stroke: "rgba(139, 91, 157, 0.65)",
    "stroke-width": 2,
    "stroke-dasharray": "4 3",
  }));

  [0.26, 0.5, 0.74].forEach((scale, index) => {
    svg.appendChild(createSvgElement("circle", {
      cx: source.x,
      cy: source.y,
      r: 16 + index * 12,
      fill: "none",
      stroke: "rgba(213, 103, 63, 0.22)",
      "stroke-width": 1.4,
      opacity: scale,
    }));
  });

  const farEarIsLeft = model.metrics.ildAt8kDb > 0.4;
  const farEarIsRight = model.metrics.ildAt8kDb < -0.4;
  [
    { ear: ears.left, isFar: farEarIsLeft },
    { ear: ears.right, isFar: farEarIsRight },
  ].forEach(({ ear, isFar }) => {
    svg.appendChild(createSvgElement("line", {
      x1: source.x,
      y1: source.y,
      x2: ear.x,
      y2: ear.y,
      stroke: ear.color,
      "stroke-width": isFar ? 2.2 : 3.8,
      opacity: isFar ? 0.32 : 0.78,
      "stroke-dasharray": isFar ? "7 5" : "none",
    }));
  });

  svg.appendChild(createSvgElement("circle", {
    cx: head.x,
    cy: head.y,
    r: head.radius,
    fill: "rgba(255, 250, 242, 0.94)",
    stroke: "rgba(45, 32, 22, 0.32)",
    "stroke-width": 2,
  }));
  svg.appendChild(createSvgElement("path", {
    d: `M ${head.x - 18} ${head.y - 8} Q ${head.x} ${head.y - 23} ${head.x + 18} ${head.y - 8}`,
    fill: "none",
    stroke: "rgba(45, 32, 22, 0.35)",
    "stroke-width": 1.6,
    "stroke-linecap": "round",
  }));
  Object.entries(ears).forEach(([side, ear]) => {
    svg.appendChild(createSvgElement("circle", {
      cx: ear.x,
      cy: ear.y,
      r: 7,
      fill: ear.color,
      stroke: "white",
      "stroke-width": 2,
    }));
    svg.appendChild(createSvgText(ear.x, ear.y + 25, side === "left" ? "L ear" : "R ear", "spatial-cue-ear-label", "middle"));
  });
  svg.appendChild(createSvgElement("circle", {
    cx: source.x,
    cy: source.y,
    r: 9,
    fill: "#d5673f",
    stroke: "white",
    "stroke-width": 3,
  }));
  const sourceLabelY = source.y < 72 ? Math.max(70, source.y + 24) : source.y - 18;
  svg.appendChild(createSvgText(
    source.x,
    sourceLabelY,
    `Source ${formatSignedDegrees(parameters.azimuthDeg)} az · ${formatSignedDegrees(parameters.elevationDeg)} el`,
    "spatial-cue-source-label",
    "middle",
  ));

  const shadowLabel = farEarIsLeft
    ? "L ear: shadowed"
    : farEarIsRight
      ? "R ear: shadowed"
      : "No lateral head shadow";
  svg.appendChild(createSvgText(head.x, 238, shadowLabel, "spatial-cue-detail", "middle"));

  [timeline.leftY, timeline.rightY].forEach((y, index) => {
    svg.appendChild(createSvgElement("line", {
      x1: timeline.x,
      y1: y,
      x2: timeline.x + timeline.width,
      y2: y,
      stroke: "rgba(113, 86, 68, 0.26)",
      "stroke-width": 1.25,
    }));
    const label = createSvgText(
      timeline.x - 12,
      y + 4,
      index === 0 ? "Left" : "Right",
      "spatial-cue-ear-label",
      "end",
    );
    svg.appendChild(label);
  });
  [2, 3, 4].forEach((milliseconds) => {
    const x = timeToX(milliseconds);
    svg.appendChild(createSvgElement("line", {
      x1: x,
      y1: 50,
      x2: x,
      y2: 211,
      stroke: "rgba(113, 86, 68, 0.14)",
      "stroke-width": 1,
      "stroke-dasharray": "3 4",
    }));
    svg.appendChild(createSvgText(x, 230, `${milliseconds} ms`, "spatial-cue-axis-label", "middle"));
  });

  drawHrirTimelineTrace(svg, model.hrirLeft, model.sampleRate, timeline, timeline.leftY, COLORS.left, timeStart, timeEnd);
  drawHrirTimelineTrace(svg, model.hrirRight, model.sampleRate, timeline, timeline.rightY, COLORS.right, timeStart, timeEnd);
  [
    { time: leftArrivalMs, y: timeline.leftY, color: COLORS.left },
    { time: rightArrivalMs, y: timeline.rightY, color: COLORS.right },
  ].forEach(({ time, y, color }) => {
    const x = timeToX(time);
    svg.appendChild(createSvgElement("line", {
      x1: x,
      y1: y - 26,
      x2: x,
      y2: y + 26,
      stroke: color,
      "stroke-width": 1.6,
      "stroke-dasharray": "3 3",
    }));
    svg.appendChild(createSvgElement("circle", {
      cx: x,
      cy: y,
      r: 5.5,
      fill: color,
      stroke: "white",
      "stroke-width": 2,
    }));
  });
  svg.appendChild(createSvgText(
    timeline.x + timeline.width / 2,
    250,
    `Onset ITD (R − L): ${formatSignedMilliseconds(model.metrics.hrirOnsetItdSeconds * 1000)} ms`,
    "spatial-cue-detail",
    "middle",
  ));
}

function drawHrirTimelineTrace(svg, hrir, sampleRate, timeline, baselineY, color, startMs, endMs) {
  const start = Math.max(0, Math.floor((startMs / 1000) * sampleRate));
  const end = Math.min(hrir.length - 1, Math.ceil((endMs / 1000) * sampleRate));
  const values = hrir.slice(start, end + 1);
  const peak = Math.max(...values.map((value) => Math.abs(value)), 1e-6);
  const path = values.map((value, index) => {
    const ratio = index / Math.max(1, values.length - 1);
    const x = timeline.x + ratio * timeline.width;
    const y = baselineY - (value / peak) * 20;
    return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ");
  svg.appendChild(createSvgElement("path", {
    d: path,
    fill: "none",
    stroke: color,
    "stroke-width": 1.65,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    opacity: 0.9,
  }));
}

function createSvgText(x, y, text, className, anchor = "start") {
  const element = createSvgElement("text", {
    x,
    y,
    "text-anchor": anchor,
    class: className,
  });
  element.textContent = text;
  return element;
}

function renderDirectionCheck(parameters) {
  dom.directionCheckList.innerHTML = BINAURAL_TEST_CASES.map((testCase) => {
    const caseParameters = {
      ...parameters,
      azimuthDeg: testCase.azimuthDeg,
      elevationDeg: testCase.elevationDeg,
    };
    const response = computeBinauralPairAtFrequencies(
      caseParameters,
      FREQUENCIES,
      BINAURAL_SAMPLE_RATE,
    );
    const leftDb = response.left.map((value) => magnitudeToDb(complexMagnitude(value)));
    const rightDb = response.right.map((value) => magnitudeToDb(complexMagnitude(value)));
    const ildAt8k = valueAtFrequency(
      FREQUENCIES,
      rightDb.map((value, index) => value - leftDb[index]),
      8000,
    );
    const rightLead = response.metrics.itdSeconds > 1e-6;
    const leftLead = response.metrics.itdSeconds < -1e-6;
    const leadLabel = rightLead ? "Right leads" : leftLead ? "Left leads" : "No ear leads";
    return `
      <article class="direction-check-row">
        <div><strong>${testCase.label}</strong><span>${testCase.azimuthDeg > 0 ? "+" : ""}${testCase.azimuthDeg}°, ${testCase.elevationDeg > 0 ? "+" : ""}${testCase.elevationDeg}°</span></div>
        <div><strong>${leadLabel}</strong><span>model ITD (R − L) ${formatSignedMilliseconds(-response.metrics.itdSeconds * 1000)} ms · ILD@8 kHz ${formatDb(ildAt8k)}</span></div>
        <p>${testCase.expected}</p>
      </article>
    `;
  }).join("");
}

function makeConjugateSymmetricSpectrum(positiveSpectrum) {
  const size = (positiveSpectrum.length - 1) * 2;
  const spectrum = Array.from({ length: size }, () => complex(0, 0));
  spectrum[0] = complex(complexMagnitude(positiveSpectrum[0]), 0);
  spectrum[size / 2] = complex(complexMagnitude(positiveSpectrum[positiveSpectrum.length - 1]), 0);
  for (let index = 1; index < positiveSpectrum.length - 1; index += 1) {
    spectrum[index] = positiveSpectrum[index];
    spectrum[size - index] = complex(
      positiveSpectrum[index].real,
      -positiveSpectrum[index].imaginary,
    );
  }
  return spectrum;
}

function inverseFastFourierTransform(values) {
  return fastFourierTransform(values, true);
}

function fastFourierTransform(values, inverse = false) {
  const size = values.length;
  const output = values.map((value) => complex(value.real, value.imaginary));
  for (let index = 1, reversed = 0; index < size; index += 1) {
    let bit = size >> 1;
    for (; reversed & bit; bit >>= 1) {
      reversed ^= bit;
    }
    reversed ^= bit;
    if (index < reversed) {
      [output[index], output[reversed]] = [output[reversed], output[index]];
    }
  }

  for (let length = 2; length <= size; length <<= 1) {
    const angle = ((inverse ? 2 : -2) * Math.PI) / length;
    const twiddleStep = complex(Math.cos(angle), Math.sin(angle));
    for (let start = 0; start < size; start += length) {
      let twiddle = complex(1, 0);
      const halfLength = length >> 1;
      for (let offset = 0; offset < halfLength; offset += 1) {
        const even = output[start + offset];
        const odd = multiplyComplex(output[start + offset + halfLength], twiddle);
        output[start + offset] = addComplex(even, odd);
        output[start + offset + halfLength] = complex(
          even.real - odd.real,
          even.imaginary - odd.imaginary,
        );
        twiddle = multiplyComplex(twiddle, twiddleStep);
      }
    }
  }
  return inverse ? output.map((value) => scaleComplex(value, 1 / size)) : output;
}

function complexDelay(angularFrequency, delaySeconds) {
  const phase = -angularFrequency * delaySeconds;
  return complex(Math.cos(phase), Math.sin(phase));
}

function makePeakingFilterForSampleRate(frequency, q, gainDb, sampleRate) {
  const omega = (2 * Math.PI * clamp(frequency, 5, sampleRate * 0.45)) / sampleRate;
  const alpha = Math.sin(omega) / (2 * q);
  const amplitude = Math.pow(10, gainDb / 40);
  const cosine = Math.cos(omega);
  const filter = normalizeBiquad({
    b0: 1 + alpha * amplitude,
    b1: -2 * cosine,
    b2: 1 - alpha * amplitude,
    a0: 1 + alpha / amplitude,
    a1: -2 * cosine,
    a2: 1 - alpha / amplitude,
  });
  filter.sampleRate = sampleRate;
  return filter;
}

function makeNotchFilterForSampleRate(frequency, q, depthDb, sampleRate) {
  const omega = (2 * Math.PI * clamp(frequency, 5, sampleRate * 0.45)) / sampleRate;
  const alpha = Math.sin(omega) / (2 * q);
  const cosine = Math.cos(omega);
  const filter = normalizeBiquad({
    b0: 1,
    b1: -2 * cosine,
    b2: 1,
    a0: 1 + alpha,
    a1: -2 * cosine,
    a2: 1 - alpha,
  });
  filter.mix = clamp(depthDb / 12, 0.2, 0.85);
  filter.sampleRate = sampleRate;
  return filter;
}

function biquadComplexAtFrequency(filter, frequency) {
  const omega = (2 * Math.PI * frequency) / filter.sampleRate;
  const numerator = complex(
    filter.b0 + filter.b1 * Math.cos(omega) + filter.b2 * Math.cos(2 * omega),
    -filter.b1 * Math.sin(omega) - filter.b2 * Math.sin(2 * omega),
  );
  const denominator = complex(
    1 + filter.a1 * Math.cos(omega) + filter.a2 * Math.cos(2 * omega),
    -filter.a1 * Math.sin(omega) - filter.a2 * Math.sin(2 * omega),
  );
  const filtered = divideComplex(numerator, denominator);
  return filter.mix === 1
    ? filtered
    : addComplex(scaleComplex(complex(1, 0), 1 - filter.mix), scaleComplex(filtered, filter.mix));
}

function findHrirArrival(hrir) {
  const peak = hrir.reduce((largest, value) => Math.max(largest, Math.abs(value)), 0);
  const threshold = peak * 0.12;
  const searchLength = Math.floor(hrir.length / 2);
  for (let index = 0; index < searchLength; index += 1) {
    if (Math.abs(hrir[index]) >= threshold) {
      return index;
    }
  }
  return 0;
}

function valueAtFrequency(frequencies, values, targetFrequency) {
  let closestIndex = 0;
  frequencies.forEach((frequency, index) => {
    if (Math.abs(frequency - targetFrequency) < Math.abs(frequencies[closestIndex] - targetFrequency)) {
      closestIndex = index;
    }
  });
  return values[closestIndex];
}

function findBandExtremum(frequencies, values, minFrequency, maxFrequency, mode) {
  const startIndex = frequencies.findIndex((frequency) => frequency >= minFrequency);
  const endIndex = frequencies.findIndex((frequency) => frequency >= maxFrequency);
  return findExtremum(
    frequencies.slice(startIndex, endIndex === -1 ? undefined : endIndex + 1),
    values.slice(startIndex, endIndex === -1 ? undefined : endIndex + 1),
    mode,
  );
}

function computeReflectorResponse(parameters) {
  const reflectorLength = millimetersToMeters(parameters.reflectorLengthMm);
  const reflectorRadius = millimetersToMeters(parameters.reflectorRadiusMm);
  const ratio = reflectorLength / reflectorRadius;
  const breakHz = SPEED_OF_SOUND / (16 * reflectorRadius);
  const slopeDbPerOctave = clamp(6 * (ratio / 0.5), 3.5, 9.0);
  const maxGainDb = clamp(12 * Math.sqrt(ratio / 0.5), 6, 18);

  const magnitudes = FREQUENCIES.map((frequency) => {
    const octavesAboveBreak = Math.max(0, Math.log2(frequency / breakHz));
    const gainDb = Math.min(maxGainDb, slopeDbPerOctave * octavesAboveBreak);
    return dbToMagnitude(gainDb);
  });

  return {
    magnitudes,
    metrics: {
      breakHz,
      ratio,
      slopeDbPerOctave,
      maxGainDb,
    },
  };
}

function computeConchaResponse(parameters) {
  const volume = cubicCentimetersToCubicMeters(parameters.conchaVolumeCc);
  const radius = millimetersToMeters(parameters.conchaApertureMm);
  const apertureArea = Math.PI * radius ** 2;
  const depth = millimetersToMeters(parameters.conchaDepthMm);
  const effectiveLength = depth + 1.7 * radius;
  const helmholtzHz =
    (SPEED_OF_SOUND / (2 * Math.PI)) *
    Math.sqrt(apertureArea / (volume * effectiveLength));

  const resonanceIndex = Math.sqrt(apertureArea / (volume * effectiveLength));
  const q = clamp(0.7 + 2.2 * (radius / Math.max(depth, 0.001)), 0.7, 3.1);
  const gainDb = clamp(5 + 4 * Math.log2(resonanceIndex / 32), 2, 12);
  const filter = makePeakingFilter(helmholtzHz, q, gainDb);
  const magnitudes = FREQUENCIES.map((frequency) =>
    biquadMagnitudeAtFrequency(filter, frequency),
  );

  return {
    magnitudes,
    metrics: {
      helmholtzHz,
      effectiveLength,
      apertureArea,
      q,
      gainDb,
    },
  };
}

function computeCanalResponse(parameters) {
  const radius = millimetersToMeters(parameters.canalDiameterMm / 2);
  const length = millimetersToMeters(parameters.canalLengthMm);
  const effectiveLength = length + 0.6 * radius;
  const f1 = SPEED_OF_SOUND / (4 * effectiveLength);
  const f2 = 2 * f1;
  const f3 = 3 * f1;

  const narrowness = clamp(Math.sqrt(7 / parameters.canalDiameterMm), 0.7, 1.55);
  const q1 = clamp(1.25 * narrowness, 0.85, 2.3);
  const q2 = clamp(1.05 * narrowness, 0.8, 2.1);
  const q3 = clamp(1.7 * narrowness, 1.0, 2.8);
  const gain1Db = clamp(6.5 * narrowness, 4, 11);
  const notchDepthDb = clamp(4.3 * narrowness, 2.5, 8);
  const gain3Db = clamp(3.2 * narrowness, 1.5, 6.5);

  const filters = [
    makePeakingFilter(f1, q1, gain1Db),
    makeNotchFilter(f2, q2, notchDepthDb),
    makePeakingFilter(f3, q3, gain3Db),
  ];

  if (parameters.iec318Enabled) {
    filters.push(makePeakingFilter(220, 0.85, 1.4));
    filters.push(makePeakingFilter(2000, 1.05, 2.3));
  }

  const magnitudes = FREQUENCIES.map((frequency) =>
    filters.reduce(
      (product, filter) => product * biquadMagnitudeAtFrequency(filter, frequency),
      1,
    ),
  );

  return {
    magnitudes,
    metrics: {
      effectiveLength,
      f1,
      f2,
      f3,
      q1,
      q2,
      q3,
      gain1Db,
      notchDepthDb,
      gain3Db,
    },
  };
}

function computeReflectionResponse(parameters) {
  const direction = deriveDirection(parameters);
  const effectivePathMeters = millimetersToMeters(direction.effectivePathMm);
  const effectiveStrength = direction.effectiveStrength;
  const absorptionCornerHz = 12000;
  const notchHz = SPEED_OF_SOUND / (2 * effectivePathMeters);

  const magnitudes = FREQUENCIES.map((frequency) => {
    const attenuation =
      effectiveStrength / Math.sqrt(1 + (frequency / absorptionCornerHz) ** 2);
    const phase = (2 * Math.PI * frequency * effectivePathMeters) / SPEED_OF_SOUND;
    const real = 1 + attenuation * Math.cos(phase);
    const imaginary = -attenuation * Math.sin(phase);
    return Math.sqrt(real ** 2 + imaginary ** 2);
  });

  return {
    magnitudes,
    metrics: {
      effectivePathMm: direction.effectivePathMm,
      effectiveStrength,
      notchHz,
    },
  };
}

function deriveDirection(parameters) {
  const azimuth = degreesToRadians(parameters.azimuthDeg);
  const elevation = degreesToRadians(parameters.elevationDeg);
  const directionScale =
    1 +
    0.22 * Math.sin(azimuth) +
    0.18 * Math.sin(elevation) -
    0.08 * (1 - Math.cos(azimuth) * Math.cos(elevation));

  const effectivePathMm = clamp(parameters.reflectionPathMm * directionScale, 8, 24);
  const effectiveStrength = clamp(
    parameters.reflectionStrength *
      (1 +
        0.22 * Math.abs(Math.sin(azimuth)) +
        0.12 * Math.max(0, Math.sin(elevation))),
    0.05,
    0.98,
  );

  return { effectivePathMm, effectiveStrength };
}

// The middle-ear network follows the class diagram and uses normalized model units.
function computeMiddleEarResponse(parameters) {
  const seriesImpedances = FREQUENCIES.map((frequency) => {
    const cavity = Z_cavity(frequency, parameters);
    const eardrumLosses = Z_eardrum(frequency, parameters);
    const ossicles = Z_ossicles(frequency, parameters);
    const joint = Z_joint(frequency, parameters);
    const cochlea = Z_cochlea(frequency, parameters);
    const distalLoad = parallelImpedance(joint, cochlea);
    const forwardPath = addComplex(ossicles, distalLoad);
    const proximalNode = parallelImpedance(eardrumLosses, forwardPath);
    const input = addComplex(cavity, proximalNode);
    const source = complex(MIDDLE_CIRCUIT_CONSTANTS.sourceImpedance, 0);
    const proximalDivider = divideComplex(
      proximalNode,
      addComplex(source, input),
    );
    const distalDivider = divideComplex(distalLoad, forwardPath);
    const transmission = scaleComplex(
      multiplyComplex(proximalDivider, distalDivider),
      MIDDLE_CIRCUIT_CONSTANTS.transmissionScale,
    );

    return { input, transmission };
  });

  const magnitudes = seriesImpedances.map(({ transmission }) => complexMagnitude(transmission));
  const phasesDeg = seriesImpedances.map(({ transmission }) =>
    (Math.atan2(transmission.imaginary, transmission.real) * 180) / Math.PI,
  );
  const inputImpedanceMagnitudes = seriesImpedances.map(({ input }) => complexMagnitude(input));
  const transmissionDb = magnitudes.map(magnitudeToDb);
  const inputImpedanceDb = inputImpedanceMagnitudes.map(magnitudeToDb);

  return {
    magnitudes,
    phasesDeg,
    inputImpedanceMagnitudes,
    metrics: {
      transmissionPeak: findExtremum(FREQUENCIES, transmissionDb, "max"),
      inputImpedancePeak: findExtremum(FREQUENCIES, inputImpedanceDb, "max"),
    },
  };
}

function Z_cavity(frequency, parameters) {
  const omega = 2 * Math.PI * frequency;
  const tympanicCompliance = parameters.middleCavityVolumeCc * 0.000002;
  const passageBranch = addComplex(
    impedanceCompliance(
      omega,
      MIDDLE_CIRCUIT_CONSTANTS.cavityPassageCompliance,
    ),
    addComplex(
      impedanceInertance(
        omega,
        MIDDLE_CIRCUIT_CONSTANTS.cavityPassageInertance,
      ),
      complex(MIDDLE_CIRCUIT_CONSTANTS.cavityPassageResistance, 0),
    ),
  );
  const wallLossBranch = complex(MIDDLE_CIRCUIT_CONSTANTS.cavityWallResistance, 0);
  const tympanicBranch = impedanceCompliance(omega, tympanicCompliance);
  return parallelImpedance(
    parallelImpedance(passageBranch, wallLossBranch),
    tympanicBranch,
  );
}

function Z_eardrum(frequency, parameters) {
  const omega = 2 * Math.PI * frequency;
  const secondMode = addComplex(
    impedanceCompliance(
      omega,
      MIDDLE_CIRCUIT_CONSTANTS.eardrumSecondaryCompliance,
    ),
    complex(MIDDLE_CIRCUIT_CONSTANTS.eardrumSecondaryResistance, 0),
  );
  const uncoupledMassBranch = impedanceInertance(
    omega,
    parameters.middleInertance * 0.8,
  );
  return addComplex(
    impedanceCompliance(omega, parameters.middleCompliance * 1.2),
    addComplex(
      parallelImpedance(uncoupledMassBranch, secondMode),
      complex(parameters.middleResistance * 0.6, 0),
    ),
  );
}

function Z_ossicles(frequency, parameters) {
  const omega = 2 * Math.PI * frequency;
  return addComplex(
    impedanceCompliance(omega, parameters.middleCompliance * 0.7),
    addComplex(
      impedanceInertance(omega, parameters.middleInertance * 0.4),
      complex(parameters.middleResistance * 0.45, 0),
    ),
  );
}

function Z_joint(frequency, parameters) {
  const omega = 2 * Math.PI * frequency;
  return addComplex(
    impedanceCompliance(omega, parameters.jointCompliance),
    complex(parameters.middleResistance * 0.35, 0),
  );
}

function Z_cochlea(frequency, parameters) {
  const omega = 2 * Math.PI * frequency;
  return addComplex(
    impedanceCompliance(omega, MIDDLE_CIRCUIT_CONSTANTS.cochlearCompliance),
    addComplex(
      impedanceInertance(
        omega,
        MIDDLE_CIRCUIT_CONSTANTS.cochlearInertance,
      ),
      complex(parameters.cochlearLoad, 0),
    ),
  );
}

function impedanceInertance(omega, inertance) {
  return complex(0, omega * inertance);
}

function impedanceCompliance(omega, compliance) {
  return complex(0, -1 / Math.max(omega * compliance, 1e-12));
}

function complex(real, imaginary) {
  return { real, imaginary };
}

function addComplex(first, second) {
  return complex(first.real + second.real, first.imaginary + second.imaginary);
}

function multiplyComplex(first, second) {
  return complex(
    first.real * second.real - first.imaginary * second.imaginary,
    first.real * second.imaginary + first.imaginary * second.real,
  );
}

function divideComplex(numerator, denominator) {
  const denominatorMagnitudeSquared =
    denominator.real ** 2 + denominator.imaginary ** 2;
  return complex(
    (numerator.real * denominator.real + numerator.imaginary * denominator.imaginary) /
      denominatorMagnitudeSquared,
    (numerator.imaginary * denominator.real - numerator.real * denominator.imaginary) /
      denominatorMagnitudeSquared,
  );
}

function scaleComplex(value, scalar) {
  return complex(value.real * scalar, value.imaginary * scalar);
}

function complexMagnitude(value) {
  return Math.sqrt(value.real ** 2 + value.imaginary ** 2);
}

function parallelImpedance(first, second) {
  return divideComplex(
    multiplyComplex(first, second),
    addComplex(first, second),
  );
}

function buildSweepSeries(parameters) {
  const key = dom.sweepParameter.value;
  const traceCount = Number(dom.sweepTraceCount.value);
  const definition = PARAMETER_LOOKUP[key];
  const series = [];

  for (let index = 0; index < traceCount; index += 1) {
    const ratio = traceCount === 1 ? 0 : index / (traceCount - 1);
    const sweptValue = interpolate(definition.min, definition.max, ratio);
    const sweptParameters = { ...parameters, [key]: sweptValue };
    const model = computeModel(sweptParameters);
    const hue = 190 + index * 18;

    series.push({
      label: `${definition.label}: ${formatParameterValue(key, sweptValue)}`,
      values: model.combinedTotalDb,
      color: `hsl(${hue} 58% ${index === traceCount - 1 ? "42%" : "52%"})`,
    });
  }

  return series;
}

function renderMarkerList(model) {
  const rows = [
    ["Reflector break", formatFrequency(model.metrics.reflector.breakHz)],
    ["Helmholtz resonance", formatFrequency(model.metrics.concha.helmholtzHz)],
    ["Canal mode n = 1", formatFrequency(model.metrics.canal.f1)],
    ["Canal antiresonance n = 2", formatFrequency(model.metrics.canal.f2)],
    ["Canal mode n = 3", formatFrequency(model.metrics.canal.f3)],
    ["Pinna notch", formatFrequency(model.metrics.reflection.notchHz)],
    [
      "Effective reflection path",
      `${model.metrics.reflection.effectivePathMm.toFixed(1)} mm`,
    ],
    [
      "Combined response peak",
      `${formatFrequency(model.metrics.combinedPeak.frequency)} @ ${formatDb(model.metrics.combinedPeak.value)}`,
    ],
    [
      "Middle-ear transmission peak",
      `${formatFrequency(model.metrics.middle.transmissionPeak.frequency)} @ ${formatDb(model.metrics.middle.transmissionPeak.value)}`,
    ],
    [
      "Input impedance peak",
      formatFrequency(model.metrics.middle.inputImpedancePeak.frequency),
    ],
  ];

  dom.markerList.innerHTML = rows
    .map(
      ([label, value]) => `
        <div class="marker-row">
          <strong>${label}</strong>
          <span>${value}</span>
        </div>
      `,
    )
    .join("");
}

function renderSummaryChip(model) {
  const peak = model.metrics.combinedPeak;
  const notch = model.metrics.reflection;
  dom.summaryChip.textContent =
    `Total peak ${formatFrequency(peak.frequency)} - middle-ear peak ${formatFrequency(model.metrics.middle.transmissionPeak.frequency)} - pinna notch ${formatFrequency(notch.notchHz)}`;
}

function exportReportSnippet() {
  const model = latestModel;
  const binaural = latestBinauralModel;
  if (!model) {
    return;
  }

  const parameters = model.parameters;
  const lines = [
    "# Outer + Middle Ear Binaural HRIR Model Summary",
    "",
    `Date: ${new Date().toISOString().slice(0, 10)}`,
    "",
    "## Current anatomical parameters",
    ...PARAMETER_DEFS.map(
      (definition) =>
        `- ${definition.label}: ${formatParameterValue(
          definition.key,
          parameters[definition.key],
        )}`,
    ),
    `- IEC 318 auxiliary branches: ${parameters.iec318Enabled ? "On" : "Off"}`,
    "",
    "## Calculated frequencies",
    `- Reflector break: ${formatFrequency(model.metrics.reflector.breakHz)}`,
    `- Concha Helmholtz resonance: ${formatFrequency(model.metrics.concha.helmholtzHz)}`,
    `- Ear-canal quarter-wave mode (n=1): ${formatFrequency(model.metrics.canal.f1)}`,
    `- Ear-canal antiresonance estimate (n=2): ${formatFrequency(model.metrics.canal.f2)}`,
    `- Ear-canal third mode (n=3): ${formatFrequency(model.metrics.canal.f3)}`,
    `- Pinna reflection notch: ${formatFrequency(model.metrics.reflection.notchHz)}`,
    `- Effective reflection path: ${model.metrics.reflection.effectivePathMm.toFixed(1)} mm`,
    `- Middle-ear transmission peak: ${formatFrequency(model.metrics.middle.transmissionPeak.frequency)} @ ${formatDb(model.metrics.middle.transmissionPeak.value)}`,
    `- Middle-ear input impedance peak: ${formatFrequency(model.metrics.middle.inputImpedancePeak.frequency)}`,
    "",
    "## Equations used",
    "- f_break = c / (16a)",
    "- f_H = c / 2pi * sqrt(A / (V L_eff))",
    "- f_n = n c / (4 L_eff)",
    "- f_notch = c / (2 r_eff)",
    "- Z_R = R",
    "- Z_L = j omega L",
    "- Z_C = 1 / (j omega C)",
    "- Z_cavity = (Z_CP + Z_LA + R_A) || R_M || Z_CT",
    "- Z_eardrum = Z_CD1 + (Z_LD || (Z_CD2 + R_D2)) + R_D1",
    "- Z_ossicles = Z_CO + Z_LO + R_O",
    "- Z_distal = Z_joint || Z_cochlea",
    "- Z_in = Z_cavity + (Z_eardrum || (Z_ossicles + Z_distal))",
    "- H_total = H_outer x H_middle",
    "- ITD = r / c * (theta + sin(theta)) using the horizontal-plane projected source azimuth",
    "- H_L,R(f) = H_reflector H_concha H_canal H_pinna H_shadow,L,R exp(-j 2 pi f tau_L,R)",
    "- h_L,R[n] = real(IFFT(H_L,R[k]))",
    "- y_L,R[n] = x[n] * h_L,R[n]",
    "",
    "## Current synthetic binaural result",
    ...(binaural ? [
      `- Source direction: ${formatParameterValue("azimuthDeg", parameters.azimuthDeg)}, ${formatParameterValue("elevationDeg", parameters.elevationDeg)}`,
      `- Head radius: ${formatParameterValue("headRadiusMm", parameters.headRadiusMm)}`,
      `- Complex HRTF / HRIR sample rate: ${binaural.sampleRate} Hz; IFFT length: ${binaural.fftSize}`,
      `- HRIR onset ITD (right minus left): ${formatSignedMilliseconds(binaural.metrics.hrirOnsetItdSeconds * 1000)} ms`,
      `- ILD at 1 kHz (right minus left): ${formatDb(binaural.metrics.ildAt1kDb)}`,
      `- ILD at 8 kHz (right minus left): ${formatDb(binaural.metrics.ildAt8kDb)}`,
      `- Left / right high-band notches: ${formatFrequency(binaural.metrics.leftNotch.frequency)} / ${formatFrequency(binaural.metrics.rightNotch.frequency)}`,
    ] : ["- Binaural model was not available when this summary was exported."]),
    "",
    "## Binaural interpretation",
    "- Lateral azimuth increases the magnitude of the HRIR onset offset; a source on the right makes the right-ear HRIR arrive first.",
    "- The contralateral head-shadow term is deliberately frequency dependent, so the high-frequency ILD is larger than the low-frequency ILD.",
    "- Elevation mainly changes the ear-specific concha peak and pinna-reflection path, moving high-frequency spectral structure while leaving the projected ITD small near the median plane.",
    "- This is an interpretable parametric model, not a measured HRTF: it omits torso/shoulder reflections, detailed pinna geometry, individual anatomy, full head diffraction, and dynamic head movements.",
    "",
    "## Middle-ear topology",
    "- The cavity block is a series block with parallel C_P-L_A-R_A, R_M, and C_T branches.",
    "- The eardrum-loss block is a shunt branch, followed by series C_O-L_O-R_O.",
    "- Joint and stapes/cochlear branches are parallel shunt loads at the distal node.",
    "- The cochlear branch is only a terminating load; inner-ear mechanics are not modeled.",
    "- The transfer uses an ideal-source divider across the cavity/proximal network and a distal-node divider into the cochlear-load branch.",
    "- Transmission is unit-normalized; no source resistance or arbitrary gain is included because neither appears in the class circuit.",
    "- The outer and middle models are cascaded without pressure-loading feedback from the middle ear into the outer-ear filters.",
    "",
    "## Brief discussion",
    "- Increasing ear-canal length lowers the quarter-wave resonances.",
    "- Increasing concha aperture or decreasing concha volume raises the Helmholtz resonance.",
    "- Larger effective reflection paths push the pinna notch downward in frequency.",
    "- The combined response is the product of the outer-ear response and middle-ear transmission, so middle-ear mass/compliance/loss changes reshape the total response.",
    "",
    "## Parameter provenance",
    "- Canal length, concha dimensions, and cavity volume are physically interpretable anatomical parameters, but the baseline values are assumed population-representative values.",
    "- Middle-ear inertance, compliance, resistance, and cochlear load are normalized model parameters; they are assumed/fitted placeholders rather than patient measurements.",
    "",
    "## Model limitations",
    "- The middle-ear circuit follows the class topology, but its normalized component values are not patient-specific measurements.",
    "- The cascade assumes no loading feedback between the middle-ear input impedance and outer-ear transfer function.",
    "- The binaural renderer is not subject-specific and does not represent detailed three-dimensional pinna geometry, torso/shoulder reflections, full head diffraction, or measured individual HRTFs.",
    "",
    "## Copilot note",
    "- This interactive model and the summary text were built with GPT-5.6 in Codex as a coding copilot. I rejected the earlier cavity-shunt/all-series interpretation after checking the class diagram node by node, then reran the model with the corrected topology.",
    "- For the binaural extension, I rejected the initial idea of a fixed left/right gain offset because it would not produce the required increase in ILD with frequency. The implemented head-shadow term is instead frequency dependent and is checked directly in the ILD plot.",
    "",
  ];

  const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "outer-ear-binaural-hrir-summary.md";
  link.click();
  URL.revokeObjectURL(url);
}

function renderPlot(svg, series, options = {}) {
  const [width, height] = svg
    .getAttribute("viewBox")
    .split(" ")
    .slice(2)
    .map(Number);
  const padding = { top: 16, right: 18, bottom: 34, left: 54 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const yRange = options.yRange || DB_RANGE;

  svg.innerHTML = "";

  const background = createSvgElement("rect", {
    x: 0,
    y: 0,
    width,
    height,
    rx: 16,
    fill: "transparent",
  });
  svg.appendChild(background);

  const yTicks = options.yTicks || [24, 18, 12, 6, 0, -6, -12, -18];
  yTicks.forEach((tick) => {
    const y = padding.top + innerHeight * (1 - (tick - yRange.min) / (yRange.max - yRange.min));
    svg.appendChild(
      createSvgElement("line", {
        x1: padding.left,
        y1: y,
        x2: width - padding.right,
        y2: y,
        stroke: "var(--plot-grid)",
        "stroke-width": 1,
      }),
    );
    const label = createSvgElement("text", {
      x: padding.left - 10,
      y: y + 4,
      "text-anchor": "end",
      class: "tick-label",
    });
    label.textContent = `${tick}`;
    svg.appendChild(label);
  });

  const frequencyTicks = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
  frequencyTicks.forEach((tick) => {
    const x = padding.left + innerWidth * normalizeLogFrequency(tick);
    svg.appendChild(
      createSvgElement("line", {
        x1: x,
        y1: padding.top,
        x2: x,
        y2: height - padding.bottom,
        stroke: "var(--plot-grid)",
        "stroke-width": 1,
      }),
    );
    const label = createSvgElement("text", {
      x,
      y: height - 12,
      "text-anchor": "middle",
      class: "tick-label",
    });
    label.textContent = formatFrequencyTick(tick);
    svg.appendChild(label);
  });

  svg.appendChild(
    createSvgElement("rect", {
      x: padding.left,
      y: padding.top,
      width: innerWidth,
      height: innerHeight,
      fill: "none",
      stroke: "rgba(45, 32, 22, 0.18)",
      "stroke-width": 1.2,
      rx: 12,
    }),
  );

  if (options.markers) {
    options.markers.forEach((marker, index) => {
      const x = padding.left + innerWidth * normalizeLogFrequency(marker.frequency);
      svg.appendChild(
        createSvgElement("line", {
          x1: x,
          y1: padding.top,
          x2: x,
          y2: height - padding.bottom,
          stroke: index % 2 === 0 ? "rgba(42, 127, 122, 0.45)" : "rgba(213, 103, 63, 0.45)",
          "stroke-width": 1.2,
          "stroke-dasharray": "4 4",
        }),
      );
      const label = createSvgElement("text", {
        x,
        y: padding.top + 12 + index * 12,
        "text-anchor": "middle",
        class: "marker-label",
      });
      label.textContent = marker.label;
      svg.appendChild(label);
    });
  }

  series.forEach((entry) => {
    const pathData = entry.values
      .map((value, index) => {
        const x = padding.left + innerWidth * normalizeLogFrequency(FREQUENCIES[index]);
        const y =
          padding.top +
          innerHeight * (1 - (value - yRange.min) / (yRange.max - yRange.min));
        return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${clamp(y, padding.top, height - padding.bottom).toFixed(2)}`;
      })
      .join(" ");

    svg.appendChild(
      createSvgElement("path", {
        d: pathData,
        fill: "none",
        stroke: entry.color,
        "stroke-width": entry.label === "Combined" ? 3.4 : 2.4,
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        opacity: options.showLegend ? 0.9 : 1,
      }),
    );
  });

  const xLabel = createSvgElement("text", {
    x: padding.left + innerWidth / 2,
    y: height - 4,
    "text-anchor": "middle",
    class: "axis-label",
  });
  xLabel.textContent = "Frequency (Hz)";
  svg.appendChild(xLabel);

  const yLabel = createSvgElement("text", {
    x: 16,
    y: padding.top + innerHeight / 2,
    transform: `rotate(-90 16 ${padding.top + innerHeight / 2})`,
    "text-anchor": "middle",
    class: "axis-label",
  });
  yLabel.textContent = options.yLabel || "Magnitude (dB)";
  svg.appendChild(yLabel);

  if (options.showLegend) {
    const legendGroup = createSvgElement("g", {});
    series.forEach((entry, index) => {
      const x = padding.left + 10;
      const y = padding.top + 14 + index * 14;
      legendGroup.appendChild(
        createSvgElement("line", {
          x1: x,
          y1: y,
          x2: x + 18,
          y2: y,
          stroke: entry.color,
          "stroke-width": 3,
          "stroke-linecap": "round",
        }),
      );
      const label = createSvgElement("text", {
        x: x + 24,
        y: y + 4,
        class: "legend-label",
      });
      label.textContent = entry.label;
      legendGroup.appendChild(label);
    });
    svg.appendChild(legendGroup);
  }
}

function renderTimePlot(svg, series, sampleRate, options = {}) {
  const [width, height] = svg
    .getAttribute("viewBox")
    .split(" ")
    .slice(2)
    .map(Number);
  const padding = { top: 16, right: 18, bottom: 34, left: 54 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const sampleCount = Math.min(
    series[0].values.length,
    Math.max(2, Math.round((options.durationSeconds || 0.012) * sampleRate)),
  );
  const peak = Math.max(
    ...series.flatMap((entry) => entry.values.slice(0, sampleCount).map((value) => Math.abs(value))),
    1e-4,
  );
  const yLimit = peak * 1.12;
  svg.innerHTML = "";

  [-yLimit, 0, yLimit].forEach((tick) => {
    const y = padding.top + innerHeight * (1 - (tick + yLimit) / (2 * yLimit));
    svg.appendChild(createSvgElement("line", {
      x1: padding.left,
      y1: y,
      x2: width - padding.right,
      y2: y,
      stroke: "var(--plot-grid)",
      "stroke-width": tick === 0 ? 1.25 : 1,
    }));
    const label = createSvgElement("text", {
      x: padding.left - 10,
      y: y + 4,
      "text-anchor": "end",
      class: "tick-label",
    });
    label.textContent = tick === 0 ? "0" : tick.toFixed(2);
    svg.appendChild(label);
  });

  const durationMs = (sampleCount / sampleRate) * 1000;
  [0, 0.25, 0.5, 0.75, 1].forEach((ratio) => {
    const x = padding.left + innerWidth * ratio;
    svg.appendChild(createSvgElement("line", {
      x1: x,
      y1: padding.top,
      x2: x,
      y2: height - padding.bottom,
      stroke: "var(--plot-grid)",
      "stroke-width": 1,
    }));
    const label = createSvgElement("text", {
      x,
      y: height - 12,
      "text-anchor": "middle",
      class: "tick-label",
    });
    label.textContent = `${(durationMs * ratio).toFixed(0)}`;
    svg.appendChild(label);
  });

  svg.appendChild(createSvgElement("rect", {
    x: padding.left,
    y: padding.top,
    width: innerWidth,
    height: innerHeight,
    fill: "none",
    stroke: "rgba(45, 32, 22, 0.18)",
    "stroke-width": 1.2,
    rx: 12,
  }));

  series.forEach((entry) => {
    const path = entry.values.slice(0, sampleCount).map((value, index) => {
      const x = padding.left + innerWidth * (index / (sampleCount - 1));
      const y = padding.top + innerHeight * (1 - (value + yLimit) / (2 * yLimit));
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${clamp(y, padding.top, height - padding.bottom).toFixed(2)}`;
    }).join(" ");
    svg.appendChild(createSvgElement("path", {
      d: path,
      fill: "none",
      stroke: entry.color,
      "stroke-width": 2.15,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    }));
  });

  const xLabel = createSvgElement("text", {
    x: padding.left + innerWidth / 2,
    y: height - 4,
    "text-anchor": "middle",
    class: "axis-label",
  });
  xLabel.textContent = "Time (ms)";
  svg.appendChild(xLabel);

  if (options.showLegend) {
    series.forEach((entry, index) => {
      const y = padding.top + 14 + index * 14;
      svg.appendChild(createSvgElement("line", {
        x1: padding.left + 10,
        y1: y,
        x2: padding.left + 28,
        y2: y,
        stroke: entry.color,
        "stroke-width": 3,
        "stroke-linecap": "round",
      }));
      const label = createSvgElement("text", {
        x: padding.left + 34,
        y: y + 4,
        class: "legend-label",
      });
      label.textContent = entry.label;
      svg.appendChild(label);
    });
  }
}

function playNoisePreview() {
  const context = ensureAudioContext();
  stopAudio();
  const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = Math.random() * 2 - 1;
  }

  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  connectModelledAudio(source, readParameters());
  source.start();
  audioState.source = source;
  setAudioStatus("Playing looped noise through the current left/right HRIR pair.");
}

function playToneSweepPreview() {
  const context = ensureAudioContext();
  stopAudio();
  const oscillator = new OscillatorNode(context, { type: "sine", frequency: 180 });
  oscillator.frequency.exponentialRampToValueAtTime(16000, context.currentTime + 5);
  connectModelledAudio(oscillator, readParameters());
  oscillator.start();
  oscillator.stop(context.currentTime + 5);
  oscillator.addEventListener("ended", () => {
    cleanupAudioGraph();
    setAudioStatus("Sweep finished.");
  });
  audioState.source = oscillator;
  setAudioStatus("Playing a logarithmic sweep through the current left/right HRIR pair.");
}

async function handleAudioUpload(event) {
  const file = event.target.files?.[0];
  if (!file) {
    audioState.uploadedBuffer = null;
    dom.playFileButton.disabled = true;
    setAudioStatus("Audio upload cleared.");
    return;
  }

  try {
    const context = ensureAudioContext();
    const arrayBuffer = await file.arrayBuffer();
    audioState.uploadedBuffer = await context.decodeAudioData(arrayBuffer.slice(0));
    dom.playFileButton.disabled = false;
    setAudioStatus(`Loaded "${file.name}". Ready to preview.`);
  } catch (error) {
    audioState.uploadedBuffer = null;
    dom.playFileButton.disabled = true;
    setAudioStatus("Could not decode that audio file.");
  }
}

function playUploadedAudio() {
  if (!audioState.uploadedBuffer) {
    return;
  }

  const context = ensureAudioContext();
  stopAudio();
  const source = context.createBufferSource();
  source.buffer = audioState.uploadedBuffer;
  connectModelledAudio(source, readParameters());
  source.start();
  source.addEventListener("ended", () => {
    cleanupAudioGraph();
    setAudioStatus("Uploaded audio finished.");
  });
  audioState.source = source;
  setAudioStatus("Playing the uploaded audio through the current left/right HRIR pair.");
}

function connectModelledAudio(sourceNode, parameters) {
  const context = ensureAudioContext();
  const graph = buildBinauralConvolutionGraph(context, sourceNode, parameters);
  audioState.sourceNodes = [sourceNode];
  audioState.activeNodes = graph.nodes;
}

function buildBinauralConvolutionGraph(context, sourceNode, parameters, destination = context.destination) {
  const model = computeBinauralModel(parameters, context.sampleRate);
  const peak = Math.max(
    ...model.hrirLeft.map(Math.abs),
    ...model.hrirRight.map(Math.abs),
    1e-4,
  );
  const impulseGain = Math.min(0.8, 0.8 / peak);
  const leftImpulse = createHrirAudioBuffer(context, model.hrirLeft, impulseGain);
  const rightImpulse = createHrirAudioBuffer(context, model.hrirRight, impulseGain);
  const monoInput = context.createGain();
  monoInput.channelCount = 1;
  monoInput.channelCountMode = "explicit";
  const leftConvolver = context.createConvolver();
  const rightConvolver = context.createConvolver();
  leftConvolver.normalize = false;
  rightConvolver.normalize = false;
  leftConvolver.buffer = leftImpulse;
  rightConvolver.buffer = rightImpulse;
  const leftGain = context.createGain();
  const rightGain = context.createGain();
  const merger = context.createChannelMerger(2);
  const masterGain = context.createGain();
  masterGain.gain.value = 0.56;

  sourceNode.connect(monoInput);
  monoInput.connect(leftConvolver);
  monoInput.connect(rightConvolver);
  leftConvolver.connect(leftGain);
  rightConvolver.connect(rightGain);
  leftGain.connect(merger, 0, 0);
  rightGain.connect(merger, 0, 1);
  merger.connect(masterGain);
  masterGain.connect(destination);
  return {
    nodes: [
      monoInput,
      leftConvolver,
      rightConvolver,
      leftGain,
      rightGain,
      merger,
      masterGain,
    ],
  };
}

function createHrirAudioBuffer(context, hrir, gain = 1) {
  const buffer = context.createBuffer(1, hrir.length, context.sampleRate);
  const samples = buffer.getChannelData(0);
  hrir.forEach((value, index) => {
    samples[index] = value * gain;
  });
  return buffer;
}

async function downloadBinauralExample() {
  const OfflineContext = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!OfflineContext) {
    setAudioStatus("Offline rendering is unavailable in this browser.");
    return;
  }

  dom.downloadBinauralButton.disabled = true;
  setAudioStatus("Rendering a 1.5 second stereo HRIR-convolved noise example...");
  try {
    const sampleRate = BINAURAL_SAMPLE_RATE;
    const sourceFrames = Math.round(sampleRate * 1.5);
    const outputFrames = sourceFrames + BINAURAL_FFT_SIZE;
    const context = new OfflineContext(2, outputFrames, sampleRate);
    const input = context.createBuffer(1, sourceFrames, sampleRate);
    const samples = input.getChannelData(0);
    for (let index = 0; index < sourceFrames; index += 1) {
      const edge = Math.min(1, index / 480, (sourceFrames - index) / 480);
      samples[index] = (Math.random() * 2 - 1) * 0.12 * edge;
    }
    const source = context.createBufferSource();
    source.buffer = input;
    buildBinauralConvolutionGraph(context, source, readParameters(), context.destination);
    source.start();
    const rendered = await context.startRendering();
    const blob = new Blob([audioBufferToStereoWav(rendered)], { type: "audio/wav" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "synthetic-binaural-hrir-render.wav";
    link.click();
    URL.revokeObjectURL(url);
    setAudioStatus("Downloaded a 1.5 second stereo HRIR-convolved noise render.");
  } catch (error) {
    setAudioStatus("Could not render the binaural WAV example.");
  } finally {
    dom.downloadBinauralButton.disabled = false;
  }
}

function audioBufferToStereoWav(audioBuffer) {
  const channelCount = 2;
  const bytesPerSample = 2;
  const dataSize = audioBuffer.length * channelCount * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeText = (offset, text) => {
    [...text].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)));
  };
  writeText(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, audioBuffer.sampleRate, true);
  view.setUint32(28, audioBuffer.sampleRate * channelCount * bytesPerSample, true);
  view.setUint16(32, channelCount * bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, dataSize, true);

  const left = audioBuffer.getChannelData(0);
  const right = audioBuffer.getChannelData(Math.min(1, audioBuffer.numberOfChannels - 1));
  let offset = 44;
  for (let index = 0; index < audioBuffer.length; index += 1) {
    [left[index], right[index]].forEach((sample) => {
      view.setInt16(offset, Math.round(clamp(sample, -1, 1) * 32767), true);
      offset += 2;
    });
  }
  return buffer;
}

function stopAudio() {
  if (audioState.source) {
    try {
      audioState.source.stop();
    } catch (error) {
      // Source may already be stopped.
    }
  }
  cleanupAudioGraph();
  setAudioStatus("Audio idle.");
}

function cleanupAudioGraph() {
  if (audioState.source) {
    try {
      audioState.source.disconnect();
    } catch (error) {
      // Ignore disconnect errors during cleanup.
    }
  }
  audioState.activeNodes.forEach((node) => {
    try {
      node.disconnect();
    } catch (error) {
      // Ignore disconnect errors during cleanup.
    }
  });
  audioState.source = null;
  audioState.sourceNodes = [];
  audioState.activeNodes = [];
}

function ensureAudioContext() {
  if (!audioState.context) {
    audioState.context = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioState.context.state === "suspended") {
    audioState.context.resume();
  }
  return audioState.context;
}

function setAudioStatus(message) {
  dom.audioStatus.textContent = message;
}

function makePeakingFilter(frequency, q, gainDb) {
  const omega = (2 * Math.PI * frequency) / ANALYSIS_SAMPLE_RATE;
  const alpha = Math.sin(omega) / (2 * q);
  const amplitude = Math.pow(10, gainDb / 40);
  const cosine = Math.cos(omega);

  const b0 = 1 + alpha * amplitude;
  const b1 = -2 * cosine;
  const b2 = 1 - alpha * amplitude;
  const a0 = 1 + alpha / amplitude;
  const a1 = -2 * cosine;
  const a2 = 1 - alpha / amplitude;

  return normalizeBiquad({ b0, b1, b2, a0, a1, a2 });
}

function makeNotchFilter(frequency, q, depthDb) {
  const omega = (2 * Math.PI * frequency) / ANALYSIS_SAMPLE_RATE;
  const alpha = Math.sin(omega) / (2 * q);
  const cosine = Math.cos(omega);
  const notch = normalizeBiquad({
    b0: 1,
    b1: -2 * cosine,
    b2: 1,
    a0: 1 + alpha,
    a1: -2 * cosine,
    a2: 1 - alpha,
  });

  notch.mix = clamp(depthDb / 12, 0.2, 0.85);
  return notch;
}

function normalizeBiquad(coefficients) {
  return {
    b0: coefficients.b0 / coefficients.a0,
    b1: coefficients.b1 / coefficients.a0,
    b2: coefficients.b2 / coefficients.a0,
    a1: coefficients.a1 / coefficients.a0,
    a2: coefficients.a2 / coefficients.a0,
    mix: coefficients.mix ?? 1,
  };
}

function biquadMagnitudeAtFrequency(filter, frequency) {
  const omega = (2 * Math.PI * frequency) / ANALYSIS_SAMPLE_RATE;
  const cos1 = Math.cos(omega);
  const sin1 = Math.sin(omega);
  const cos2 = Math.cos(2 * omega);
  const sin2 = Math.sin(2 * omega);

  const numeratorReal = filter.b0 + filter.b1 * cos1 + filter.b2 * cos2;
  const numeratorImaginary = -filter.b1 * sin1 - filter.b2 * sin2;
  const denominatorReal = 1 + filter.a1 * cos1 + filter.a2 * cos2;
  const denominatorImaginary = -filter.a1 * sin1 - filter.a2 * sin2;

  const numeratorMagnitude = Math.sqrt(
    numeratorReal ** 2 + numeratorImaginary ** 2,
  );
  const denominatorMagnitude = Math.sqrt(
    denominatorReal ** 2 + denominatorImaginary ** 2,
  );
  const rawMagnitude = numeratorMagnitude / denominatorMagnitude;

  if (filter.mix === 1) {
    return rawMagnitude;
  }

  return (1 - filter.mix) + filter.mix * rawMagnitude;
}

function findExtremum(frequencies, values, mode) {
  let bestIndex = 0;
  let bestValue = values[0];

  values.forEach((value, index) => {
    if ((mode === "max" && value > bestValue) || (mode === "min" && value < bestValue)) {
      bestIndex = index;
      bestValue = value;
    }
  });

  return { frequency: frequencies[bestIndex], value: bestValue };
}

function formatParameterValue(key, value) {
  switch (key) {
    case "conchaVolumeCc":
    case "middleCavityVolumeCc":
      return `${value.toFixed(1)} cc`;
    case "reflectionStrength":
      return value.toFixed(2);
    case "azimuthDeg":
    case "elevationDeg":
      return `${value.toFixed(0)} deg`;
    case "middleInertance":
    case "middleCompliance":
    case "jointCompliance":
      return `${value.toFixed(6)} m.u.`;
    case "middleResistance":
    case "cochlearLoad":
      return `${value.toFixed(2)} m.u.`;
    default:
      return `${value.toFixed(1)} mm`;
  }
}

function formatFrequency(frequency) {
  if (frequency >= 1000) {
    const precision = frequency < 10000 ? 2 : 1;
    return `${(frequency / 1000).toFixed(precision)} kHz`;
  }
  return `${frequency.toFixed(0)} Hz`;
}

function formatFrequencyTick(frequency) {
  if (frequency >= 1000) {
    return `${frequency / 1000}k`;
  }
  return `${frequency}`;
}

function formatDb(value) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)} dB`;
}

function formatSignedHz(value) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(0)} Hz`;
}

function formatSignedMilliseconds(value) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
}

function formatSignedDegrees(value) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(0)}°`;
}

function logSpace(minimum, maximum, count) {
  const output = [];
  const start = Math.log10(minimum);
  const end = Math.log10(maximum);

  for (let index = 0; index < count; index += 1) {
    const ratio = index / (count - 1);
    output.push(10 ** interpolate(start, end, ratio));
  }

  return output;
}

function normalizeLogFrequency(frequency) {
  return (
    (Math.log10(frequency) - Math.log10(FREQUENCIES[0])) /
    (Math.log10(FREQUENCIES[FREQUENCIES.length - 1]) - Math.log10(FREQUENCIES[0]))
  );
}

function createSvgElement(tagName, attributes) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tagName);
  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
  return element;
}

function getInput(key) {
  return document.querySelector(`[data-param="${key}"]`);
}

function dbToMagnitude(value) {
  return 10 ** (value / 20);
}

function magnitudeToDb(value) {
  return 20 * Math.log10(Math.max(value, 1e-6));
}

function millimetersToMeters(value) {
  return value / 1000;
}

function cubicCentimetersToCubicMeters(value) {
  return value * 1e-6;
}

function degreesToRadians(value) {
  return (value * Math.PI) / 180;
}

function interpolate(start, end, ratio) {
  return start + (end - start) * ratio;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}
