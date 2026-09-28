# Outer + Middle Ear Binaural Acoustics Lab

This is a browser-based interactive model of the outer and middle ear, extended with a synthetic binaural HRIR renderer. It follows the signal path from the pinna/concha to the cochlear load and, separately, from direction-dependent outer-ear filtering to a stereo render:

`pinna/concha -> ear canal -> eardrum -> ossicles -> cochlear load`

`anatomy + source direction -> complex left/right HRTF -> left/right HRIR -> binaural audio`

- `Concha reflector`: parabolic-reflector approximation with a break near `f_break = c / (16a)`
- `Concha cavity`: Helmholtz resonance from concha volume, aperture radius, and effective depth
- `Ear canal`: quarter-wave resonances at `f_n = n c / (4 L_eff)` plus optional simplified IEC 318 branches
- `Pinna reflection`: direction-dependent interference from a delayed reflected path with notch estimate `f_notch = c / (2 r_eff)`
- `Binaural head model`: a spherical-head (Woodworth-style) ITD approximation, frequency-dependent contralateral head shadow, and ear-specific pinna/concha path changes
- `Synthetic HRTFs`: complex-valued left/right spectra with magnitude and phase; a conjugate-symmetric inverse FFT produces real left/right HRIRs
- `Stereo renderer`: separate left/right HRIR convolution for generated noise, sweeps, uploaded audio, and a downloadable 1.5-second WAV example
- `Middle-ear cavities`: a series block with parallel branches `C_P-L_A-R_A`, `R_M`, and `C_T`
- `Eardrum losses`: a frequency-dependent shunt branch containing `C_D1`, `L_D`, `C_D2`, `R_D2`, and `R_D1`
- `Eardrum, malleus, incus`: series `C_O-L_O-R_O` block
- `Incudo-stapedial joint`: shunt `C_S-R_S` branch
- `Stapes + cochlear load`: shunt `C_C-L_C-R_C` terminating branch

## Files

- [index.html](/Users/ethanmacaiah/Documents/New%20project/outer-ear-lab/index.html)
- [styles.css](/Users/ethanmacaiah/Documents/New%20project/outer-ear-lab/styles.css)
- [app.js](/Users/ethanmacaiah/Documents/New%20project/outer-ear-lab/app.js)
- [submission_template.md](/Users/ethanmacaiah/Documents/New%20project/outer-ear-lab/submission_template.md)

## How to run

Open [index.html](/Users/ethanmacaiah/Documents/New%20project/outer-ear-lab/index.html) directly in a browser, or serve the folder locally:

```bash
cd "/Users/ethanmacaiah/Documents/New project/outer-ear-lab"
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## What the app provides

- Individual frequency-response plots for reflector, concha, canal, and pinna reflection
- Outer-ear, middle-ear, and cascaded combined response plots
- Middle-ear transmission phase and input-impedance magnitude
- Resonance and notch readouts
- Real-time parameter sweep plot across a selected anatomical parameter
- Optional audio preview using a lightweight Web Audio approximation
- Complex left/right HRTF-magnitude, HRIR, and ILD plots for the active direction
- A live source-to-head-to-IR cue map that shows source motion, the shadowed ear, and the two first-arrival positions alongside short HRIR traces
- Presets for the required median-plane, strongly lateral, and elevated source cases, plus a three-direction cue summary
- Downloadable 1.5-second binaural noise render and report-ready Markdown summary
- A downloadable Markdown summary snippet to drop into the write-up PDF

## Modeling notes

- The reflector follows the lecture-note idea of `0 dB` below the break and approximately `+6 dB/octave` above it, capped to keep the model physically reasonable.
- The Helmholtz resonance uses `L_eff = depth + 1.7r` for a simple end-correction term.
- Ear-canal diameter mainly changes damping and resonance strength in this simplified model; canal length controls the quarter-wave frequencies.
- The pinna reflection block uses a direct-plus-delayed-path interference model so source direction changes the path length and therefore moves the high-frequency notch.
- The audio preview is intentionally approximate. The plotted math is the main analysis result; the audio is there so you can hear the trend.

## Synthetic binaural model

The binaural renderer is deliberately simple and interpretable. Positive azimuth is to the listener's right. A projected Woodworth-style spherical-head relation supplies the signed ITD; a 3 ms common reference delay keeps both synthetic HRIRs causal in the FFT frame. The contralateral ear gets a smooth attenuation that rises with frequency, so a lateral source creates a larger high-frequency ILD. The concha peak and pinna-reflection path vary independently at the two ears with azimuth and elevation; this changes high-frequency peaks/notches even when the ITD stays small.

For each ear, the model is assembled as:

`H_ear(f) = H_reflector × H_concha,ear × H_canal × H_pinna,ear × H_shadow,ear × exp(-j 2πfτ_ear)`

The renderer evaluates this complex response on 2048 FFT bins at 48 kHz, completes the spectrum by conjugate symmetry, and computes `h_ear = real(IFFT(H_ear))`. Audio is then rendered independently as `y_left = x * h_left` and `y_right = x * h_right`.

The three preset buttons expose the required validation cases:

- `0°, 0°`: little ITD/ILD, so the spectral terms are the primary directional cue.
- `+75°, 0°`: the right ear arrives earlier and the right-minus-left ILD grows at high frequency.
- `0°, +45°`: horizontal ITD/ILD remains small while the pinna/concha spectral structure shifts.

This is not a measured or individualized HRTF. It omits detailed pinna geometry, torso and shoulder reflections, full diffraction, dynamic head motion, and personal anatomy.

## Middle-ear topology and assumptions

The implementation follows the class circuit shown in the assignment screenshot:

- `Z_cavity = (Z_CP + Z_LA + R_A) || R_M || Z_CT`
- `Z_eardrum = Z_CD1 + (Z_LD || (Z_CD2 + R_D2)) + R_D1`
- `Z_ossicles = Z_CO + Z_LO + R_O`
- `Z_distal = Z_joint || Z_cochlea`
- `Z_in = Z_cavity + (Z_eardrum || (Z_ossicles + Z_distal))`
- The transfer is calculated with an ideal-source divider across the cavity/proximal network and a distal-node divider into the cochlear-load branch.
- The total model is cascaded as `H_total = H_outer * H_middle`, without pressure-loading feedback from the middle-ear input impedance into the outer-ear filters.

I verified the topology node by node against the class diagram: components drawn on the main horizontal path were added in series, and components connected vertically to the lower reference line were treated as shunt branches. The earlier cavity-shunt/series-path interpretation was rejected and replaced with the equations above.

The cochlear branch is only a terminating load in the middle-ear model; the inner ear itself is not modeled.
The transmission magnitude is unit-normalized. No source resistance or arbitrary gain is included because neither appears in the class circuit.

The middle-ear element values are normalized model units rather than patient-specific measurements. They are intended to demonstrate parameter sensitivity and frequency-response behavior, not to make a clinical prediction.

## Suggested submission workflow

1. Compare the code node by node with the supplied class circuit and keep the topology correction in the copilot note.
2. Set a baseline and capture screenshots of the outer, middle, combined, phase, input-impedance, and sweep plots.
3. Use the three direction presets to capture the HRTF, HRIR, and ILD plot set for each required source direction.
4. Download the short stereo render from the Binaural Audio Preview card and the summary snippet from the app for the write-up.
5. Use [submission_template.md](/Users/ethanmacaiah/Documents/New%20project/outer-ear-lab/submission_template.md) as the skeleton for the PDF discussion and copilot note.
