# Screenshot Placement Guide & Manual Check Checklist

## 1. Live App & Screenshot Capture Status

During deck creation, our browser subagent checked Google Chrome DevTools availability, and two environment constraints prevented automated screenshot capture:
1. Google Chrome remote debugging (`chrome://inspect/#remote-debugging`) was not active (`DevToolsActivePort` missing).
2. The `chrome_devtools` MCP toolset exposed in this session did not include `take_screenshot` or `navigate_page`.

Per presentation rules, **zero fake screenshots were fabricated**. Instead, **Slide 7** uses four clean **native rounded browser frames** containing labeled high-resolution `<p:pic>` placeholder slots so you can right-click each image directly in Microsoft PowerPoint and select **Change Picture -> This Device...** without shifting any borders, captions, or typography.

---

## 2. How to Capture Your Live Screenshots (Already Running Locally!)

Start (or confirm) both local ScholarAI servers are running (`http://127.0.0.1:8000` and `http://localhost:5173`), open **http://localhost:5173** in Chrome/Edge, open DevTools (`F12` -> Toggle Device Toolbar `Ctrl+Shift+M`), set exact responsive widths (`1440 x 900` for Desktop, `390 x 844` for Mobile), and use DevTools `Ctrl+Shift+P` -> **Capture screenshot** (or Capture full-size/node screenshot).

### Recommended Placement Table (Slide 7 — `Cols 6–12`, `3.26" × 2.04"` exact 16:10 frames)

| Slot # | Slide & Position | Recommended Resolution | Target URL & Suggested State | Alt Text Included |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **Slide 7** — Right `2×2` Grid (`Cols 6–12`), Top-Left Frame | **1440 × 900** (or 1600+ px wide, 16:10 crop) | `http://localhost:5173/` (Home / Landing page with hero search bar, stats strip & featured scholarships) | `ScholarAI Home Landing Page Desktop View (1440x900)` |
| **2** | **Slide 7** — Right `2×2` Grid (`Cols 6–12`), Top-Right Frame | **1440 × 900** (16:10) | `http://localhost:5173/chat` after asking `"B.Tech student, 8.5 CGPA, family income below 3 lakh"` with citations + expanded *"How did AI reach this result?"* trace | `ScholarAI Chat Interface Desktop View (1440x900)` |
| **3** | **Slide 7** — Right `2×2` Grid (`Cols 6–12`), Bottom-Left Frame | **1440 × 900** (16:10) | `http://localhost:5173/eligibility` showing grouped **Eligible / Potentially Eligible / Not Eligible** rule results | `ScholarAI Eligibility Checker Result (1440x900)` |
| **4** | **Slide 7** — Right `2×2` Grid (`Cols 6–12`), Bottom-Right Frame | **1440 × 900** desktop (or **390 × 844** mobile frame) | `http://localhost:5173/scholarships/aicte-pragati-degree` showing application guide, document checklist & source/verified date badge | `ScholarAI Scholarship Detail and Official Citations View` |

> **Privacy Check Before Inserting:** Confirm no personal API keys, personal browser bookmarks bar, Aadhaar/phone data, or Admin passwords appear inside any screenshot.

---

## 3. Steps to Replace Placeholders in PowerPoint

1. Open `ScholarAI_CSE276.pptx` in Microsoft PowerPoint (`Office 2019 / 2021 / 365`).
2. Go to **Slide 7**.
3. Click the **inner placeholder image** inside any of the 4 browser frames (avoid clicking only the outer frame border).
4. **Right-click -> Change Picture -> From File (This Device...)** -> choose your captured screenshot PNG.
5. If cropping is needed: **Picture Format -> Crop -> Fill** so it preserves exact aspect ratio without stretching.

---

## 4. Needs Manual Check List (Verify in Microsoft PowerPoint)

Because PowerPoint-specific **Morph transitions** (`2 -> 3` and `9 -> 10`), live `<p:timing>` entrance/wipe animations, and font availability differ slightly between LibreOffice PDF rendering and Microsoft PowerPoint desktop playback, please test the following directly in **PowerPoint Slide Show (`F5`)**:

1. **Slide Transitions**:
   - Confirm `Fade` plays cleanly between Slides `1 -> 2`, `3 -> 4`, `4 -> 5`, `5 -> 6`, `6 -> 7`, `7 -> 8`, `8 -> 9`, and `10 -> 11`.
   - Confirm **`Morph`** transition activates smoothly on **Slide 3** (`2 -> 3`) and **Slide 10** (`9 -> 10`). *(An automatic Fade fallback is embedded in OOXML `mc:AlternateContent` for older PowerPoint/LibreOffice versions.)*
2. **Slide Animations (`Animations -> Animation Pane`)**:
   - **Slide 1**: Subtle drift animation on decorative AI network cluster; brand badge zoom-in; title fade/rise; staggered team cards.
   - **Slides 5 & 6**: Confirm steps and connector arrows trigger **strictly in left-to-right / flow order** (`Step 1 -> Wipe Arrow 1 -> Step 2 -> Wipe Arrow 2...`), each under `0.8 s`.
   - Confirm all bullets on Slides 2, 3, 4, 7, 8, 9, and 10 appear smoothly without awkward bounce, spin, or delay > 0.8 s.
3. **Typography & Fonts**:
   - Built with native **Segoe UI** (`Segoe UI` Bold headings + `Segoe UI` body) so zero Windows font substitution occurs. If your college evaluation template requires **Poppins + Inter**, install both TrueType fonts on your PC first and swap via **Home -> Replace -> Replace Fonts...**.
4. **Slide 7 Image Slots**:
   - Replace the 4 screenshot placeholders using **Right-click -> Change Picture** before your final demo, and re-export PDF from PowerPoint (`File -> Save As -> PDF`) after inserting live screenshots.
