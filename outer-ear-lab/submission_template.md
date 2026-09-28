# Outer + Middle Ear Binaural HRIR Write-Up Template

## Title

Interactive Physics-Based Outer-Ear Binaural HRIR Model

## Objective

Extend the outer-ear model into an interpretable binaural renderer: anatomy + source direction -> left/right complex HRTF -> left/right HRIR -> binaural audio. The existing middle-ear path remains available as a separate model view; the HRIR renderer uses the direction-dependent outer-ear, head, and ear-canal stages.

## Governing equations

- Concha reflector break frequency:
  `f_break = c / (16a)`
- Concha cavity Helmholtz resonance:
  `f_H = c / 2pi * sqrt(A / (V L_eff))`
- Ear-canal quarter-wave resonances:
  `f_n = n c / (4 L_eff)`
- Pinna reflection notch estimate:
  `f_notch = c / (2 r_eff)`
- Resistor:
  `Z_R = R`
- Inertance:
  `Z_L = j omega L`
- Compliance:
  `Z_C = 1 / (j omega C)`
- Angular frequency:
  `omega = 2 pi f`
- Cascaded model:
  `H_total = H_outer * H_middle`
- Projected spherical-head ITD approximation:
  `ITD = r / c * (theta + sin(theta))`
- Ear-specific complex HRTF:
  `H_ear(f) = H_reflector H_concha,ear H_canal H_pinna,ear H_shadow,ear exp(-j 2 pi f tau_ear)`
- HRIR conversion:
  `h_ear[n] = real(IFFT(H_ear[k]))`
- Binaural rendering:
  `y_left = x * h_left`, `y_right = x * h_right`

The middle-ear model ends at a lumped cochlear-load branch. It does not simulate inner-ear mechanics or cochlear transduction.

The positive azimuth convention is listener right. A shared 3 ms reference delay makes both modeled HRIRs causal inside the FFT frame. The displayed ITD is reported as right minus left, so a negative value means the right ear leads.

## Middle-ear circuit interpretation

The browser model follows the supplied class circuit:

- `Z_cavity = (Z_CP + Z_LA + R_A) || R_M || Z_CT`
- `Z_eardrum = Z_CD1 + (Z_LD || (Z_CD2 + R_D2)) + R_D1`
- `Z_ossicles = Z_CO + Z_LO + R_O`
- `Z_distal = Z_joint || Z_cochlea`
- `Z_in = Z_cavity + (Z_eardrum || (Z_ossicles + Z_distal))`
- `H_middle` uses an ideal-source divider across the cavity/proximal network and a divider into the distal cochlear-load branch.

I verified the topology node by node against the class drawing. Components on the horizontal signal path were treated as series elements; components drawn vertically to the lower reference line were treated as shunt branches. This rejected the earlier AI suggestion that the cavity should be a shunt branch across one all-series path, so `computeMiddleEarResponse` and the impedance functions were corrected before rerunning the model. I also removed an unshown source resistance and arbitrary display gain, using an ideal input source and unit-normalized transmission instead.

## Baseline parameter set and binaural configuration

Paste the downloaded summary snippet from the app here.

## Figures

Insert screenshots for:

- Outer-ear response alone
- Middle-ear transmission magnitude
- Middle-ear transmission phase
- Middle-ear input impedance
- Combined outer + middle response
- Individual outer-ear component responses
- Parameter sweep
- For the median-plane case (0°, 0°): left/right HRTF magnitude, left/right HRIR, and ILD-versus-frequency
- For the lateral case (+75°, 0°): the same HRTF, HRIR, and ILD plots, with the estimated HRIR ITD visible
- For the elevated case (0°, +45°): the same HRTF, HRIR, and ILD plots, showing shifted spectral structure

## Binaural validation and interpretation

For each required direction, report the displayed HRIR-onset ITD and the right-minus-left ILD at 1 kHz and 8 kHz.

| Direction | ITD result | ILD result | Spectral-cue result | Interpretation |
| --- | --- | --- | --- | --- |
| Median plane (0°, 0°) | Paste app value. | Near zero. | Compare the left/right notches. | Localization depends mainly on monaural spectral cues. |
| Right lateral (+75°, 0°) | Right HRIR should arrive first. | Right-minus-left ILD should be larger at 8 kHz than at 1 kHz. | Ear-specific notches split. | ITD and head shadow jointly signal the lateral source. |
| Elevated (0°, +45°) | Near zero projected ITD. | Near zero left/right ILD. | Pinna/concha peaks and notches move relative to 0°, 0°. | Elevation is represented primarily as a spectral cue. |

Compare this qualitative behavior with the spatial-hearing notes. The model should reproduce the cue trends, not a measured individual's detailed HRTF.

## Brief discussion

Discuss:

- Which anatomical features moved the strongest resonances
- How source azimuth and elevation shifted the notch structure
- Whether the combined response resembles the expected outer-ear boost around a few kilohertz
- How the middle-ear parameters reshape transmission and phase
- Limits of the simplified model versus a full HRTF, IEC 318, or measured middle-ear model
- Whether ITD changes in the correct direction and grows with lateral azimuth
- Whether the ILD becomes stronger with frequency for a lateral source
- How the elevated case moves peaks/notches without adding much horizontal ITD

## Parameter provenance

For at least three parameters, identify the source category:

- Physically derived: equations such as `f = 1 / (2 pi sqrt(LC))` and the outer-ear geometry relationships.
- Experimentally measured or fitted: use this category only if you have a cited value from class, a paper, or a calibration dataset.
- Assumed: baseline anatomical values and normalized middle-ear values in this browser model unless independently sourced.

Do not describe a parameter as measured or anatomical unless you can cite where the value came from.

## Model limitations

1. The middle-ear circuit follows the class topology, but its normalized component values are not patient-specific measurements.
2. The cascade assumes no loading feedback from the middle-ear input impedance into the outer-ear response.
3. The binaural HRTF is parametric rather than measured: it omits detailed pinna geometry, torso/shoulder reflections, full diffraction, dynamic head motion, individual anatomy, and measured calibration.

## Copilot note

This simulation was created with GPT-5.6 in Codex as a coding copilot. The copilot helped translate the lecture-note equations into a browser-based interactive model, add the complex HRTF/HRIR renderer, plot the component and binaural transfer functions, and generate the parameter experiments. Before submission, I verified the circuit topology against the supplied class diagram and corrected or rejected any AI suggestion that did not match it. For the binaural extension, I specifically rejected the initial fixed left/right gain-offset idea because it could not produce the required increase in high-frequency ILD; the implemented contralateral head-shadow term instead changes smoothly with frequency and is checked in the ILD plot.
