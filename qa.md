# Manual QA Checklist: ChronosLayer

This document outlines the validation plan and manual testing protocols for the **ChronosLayer Clinic OS v1.0** interface. It covers end-to-end verification of Patient Case File 7341, statistical visualization layers, the Bayesian Trajectory models, and interactive AI Clinical Assistant modules.

---

## 🛠️ Demo Flow 1 — Hero Patient Walkthrough (3 min)

| Step | Action Protocol | Target Component | Expected Verification Result | Status |
|---|---|---|---|---|
| **1** | Navigate to the app root url `/`. Wait for the white high-contrast landing page to completely load. Click **"Try Hero Patient Demo"** primary CTA or **"Demo Patient"** header link. | Home Landing Page CTA | Transitions seamlessly and routes the browser to the Hero Case path `/patient/hero`. | **PASS** |
| **2** | Confirm dashboard loading time. Review layout structure once visual loading indicators dismiss. | Layout Initialization | Patient interface transitions in under `< 2.0` seconds. All visual containers, including demographics, consensus shield, spectrum tabs, and sidebar panels, paint cleanly. | **PASS** |
| **3** | Under the **Comprehensive Fingerprint** tab, verify the **Epigenetic Clock Spectrum** forest plot. | Scatter / Forest Plot Canvas | Recharts scatter plot draws correctly. Seven distinct clocks (`Horvath`, `Hannum`, `PhenoAge`, `GrimAge`, `DunedinPACE`, `ZhangAge`, `CausAge`) are rendered with chronological age (orange dashed line) and consensus age (solid emerald line). | **PASS** |
| **4** | Scroll down to the **S.T.A.R. Framework Assessment** scoring component. Check container responsiveness. | STAR Grid Table | The STAR matrices display stability, responsiveness, phenotype associations, and clinical hazard profiles clearly. Mobile and responsive screens scale using horizontal container swipes (`overflow-x-auto`) to prevent viewport overflows. | **PASS** |
| **5** | Click on the **Longitudinal Trajectory** tab under the demographics panel. | Tab Switcher | Toggles immediate rendering of the spline ComposedChart. Vertical orange reference markings clearly indicate clinical therapeutic start durations (e.g. **"▲ Start: Rapamycin"**). | **PASS** |
| **6** | Inspect the elements inside the trajectory chart. | Spline Chart Metrics | A pale emerald shade band representing the **95% Credible Interval** is visible around the thick, double-layered black **consensus line**. Hovering over data points opens diagnostic details correctly. | **PASS** |
| **7** | Locate the **AI Clinical Assistant** panel inside the right sidebar column. | Right Sidebar AI Panel | Renders a personalized biological interpretation, a classified hallmark badge corresponding to global biomarkers, and detailed dosing, expected outcomes, and confidence meters across all therapeutic recommendations. | **PASS** |
| **8** | Click one of the **Suggested Questions** prompt chips listed under the assistant’s input container (e.g., *"How does Rapamycin lower GrimAge?"*). | Interactive Prompt Chips | **[FIXED]** Prompt action instantly executes the search stream without requiring manual text typing + clicking submit. The loader triggers immediately and returns a parsed diagnostic response in `< 1.2` seconds. | **PASS** |
| **9** | Type a custom clinical question in the text area (e.g., *"Analyze mortality hazard risk for Patient 7341."*) and press the **Send Plane Icon** or Enter. | Custom Inquiry Form | The copilot typing state animates. The chatbot model successfully appends the question-and-answer cycle chronologically into the visual history area, along with suggested next actions. | **PASS** |
| **10** | Click on the **Cohort Registry** or **Cohort Desk** link in the navigation header to load the global indices. | Navigation Link | Routes to `/cohort` instantly. The dashboard populates an active cohort of **50 patients** loaded directly from the persistent SQLite database, with complete stats summaries and demographic ratio spreads. | **PASS** |
| **11** | On the Cohort dashboard, click the **"Accelerated (>0y)"** preset filter chip. | Table Filter Controllers | The patient table filters. Only patients whose biological age acceleration exceeds chronological milestones (`acceleration > 0.0`) remain listed in the rows. | **PASS** |
| **12** | Click any patient record row on the filtered table (e.g., Row `CL-12`). | Patient Row Redirection | Router immediately pushes details for the selected patient, loading their specific clinical case folder flawlessly. | **PASS** |

---

## 🔬 Demo Flow 2 — Dynamic Clinical Question Optimization (2 min)

| Step | Action Protocol | Target Component | Expected Verification Result | Status |
|---|---|---|---|---|
| **1** | Locate the new **CLINICAL QUESTION SELECTOR** card above the demographics panel on `/patient/hero`. Check default choice. | Clinical Tab Strip | The selector displays a horizontal tab strip with 6 options (**GENERAL**, **MORTALITY**, **CARDIOVASCULAR**, **COGNITIVE**, **METABOLIC**, **CANCER**). **GENERAL** is selected by default with a mint green underline. | **PASS** |
| **2** | Review the introductory label above and the rationale box immediately below the strip. | Rationale Panel | Label shows *"OPTIMIZE CONSENSUS FOR:"* and the description dynamically loads the *"general"* lens systemic longevity rationale. | **PASS** |
| **3** | Click the **"MORTALITY"** tab. Observe the consensus age scorecard number. | Biological Scorecard | The consensus score dynamically transitions from `57.0` to `58.4` over an 800ms easeOutCubic animated countdown. There is zero screen flicker. | **PASS** |
| **4** | Confirm the Credible Interval brackets update on the scorecard. | Scorecard CI Brackets | The CI brackets update dynamically to display the mortality confidence boundaries: `CI [56.1, 60.7]`. | **PASS** |
| **5** | Click on the **"Why this changed"** expandable disclosure panel below the demographics row. | Expandable Weights | Toggling the panel opens a responsive chart of horizontal progress bars. Each clock color matches the trajectory chart schema. Tooltips show weight percentages (e.g., `GrimAge: 25.50%`) and individual computed contributions. | **PASS** |
| **6** | Verify re-weighting behavior under alternative tabs (e.g., **METABOLIC**). | Progress Bars Transition | Bar widths transition smoothly and reposition dynamically according to multipliers (e.g., `PhenoAge` and `DunedinPACE` receive top allocations under metabolic optimization). | **PASS** |
| **7** | Review the **AI Clinical Assistant** panel's summary narrative and recommendations. | AI Copilot Updates | Switching lenses re-fetches and updates the diagnostic narrative. Mortality-centric lenses highlight somatic driver hazards, cardiovascular optimized lenses prioritize lipid management, and individual evidence-weighted recommendations ranking updates instantly with corresponding `question_relevance` scores. | **PASS** |

---

## 🔬 Test Notes & Custom Improvements

1. **Snappy Instant-Submit Suggestions:** We updated suggestion button behavior to directly run the clinical response system query instead of just populating the text field. This saves clicks for the testing clinician and ensures a seamless experience.
2. **Error Recovery Validation:** All fetch calls utilize a dynamic hostname lookup to automatically detect whether they are running under the local setup or the secure containerized Cloud Run environment, avoiding CORS and network issues.
3. **Typography & Styling Consistency:** Styled with deep, clinical white backgrounds on landers and deep-toned midnight grids on active diagnostic sheets, utilizing high-contrast `#0F766E` teals, and `lucide-react` vectors.
