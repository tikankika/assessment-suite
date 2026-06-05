# Phase 3: Annotering av elevsvar

**Version:** 1.0
**Status:** Methodology Instructions
**Purpose:** Markera exakt var varje elevs svar börjar och slutar i annoterade elevfiler

---

## Syfte

Markera exakt var varje elevs svar på varje fråga börjar och slutar i den
kopierade elevfilen (`03_material/student_answers/`). Markeringarna ger Phase 5
entydiga instruktioner för textextraktion.

### Varför Phase 3 behövs

Phase 2C identifierar svarsgränser — textmarkörer som `question_header: '1.'`,
`answer_start_marker: a)` — och lagrar dem i `exam_config.yaml`. Antagandet är
att **samma markörer fungerar för alla elever**. Det stämmer för Inspera
(standardiserad plattform med identisk formatering) men **bryts för öppna
format** (Word/docx) där varje elev formaterar annorlunda.

**Konsekvens om Phase 5 kör med fel gränser:**

| Problem | Effekt |
|---------|--------|
| Fel text extraheras | Svar från fel fråga hamnar i Q-fil |
| Text trunkeras | Svar klipps av — end-markör hittades inte |
| Svar saknas | Fråga hittas inte alls, hoppas över tyst |
| Delsvar slås ihop | a) och b) separeras inte korrekt |

Alla dessa leder till **felaktig bedömning i Phase 6** — det allvarligaste
felet i hela pipelinen.

Phase 3 löser detta genom att lägga in **per-fil, per-elev markeringar** som
är entydiga oavsett hur eleven formaterat sitt svar.

---

## Förutsättningar

Innan du börjar annotera måste följande vara klart:

1. **Phase 2C klar** — `exam_config.yaml` har `answer_boundaries` med
   frågestruktur (vilka frågor, vilka delfrågor)
2. **Phase 3 prepare klar** — `phase3_prepare` har:
   - Kopierat filer från `02_markdown/student_answers/` till
     `03_material/student_answers/`
   - Lagt till permanenta radindex (`0001`, `0002`...) i varje fil
   - Lagt till `<!-- student: {id} -->` som header i varje fil

**Kontrollera:** Öppna en fil i `03_material/student_answers/` och verifiera
att den ser ut ungefär så här:

```
0001 <!-- student: stu1 -->
0002
0003 **1. Miljöledningssystem ISO 14001**
0004
0005 a) Ett miljöledningssystem enligt ISO 14001...
0006 ...elevens text fortsätter...
0007
0008 b) Genom att kommunicera sitt miljöarbete...
```

Om radindex saknas har `phase3_prepare` inte körts.

---

## Markeringsformat

Markeringar är HTML-kommentarer som infogas på **egna rader** mellan
befintliga rader. De får INTE eget radindex — de läggs till efter
indexeringssteget.

### Grundformat

```
<!-- phase3_q001_start -->     Fråga 1 börjar
<!-- phase3_q001_end -->       Fråga 1 slutar
```

### Fråga med delfrågor

```
<!-- phase3_q001_start -->       Fråga 1 börjar
<!-- phase3_q001a_start -->      Delfråga a börjar
...elevens svar på a...
<!-- phase3_q001a_end -->        Delfråga a slutar
<!-- phase3_q001b_start -->      Delfråga b börjar
...elevens svar på b...
<!-- phase3_q001b_end -->        Delfråga b slutar
<!-- phase3_q001_end -->         Fråga 1 slutar
```

### Fråga utan delfrågor

```
<!-- phase3_q002_start -->
...elevens svar (hela frågan)...
<!-- phase3_q002_end -->
```

### Komplett annoterad fil — exempel

```
0001 <!-- student: stu1 -->
0002
<!-- phase3_q001_start -->
0003 **1. Miljöledningssystem ISO 14001**
0004
<!-- phase3_q001a_start -->
0005 a) Ett miljöledningssystem enligt ISO 14001 är ett ramverk som
0006 hjälper organisationer att systematiskt arbeta med miljöfrågor.
0007 Det innebär att man sätter upp miljömål, följer upp dem och
0008 ständigt förbättrar sitt miljöarbete.
<!-- phase3_q001a_end -->
<!-- phase3_q001b_start -->
0009 b) Genom att kommunicera sitt miljöarbete externt kan företaget
0010 visa kunder och samhälle att de tar ansvar för miljön.
<!-- phase3_q001b_end -->
<!-- phase3_q001_end -->
0011
<!-- phase3_q002_start -->
0012 **2. Intressenter och miljöpåverkan**
0013
0014 De viktigaste intressenterna är kunder, myndigheter och
0015 samhället i stort. Kunderna efterfrågar hållbara produkter...
<!-- phase3_q002_end -->
```

### Namnkonventioner

| Element | Format | Exempel |
|---------|--------|---------|
| Fråge-ID | 3-siffror, nollpaddat | `q001`, `q002`, `q013` |
| Delfråga | Liten bokstav | `q001a`, `q001b`, `q005c` |
| Alla markeringar | Gemener (lowercase) | `phase3_q001_start` |
| Placering | Egen rad, ALDRIG inline | Se exempel ovan |

---

## Systematisk genomgång — en elev i taget

### Steg 1: Läs exam_config.yaml

Innan du öppnar någon elevfil — läs `exam_config.yaml` och identifiera:

- Vilka frågor finns? (Q001, Q002, ... Q007)
- Vilka frågor har delfrågor? (Q001 har a, b; Q005 har a, b, c)
- Vilka frågor har bara ett svar? (Q002 utan delfrågor)

Detta ger dig en **checklista** att bocka av per elev. Exempel:

```
Förväntade frågor (från config):
  Q001: delfrågor a, b
  Q002: inga delfrågor
  Q003: delfrågor a, b
  Q004: delfrågor a, b
  Q005: delfrågor a, b, c
  Q006: delfrågor a, b
  Q007: delfrågor a, b
```

### Steg 2: Läs EN elevfil

Läs **EN** fil från `03_material/student_answers/`. Aldrig fler. Se Kritiska
regler, regel 1.

Notera elevens ID från headern:

```
0001 <!-- student: stu1 -->
```

Skumma igenom hela filen. Få en känsla för:

- Hur eleven numrerar frågor (`1.`, `1,`, `*1.*`, eller inget)
- Hur eleven markerar delfrågor (`a)`, `a.`, `a och b)`, eller inget)
- Var texten börjar och slutar
- Om eleven hoppat över frågor

### Steg 3: Identifiera svarsgränser

Gå igenom din checklista från Steg 1. För varje fråga i config:

1. **Hitta var frågan börjar** i elevfilen med hjälp av radindex
   - Leta efter question_header (t.ex. `1.`, `2.`) men var flexibel
   - Eleven kan ha skrivit `1,` istället för `1.` eller `*1.*` (kursiv)
2. **Hitta var svaret slutar** — vanligtvis vid nästa frågas header eller
   filens slut
3. **Om delfrågor förväntas** — identifiera var varje delsvar börjar och slutar
4. **Notera radindex** för varje gräns, t.ex.:
   - "q001 börjar vid 0003"
   - "q001a börjar vid 0005, slutar vid 0008"
   - "q001b börjar vid 0009, slutar vid 0010"
   - "q001 slutar vid 0010"

**Viktigt:** Config säger vad du letar efter, men **elevfilen är
auktoriteten**. Se Kritiska regler, regel 2.

### Steg 4: Infoga markeringar

Använd **Edit-verktyget** (aldrig Write) för att infoga markeringsrader.

Arbeta uppifrån och ned i filen. För varje fråga:

1. Infoga `<!-- phase3_q001_start -->` före frågans första rad
2. Om delfrågor: infoga `<!-- phase3_q001a_start -->` före delsvarets
   första rad
3. Infoga `<!-- phase3_q001a_end -->` efter delsvarets sista rad
4. Fortsätt med nästa delfråga
5. Infoga `<!-- phase3_q001_end -->` efter frågans sista rad

**Exempel Edit-anrop:**

```
old_string: "0003 **1. Miljöledningssystem ISO 14001**"
new_string: "<!-- phase3_q001_start -->\n0003 **1. Miljöledningssystem ISO 14001**"
```

```
old_string: "0005 a) Ett miljöledningssystem"
new_string: "<!-- phase3_q001a_start -->\n0005 a) Ett miljöledningssystem"
```

```
old_string: "0008 ständigt förbättrar sitt miljöarbete."
new_string: "0008 ständigt förbättrar sitt miljöarbete.\n<!-- phase3_q001a_end -->"
```

### Steg 5: Validera

Efter att alla markeringar infogats i EN fil — validera innan du går vidare
till nästa elev.

**Validering:**

1. Kör `phase3_validate` om verktyget finns tillgängligt
2. Alternativt, kontrollera manuellt:
   - Finns alla förväntade marker-par? (en start + en end per fråga/delfråga)
   - Är varje markering på egen rad?
   - Är nesting korrekt? (delfrågor inom fråge-markeringar)
   - Har elevtexten ändrats? (ska vara oförändrad)
   - Finns tomma marker-par för obesvarade frågor?

**Först när filen är validerad — gå vidare till nästa elev.**

---

## Kritiska regler

Dessa regler är baserade på erfarenheter från COURSE_NS-piloten (22 elever,
59% felrate vid batch-bearbetning). De är inte förslag — de är krav.

### Regel 1: EN fil i taget

Ladda aldrig flera elevfiler samtidigt i context. Inte ens "för att jämföra"
eller "för effektivitet".

**Varför:** Bevisat i COURSE_NS-piloten: 6 filer laddade samtidigt (~1000 rader)
resulterade i ett massivt thinking-block och noll output. Claude försökte
mentalt spåra radnummer för 6 filer parallellt, blandade ihop dem, och
producerade ingenting.

**Regel:** En fil laddad i context åt gången. Läs fil → annotera → validera →
stäng. Först därefter öppna nästa fil.

### Regel 2: Config som guide, inte sanning

`exam_config.yaml` berättar **vad du letar efter** (fråga 1 med delfrågor a,
b). Men **elevfilen är auktoriteten** för vad som faktiskt finns.

Eleven kan ha:
- Hoppat över frågor
- Slagit ihop delfrågor ("a och b)")
- Använt annan numrering (`1,` istället för `1.`)
- Skrivit svar utan frågenummer
- Slutat tidigt ("orkar inte mer")

Anpassa annoteringen efter vad eleven faktiskt skrivit, inte efter vad config
förväntar sig.

### Regel 3: Ändra aldrig elevtext

Infoga **BARA** markeringsrader mellan befintliga rader. Ingen elevtext får
ändras, tas bort eller flyttas. Radindex ska peka på exakt samma innehåll
efter annotering som före.

**BRA:**
```
<!-- phase3_q001a_start -->
0005 a) Ett miljöledningssystem enligt ISO 14001...
```

**FEL:**
```
<!-- phase3_q001a_start --> 0005 a) Ett miljöledningssystem...
```
(Markering inline med text — bryter validering.)

**FEL:**
```
0005 a) ett miljöledningssystem enligt ISO 14001...
```
(Ändrad versal till gemen — textkorruption.)

### Regel 4: Använd Edit-verktyget

Använd **aldrig** Write-verktyget för att skriva hela filer. Write-verktyget
strippar escape-tecken:

| Originalt | Write producerar |
|-----------|-----------------|
| `\"` | `"` |
| `\)` | `)` |
| `\*` | `*` |

Detta korrumperar elevtexten tyst — den ser rätt ut vid inspektion men
byte-jämförelse mot originalet misslyckas.

**Använd alltid Edit-verktyget** som gör exakt string replacement utan att
modifiera omgivande text.

### Regel 5: Referera alltid radindex

Använd alltid det permanenta radindexet i filen. Säg "q001a börjar vid 0017",
inte "ungefär rad 17" eller "runt rad 17".

Radindex finns i varje rad av den preparerade filen:

```
0017 a) Svaret börjar här...
```

`0017` är entydigt. "Rad 17" kan vara fel om du räknat från toppen.

### Regel 6: Tomma markeringspar för obesvarade frågor

Om eleven hoppat över en fråga eller delfråga — lägg **ändå** in
start/end-par (tomma). Detta ger strukturell konsistens som Phase 5 förväntar
sig.

```
<!-- phase3_q003_start -->
<!-- phase3_q003a_start -->
<!-- phase3_q003a_end -->
<!-- phase3_q003b_start -->
<!-- phase3_q003b_end -->
<!-- phase3_q003_end -->
```

Utan tomma markeringspar får Phase 5 ett strukturfel: den förväntar sig
markeringar för alla frågor och kraschar eller ger felmeddelande när
q003-markeringar saknas.

### Regel 7: Validera innan nästa elev

Kör `phase3_validate` (eller manuell kontroll) efter varje annoterad fil.
Gå **aldrig** vidare till nästa elev förrän den aktuella filen är godkänd.

**Varför:** Fel som upptäcks sent (efter 10 filer) är svåra att felsöka.
Fel som upptäcks direkt är triviala att fixa.

---

## Specialfall

### Eleven slår ihop delfrågor

**Situation:** Config förväntar sig separata svar för a) och b), men eleven
har skrivit "a och b)" eller behandlat dem som en fråga.

```
0015 a och b) Skillnaden mellan ISO 14001 och EMAS är att ISO är
0016 internationell medan EMAS är europeisk. Båda systemen kräver
0017 att man dokumenterar sin miljöpåverkan och sätter upp mål.
```

**Lösning:** Lägg allt innehåll under den första delfrågan. Skapa tomma
markeringar för den andra.

```
<!-- phase3_q005_start -->
<!-- phase3_q005a_start -->
0015 a och b) Skillnaden mellan ISO 14001 och EMAS är att ISO är
0016 internationell medan EMAS är europeisk. Båda systemen kräver
0017 att man dokumenterar sin miljöpåverkan och sätter upp mål.
<!-- phase3_q005a_end -->
<!-- phase3_q005b_start -->
<!-- phase3_q005b_end -->
<!-- phase3_q005_end -->
```

**Motivering:** Phase 5 extraherar text under q005a och får hela svaret.
Phase 6 (bedömning) kan sedan avgöra om eleven besvarat båda delfrågorna.

### Eleven hoppar över en fråga

**Situation:** Config förväntar sig Q003, men eleven har gått direkt från
Q002 till Q004.

**Lösning:** Infoga tomma markeringspar för Q003 mellan Q002:s slut och
Q004:s början.

```
<!-- phase3_q002_end -->

<!-- phase3_q003_start -->
<!-- phase3_q003a_start -->
<!-- phase3_q003a_end -->
<!-- phase3_q003b_start -->
<!-- phase3_q003b_end -->
<!-- phase3_q003_end -->

<!-- phase3_q004_start -->
0025 **4. Hållbar utveckling**
```

### Eleven slutar tidigt

**Situation:** Eleven svarar på Q001–Q005 men skriver inget mer (kanske
"orkar inte mer" eller bara slut på text).

**Lösning:** Annoterade frågor 1–5 som vanligt. Lägg tomma markeringspar
för Q006 och Q007 i slutet av filen.

```
<!-- phase3_q005_end -->
0042
0043 // orkar inte mer
<!-- phase3_q006_start -->
<!-- phase3_q006a_start -->
<!-- phase3_q006a_end -->
<!-- phase3_q006b_start -->
<!-- phase3_q006b_end -->
<!-- phase3_q006_end -->
<!-- phase3_q007_start -->
<!-- phase3_q007a_start -->
<!-- phase3_q007a_end -->
<!-- phase3_q007b_start -->
<!-- phase3_q007b_end -->
<!-- phase3_q007_end -->
```

### Avvikande formatering

**Situation:** Eleven skriver `1,` istället för `1.`, eller `*1.*` (kursiv),
eller `1.a` (fråga och delfråga ihopskrivna), eller helt utan nummer.

**Lösning:** Använd läsförståelse, inte mönstermatchning. Om du kan identifiera
att eleven svarar på fråga 1 — oavsett formatering — markera svaret.

Exempel:

```
0003 1, Miljöledningssystem
```

Eleven menar uppenbart fråga 1, även om hen skrev `,` istället för `.`.
Markera som q001.

```
0003 *1.* Miljöledningssystem
```

Kursiv formatering — fortfarande fråga 1. Markera som q001.

```
0003 Jag tycker att miljöledningssystem är viktiga för att...
```

Eleven skrev inget frågenummer, men du vet från filens position och
config att detta bör vara fråga 1. Markera som q001 — men notera
osäkerheten i valideringssteget.

### Text som inte tillhör någon fråga

**Situation:** Filen har text före första frågan (elevens namn, datum) eller
efter sista frågan (kommentarer, anteckningar).

**Lösning:** Placera markeringar så att de omsluter enbart svarstexten.
Text utanför alla markeringspar är ok — den extraheras inte av Phase 5.

```
0001 <!-- student: stu1 -->
0002 Prov: Styrmedel VT26
0003 Datum: 2026-03-01
0004
<!-- phase3_q001_start -->
0005 **1. Miljöledningssystem**
...
```

Rad 0002–0004 ligger utanför markeringar — det är korrekt.

---

## Vanliga misstag (från COURSE_NS-piloten)

COURSE_NS-piloten annoterade 22 elever med 7 frågor vardera. Först
batch-bearbetning (alla 22 på en gång), sedan en-i-taget-fix. Resultaten
var tydliga:

| Misstag | Konsekvens | Lösning |
|---------|-----------|---------|
| Batch-annotering (flera filer samtidigt) | 59% felrate (13/22 filer hade problem) | En elev i taget (regel 1) |
| Inline-markeringar (markering på samma rad som text) | Validering misslyckas — markering hittas inte | Egen rad per markering (regel 3) |
| Write-verktyget istället för Edit | Textkorruption — escape-tecken strippas | Edit-verktyget (regel 4) |
| Glömda tomma markers för obesvarade frågor | Strukturfel i Phase 5 — markering saknas | Alla frågor, även obesvarade (regel 6) |
| Fel delfråga (elevens 3.b hamnar under q003a) | Fel svar i Q-fil → fel bedömning | Dubbelkolla mot config, referera radindex |
| "Ungefär rad 17" | Off-by-one-fel, markering hamnar fel | Referera alltid radindex (regel 5) |
| Läsa "för effektivitet" (6 filer samtidigt) | Massivt thinking-block, noll output | Strikt en fil i context (regel 1) |

---

## Sammanfattning: Workflow per elev

```
1. Läs exam_config.yaml → checklista (vilka frågor/delfrågor)
2. Öppna EN fil från 03_material/student_answers/
3. Skumma filen — förstå elevens formatering
4. Fråga för fråga:
   a. Identifiera svarsgränser med radindex
   b. Infoga markeringar med Edit-verktyget
5. Obesvarade frågor → tomma markeringspar
6. Validera (phase3_validate eller manuell kontroll)
7. Stäng filen → öppna nästa elev
```

**Klart när:** Alla elevfiler i `03_material/student_answers/` har fullständiga
markeringar och har passat validering.

---

**Status:** Methodology Instructions — Ready for Use
**Förutsätter:** `phase3_prepare` (tool), `exam_config.yaml` (Phase 2C)
**Nästa steg:** Phase 5 (extraktion från markeringar)
