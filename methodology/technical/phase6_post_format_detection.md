# Phase 6-post: Assessment Format Detection - Instruktioner för Claude

**Version:** 4.1
**Status:** Methodology Instructions
**Purpose:** Detect assessment format patterns that work for Phase 7 report generation

---

## Din roll i Phase 6-post

Du är en **format detector** som hittar:
1. **Format type** - v2 (standard) eller legacy
2. **Header pattern** - Hur bedömningar markeras (t.ex. `### BEDÖMNING:`)
3. **Points pattern** - Hur poäng skrivs (kan variera per Q-fil!)
4. **Verifiering** - Att mönstret fungerar för **ALLA bedömningar** i varje Q-fil

### ⚠️ VIKTIGT: Stöd för per-fråga patterns

Phase 7 stödjer **per-question patterns** - olika Q-filer kan ha olika `points_pattern`.

**Om ALLA Q-filer har SAMMA format:**
- Använd `default_points_pattern` (enklast)

**Om Q-filer har OLIKA format:**
- Använd `questions` dict med pattern per fråga (Q001, Q002, etc.)
- `default_points_pattern` är **VALFRITT** om alla frågor finns i `questions`
- Lägg INTE till `default_points_pattern` i onödan - det behövs bara som fallback för framtida frågor

### Vad du INTE gör i 6-post

- Du **frågar inte** användaren "Bekräfta?" - DU beslutar
- Du **gissar inte** - analysera faktisk data
- Du **antar inte** - verifiera mot flera exempel
- Du **sparar inte** förrän du verifierat mot ALLA Q-filer

---

## Assessment Format Types

### v2 Format (Standard - REKOMMENDERAD)

```markdown
<!-- PHASE6_ASSESSMENT_START student_id="12345" -->
Bedömningstext här...
**Totalpoäng: 8/10p**
<!-- PHASE6_ASSESSMENT_END -->
```

**Kännetecken:**
- HTML comment markers
- Explicit start/end boundaries
- Student ID i start marker

### Legacy Format

```markdown
### BEDÖMNING: 12345

### FRÅGA 1: Namn (8/10 poäng)

Bedömningstext här...

**Totalpoäng: 8/10p**

---
```

**Kännetecken:**
- Markdown header med student ID
- Bedömningar ofta i SLUTET av filen
- Poäng kan finnas på FLERA ställen (titel, totalpoäng)

---

## Workflow

### Steg 1: LOAD mode

```
phase6_post_format(
  project_path: "/path/to/project",
  mode: "load"
)
```

Returnerar:
- Lista på Q-filer
- Sample content från första Q-filen
- Denna methodology

### Steg 2: ANALYSERA sample content

**DU ska göra detta (inte verktyget!):**

1. **Sök efter v2 markers:**
   ```
   <!-- PHASE6_ASSESSMENT_START
   ```
   Om hittad → format type = "v2"

2. **Om inte v2, sök efter legacy markers:**
   ```
   ### BEDÖMNING:
   ```
   Om hittad → format type = "legacy"

3. **För legacy format - HITTA patterns:**

   **Header pattern:**
   - Sök efter `### BEDÖMNING: XXXXX` där XXXXX är student-ID
   - Pattern: `### BEDÖMNING:\s*(\S+)`

   **Points pattern - KRITISKT:**
   - Titta på VAR poäng finns i texten
   - Vanliga platser:
     - I titel: `### FRÅGA 1: Namn (8/10 poäng)`
     - I totalrad: `**Totalpoäng: 8/10p**`
     - I parentes: `(8/10 poäng)`

### Steg 3: ⚠️ VERIFIERA pattern mot ALLA Q-filer

**KRITISKT: Du MÅSTE verifiera mot ALLA Q-filer innan du sparar!**

1. **Läs VARJE Q-fil** (Q001, Q002, Q003, Q004...)
   - Använd `read_text_file` för att läsa varje Q-fil
   - Leta efter `### BEDÖMNING:` sektioner i SLUTET av filen

2. **Testa din pattern mot varje Q-fil:**
   - Extrahera poäng från minst 2-3 bedömningar per Q-fil
   - Notera om pattern fungerar eller inte

3. **Om olika Q-filer har OLIKA format:**
   - STOPP! Rapportera detta till läraren
   - Fråga vilken pattern som ska användas
   - Eller be läraren standardisera formatet

**Exempel verifiering mot ALLA Q-filer:**
```
Testar pattern: \((\d+(?:[.,]\d+)?)/(\d+)p\)

Q001: ❌ 0/17 matchade - använder **TOTALPOÄNG: X/Yp**
Q002: ✓ 17/17 matchade - använder (X/Yp)
Q003: ❌ 0/17 matchade - använder **TOTALPOÄNG: X/Yp**
Q004: ❌ 0/17 matchade - använder **TOTALPOÄNG: X/Yp**

⚠️ PROBLEM: Q-filerna har OLIKA format!
→ Fråga läraren innan du sparar
```

### Steg 4: BESLUTA och presentera för läraren

**Presentera dina findings för ALLA Q-filer:**

```
## Format Detection Results

**Detekterat format:** legacy

**Header pattern:** `### BEDÖMNING:`
**Student ID pattern:** `### BEDÖMNING:\s*(\S+)`
**Points pattern:** `\((\d+(?:[.,]\d+)?)/(\d+)p\)`

**⚠️ Verifiering mot ALLA Q-filer:**
- Q001: ✓ 17/17 matchade
- Q002: ✓ 17/17 matchade
- Q003: ✓ 17/17 matchade
- Q004: ✓ 17/17 matchade

**TOTALT: 68/68 bedömningar matchade (100%)**

Ska jag spara denna konfiguration?
```

**Om olika Q-filer har OLIKA format:**
```
## Format Detection Results - OLIKA FORMAT PER FRÅGA

**Detekterat format:** legacy

**Header pattern:** `### BEDÖMNING:`
**Student ID pattern:** `### BEDÖMNING:\s*(\S+)`

**Per-question patterns detekterade:**
- Q001: `\*\*TOTALPOÄNG:\s*(\d+)/(\d+)p\*\*` (17/17 matchade)
- Q002: `### Q\d+:\s*\d+\s*\((\d+)/(\d+)p\)` (17/17 matchade)
- Q003: `\*\*TOTALPOÄNG:\s*(\d+)/(\d+)p\*\*` (17/17 matchade)
- Q004: `\*\*TOTALPOÄNG:\s*(\d+)/(\d+)p\*\*` (17/17 matchade)

**TOTALT: 68/68 bedömningar matchade (100%)**

Ska jag spara med per-question patterns?
```

### Steg 5: SAVE mode (efter lärarens godkännande)

**SAMMA format för alla Q-filer:**
```
phase6_post_format(
  project_path: "/path/to/project",
  mode: "save",
  assessment_format: {
    type: "legacy",
    legacy_header: "### BEDÖMNING:",
    student_id_pattern: "### BEDÖMNING:\\s*(\\S+)",
    default_points_pattern: "\\((\\d+(?:[.,]\\d+)?)/(\\d+)\\s*poäng\\)",
    confirmed_by: "TestTeacher"
  }
)
```

**OLIKA format per Q-fil (per-question patterns):**
```
phase6_post_format(
  project_path: "/path/to/project",
  mode: "save",
  assessment_format: {
    type: "legacy",
    legacy_header: "### BEDÖMNING:",
    student_id_pattern: "### BEDÖMNING:\\s*(\\S+)",
    questions: {
      "Q001": { "points_pattern": "\\*\\*TOTALPOÄNG:\\s*(\\d+)/(\\d+)p\\*\\*" },
      "Q002": { "points_pattern": "### Q\\d+:\\s*\\d+\\s*\\((\\d+)/(\\d+)p\\)" },
      "Q003": { "points_pattern": "\\*\\*TOTALPOÄNG:\\s*(\\d+)/(\\d+)p\\*\\*" },
      "Q004": { "points_pattern": "\\*\\*TOTALPOÄNG:\\s*(\\d+)/(\\d+)p\\*\\*" }
    },
    // OBS: default_points_pattern behövs INTE när alla frågor finns i questions
    confirmed_by: "TestTeacher"
  }
)
```

---

## Output Format

Sparas till `exam_config.yaml`:

**Med default pattern (alla Q-filer samma):**
```yaml
assessment_format:
  type: 'legacy'
  legacy_header: '### BEDÖMNING:'
  student_id_pattern: '### BEDÖMNING:\s*(\S+)'
  default_points_pattern: '\((\d+(?:[.,]\d+)?)/(\d+)\s*poäng\)'
  confirmed_by: 'TestTeacher'
  confirmed_at: '2026-01-20T12:34:56'
```

**Med per-question patterns (utan fallback):**
```yaml
assessment_format:
  type: 'legacy'
  legacy_header: '### BEDÖMNING:'
  student_id_pattern: '### BEDÖMNING:\s*(\S+)'
  questions:
    Q001:
      points_pattern: '\*\*TOTALPOÄNG:\s*(\d+)/(\d+)p\*\*'
    Q002:
      points_pattern: '### Q\d+:\s*\d+\s*\((\d+)/(\d+)p\)'
    Q003:
      points_pattern: '\*\*TOTALPOÄNG:\s*(\d+)/(\d+)p\*\*'
    Q004:
      points_pattern: '\*\*TOTALPOÄNG:\s*(\d+)/(\d+)p\*\*'
  # OBS: default_points_pattern utelämnad - behövs inte när alla Q finns
  confirmed_by: 'TestTeacher'
  confirmed_at: '2026-01-20T12:34:56'
```

---

## Vanliga Points Patterns

| Mönster i text | Regex pattern |
|----------------|---------------|
| `(8/10 poäng)` | `\((\d+(?:[.,]\d+)?)/(\d+)\s*poäng\)` |
| `(8/10 p)` | `\((\d+(?:[.,]\d+)?)/(\d+)\s*p\)` |
| `**Totalpoäng: 8/10p**` | `\*\*Totalpoäng:\s*(\d+(?:[.,]\d+)?)/(\d+)p\*\*` |
| `8/10 poäng` | `(\d+(?:[.,]\d+)?)/(\d+)\s*poäng` |

---

## Special Cases

### Poäng på FLERA ställen

Om poäng finns både i titel OCH i totalrad:
```markdown
### FRÅGA 1: Namn (9/10 poäng)    ← poäng här
...
**Totalpoäng: 9/10p**             ← OCH här
```

Välj pattern för det som är MEST konsekvent. Ofta är titel-formatet mer pålitligt.

### Ingen poäng (kvalitativ bedömning)

Om bedömningar saknar numerisk poäng:
```yaml
assessment_format:
  type: 'legacy'
  legacy_header: '### BEDÖMNING:'
  points_pattern: null  # Ingen poäng-pattern
  confirmed_by: 'TestTeacher'
```

---

## Viktigt

- **DU analyserar** - verktyget ger bara data
- **DU beslutar** - verktyget sparar ditt beslut
- **Verifiera mot ALLA Q-filer** - Q001, Q002, Q003, Q004...
- **Per-question patterns** - om Q-filer har olika format, använd `questions` dict
- **Fallback pattern** - använd `default_points_pattern` som backup
- **Fråga läraren** - om något är oklart, fråga INNAN du sparar
