# Phase 4D: Answer Boundary Detection - Instruktioner för Claude

**Version:** 2.0
**Status:** Methodology Instructions
**Purpose:** Detect per-question boundary markers that work across ALL students

---

## KRITISK INSIKT

> **Boundary markers är SAMMA för alla studenter per fråga!**
>
> Du behöver bara identifiera markers EN GÅNG per fråga, sedan verifiera att de fungerar för alla studenter.

---

## Din roll i Phase 4D

Du är en **boundary detector** som ANALYSERAR dokumentstrukturen och HITTAR:

1. **question_header** - Exakt text som identifierar frågan (hoppa över TOC)
2. **answer_start** - Exakt text som markerar var svaret BÖRJAR
3. **answer_end** - Exakt text som markerar var svaret SLUTAR
4. **Verifiering** - Att samma markers fungerar för ALLA studenter

### Vad du INTE gör i 4D

- Du läser **inte** svarstexten (det gör Phase 5)
- Du bedömer **inte** svaren
- Du **hårdkodar INTE** värden - du ANALYSERAR och HITTAR dem

---

## ANALYSERA Dokumentstrukturen

### Steg 1: Identifiera question_header

Titta på studentfilen. Varje fråga har en header som identifierar den:

```
1 Restriktionsenzym (a-d)      ← QUESTION_HEADER (exakt denna text)
3 Gelelektrofores (a-e)        ← QUESTION_HEADER
4 Analysera resultaten         ← QUESTION_HEADER
```

**OBS:** Samma header kan finnas i TOC (tabell). Den rätta är den som står ENSAM på raden (utan extra text efter).

### Steg 2: Identifiera om frågan har delfrågor

Titta på strukturen efter question_header:

**MED delfrågor:**
```
1 Restriktionsenzym (a-d)
Ni har jobbat med restriktionsenzym. Här kommer några frågor:
a) Vad är ett restriktionsenzym?       ← Delfråga a
[elevens svar på a]
Ord: 50                                 ← Delsvarets slut
b) Förklara...                          ← Delfråga b
[elevens svar på b]
Ord: 28
...
Besvarad.                               ← Hela frågans slut
```

**UTAN delfrågor:**
```
2 Lambda-DNA
Vad är lambda-DNA?                      ← Frågetext (sista raden)
Det är ett DNA som har 23130 baspar...  ← Elevens svar börjar direkt
Ord: 14
Besvarad.
```

### Steg 3: Identifiera START marker

**För frågor MED delfrågor:**
- `answer_start_type: "sub_question"`
- `answer_start_marker`: Första delfrågan (t.ex. `"a)"` eller `"a."`)

**För frågor UTAN delfrågor:**
- `answer_start_type: "after_text"`
- `answer_start_marker`: Sista raden av frågetexten (svaret börjar EFTER denna rad)

### Steg 4: Identifiera END markers

**answer_end_marker:** Vad markerar slutet på HELA frågan?
- Analysera dokumentet - vad står efter sista svaret?
- Kan vara: "Besvarad.", "Answered.", nästa sidmarkör, etc.
- Om inget explicit: `answer_end_type: "next_question"` (slutar vid nästa frågas header)

**sub_question_end_marker:** (endast för frågor med delfrågor)
- Vad markerar slutet på varje DELSVAR?
- Kan vara: "Ord:", "Words:", etc.

---

## Output Format

Spara i `exam_config.yaml` under `answer_boundaries.questions`:

### Fråga MED delfrågor:

```yaml
Q001:
  question_header: "1 Restriktionsenzym (a-d)"   # EXAKT text från dokumentet
  answer_start_type: "sub_question"
  answer_start_marker: "a)"                      # EXAKT text - första delfrågan
  sub_question_end_marker: "Ord:"                # EXAKT text - var delsvar slutar
  answer_end_type: "marker"                      # eller "next_question"
  answer_end_marker: "Besvarad."                 # EXAKT text - var hela frågan slutar
  consistent_across_students: true
  verified_students: 4
```

### Fråga UTAN delfrågor:

```yaml
Q002:
  question_header: "2 Lambda-DNA"
  answer_start_type: "after_text"
  answer_start_marker: "Vad är lambda-DNA?"      # EXAKT sista raden av frågetexten
  answer_end_type: "marker"
  answer_end_marker: "Besvarad."
  consistent_across_students: true
  verified_students: 4
```

### Fråga som slutar vid nästa fråga:

```yaml
Q003:
  question_header: "3 Gelelektrofores (a-e)"
  answer_start_type: "sub_question"
  answer_start_marker: "a)"
  sub_question_end_marker: "Ord:"
  answer_end_type: "next_question"               # Ingen explicit end marker
  consistent_across_students: true
  verified_students: 4
```

---

## Global Section

Sammanfatta vanliga mönster:

```yaml
answer_boundaries:
  global:
    language: "swedish"                # Identifiera från dokumentet
    default_sub_question_end: "Ord:"   # Om samma för alla
    default_answer_end: "Besvarad."    # Om samma för alla
  questions:
    Q001: ...
    Q002: ...
```

---

## Workflow

### Steg 1: LOAD mode

```
phase4d_boundaries(project_path: "...", mode: "load")
```

Returnerar första studentfilen för analys.

### Steg 2: ANALYSERA första studenten

För varje fråga, identifiera:
1. `question_header` - exakt text
2. `answer_start_type` - "sub_question" eller "after_text"
3. `answer_start_marker` - exakt text
4. `sub_question_end_marker` - om delfrågor finns
5. `answer_end_type` - "marker" eller "next_question"
6. `answer_end_marker` - om type är "marker"

### Steg 3: VERIFIERA för alla studenter

Kontrollera att samma markers fungerar för ALLA studenter.

### Steg 4: SAVE mode

```
phase4d_boundaries(
  project_path: "...",
  mode: "save",
  answer_boundaries: { ... analyserade värden ... }
)
```

---

## Special Cases

### Auto-graded Questions

```yaml
Q001:
  auto_graded: true
  skip_boundary_detection: true
  reason: "Multiple choice - no text to extract"
```

### Frågor utan textsvar

```yaml
Q005:
  has_text_answer: false
  skip_boundary_detection: true
  reason: "Graphic Gap Match"
```

---

## Viktigt

- **ANALYSERA** - Hårdkoda aldrig värden, hitta dem i dokumentet
- **EXAKT TEXT** - Spara precis vad som står, inga variationer
- **VERIFIERA** - Samma markers måste fungera för alla studenter
- **Phase 5 använder detta** - Korrekta boundaries = korrekta Q-filer
