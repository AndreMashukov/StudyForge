# Rules for AI Cantonese Text Transformer

## IMPORTANT: This is a MANDATORY Transformation Rule

**This document defines a mandatory transformation rule that MUST be applied when processing Chinese text input.** When the AI receives text written in Chinese, it MUST apply this transformation rule to convert the input to the specified output format.

**This is NOT a general question about Jyutping transformation.** This is a specific instruction/rule that the AI system must follow when transforming Chinese text.

### Transformation Rule Summary

When given input text written in Chinese:
1. **MUST** convert standardized Chinese to Cantonese colloquial text
2. **MUST** transform each word to the format: `[word in cantonese] ([jyutping] - [english translation])`
3. **MUST** preserve punctuation and non-word elements as-is

The AI processes the text to provide linguistic annotations, grammar analysis, and visual schemas. The transformation aims to aid language learners by converting standardized Chinese to natural Cantonese, breaking down the text into words with Jyutping transliteration and English translations, followed by sections on grammar patterns and their visualizations.

## Input Requirements

### Input Type
A string of standardized Chinese text (simplified or traditional characters). The text can be a sentence, paragraph, or short passage. The input may be in written Chinese form that needs to be converted to Cantonese colloquial speech.

### Assumptions
- The input text is in standardized Chinese (written form), which should be automatically transformed to Cantonese colloquial text.
- The AI must perform a two-step transformation:
  1. **Text Conversion**: Automatically convert standardized Chinese to natural colloquial Cantonese text.
  2. **Annotation**: Add Jyutping transliteration and English translations to the converted Cantonese text.
- The AI should automatically handle the conversion from standardized Chinese to colloquial Cantonese, adapting vocabulary, grammar structures, and particles to natural Cantonese speech patterns.
- No prior segmentation is provided; the AI must handle word segmentation.
- Handle punctuation appropriately (e.g., preserve it in the output without annotation).
- Use Jyutping system for transliteration (not Pinyin).

### Edge Cases
- **Empty input**: Return an error message like "No Chinese text provided."
- **Non-Chinese characters**: Ignore or pass through unchanged (e.g., numbers, English words).
- **Mixed scripts**: Annotate only Chinese words.
- **Already in Cantonese**: If input is already in Cantonese colloquial form, proceed directly to annotation without conversion.

## Output Format

The output is a transformed version of the input text with two stages:
1. **Converted Cantonese Text**: The standardized Chinese converted to Cantonese colloquial form.
2. **Annotated Text**: The Cantonese text with Jyutping and English translations.

The entire output should be a single string or file content, followed by additional sections for grammar analysis.

### 1. Converted Cantonese Text Section

#### Transformation Rule
- First, automatically convert the standardized Chinese input to natural colloquial Cantonese text.
- The conversion should adapt the text to natural Cantonese speech patterns, vocabulary, and grammar structures.
- Preserve the original meaning while making it sound natural in Cantonese.

#### Example

**Input (Standardized Chinese)**: "你好，我是学生。"

**Converted Cantonese**: "你好，我係學生。"

### 2. Annotated Text Section

#### Transformation Rule (MANDATORY)
- **This rule MUST be applied to all Chinese text input.**
- Perform word segmentation on the converted Cantonese text using a reliable method (e.g., via libraries like Jieba with Cantonese support).
- For each segmented Cantonese word:
  - Convert the word to Jyutping (using tone numbers, e.g., "nei5 hou2" instead of "nei hou").
  - Translate the word to English (provide the most contextually appropriate translation; if ambiguous, choose the primary meaning).
  - **MUST use the exact format**: `[word in cantonese] ([jyutping] - [english translation])`
  - Note: Use a **dash/hyphen (-)** between Jyutping and English translation, NOT a comma.
- Preserve the original order and structure of the text.
- **CRITICAL: Punctuation marks MUST NOT be annotated.**
  - **DO NOT annotate**: 。！？，；：、「」『』（）【】《》〈〉…—
  - **DO NOT annotate**: Commas (，), periods (。), quotation marks (「」), parentheses (（）), or any other punctuation
  - Punctuation should appear in the output exactly as-is, without brackets, Jyutping, or translation
  - Only actual Chinese words/characters with semantic meaning should be annotated

#### What NOT to Annotate
The following elements should appear in the output exactly as they are in the input, WITHOUT any annotation (no brackets, Jyutping, or translation):

1. **All punctuation marks**:
   - Chinese punctuation: 。！？，；：、
   - Quotation marks: 「」『』
   - Brackets/Parentheses: （）【】《》〈〉
   - Other symbols: …—·
   
2. **Spacing and formatting**:
   - Spaces
   - Line breaks
   - Tabs

3. **Numbers** (unless they are part of a word):
   - Arabic numerals: 1234567890
   - But DO annotate Chinese number words: 一二三 etc.

4. **Non-Chinese characters**:
   - English letters (unless part of borrowed words integrated into Cantonese)
   - Special symbols: @#$%^&*

#### Jyutping Format Guidelines
- Use tone numbers (1-6) after each syllable (e.g., "nei5 hou2").
- Separate syllables with spaces.
- Use standard Jyutping romanization system.

#### Example

**Input (Standardized Chinese)**: "你好，我是学生。"

**Converted Cantonese**: "你好，我係學生。"

**Output Annotated Text**: 

```
[你好] (nei5 hou2 - hello)，[我] (ngo5 - I)[係] (hai6 - am)[學生] (hok6 saang1 - student)。
```

**Note**: The comma (，) and period (。) are NOT annotated - they appear as-is in the output.

### 2.5. Sentence Formatting and Line Breaks

#### Rule (MANDATORY)
- **Each sentence in the annotated text MUST be placed on a new line.**
- **Long sentences MUST be broken into multiple lines for readability.**
- **Insert line breaks at natural pause points within sentences.**

#### Line Break Guidelines
1. **Start each sentence on a new line** (separated by blank line from previous sentence)
2. **Within long sentences, insert line breaks**:
   - After commas (，)
   - After 5-8 annotated words (whichever comes first with comma)
   - At natural clause boundaries
3. **Indent continuation lines** with 2-4 spaces to show they're part of the same sentence
4. **Keep sentence-final punctuation** (。！？) on the same line as the last word

#### Sentence Boundary Detection
- Identify sentence boundaries using:
  - Chinese punctuation: 。！？；
  - Commas (，) typically do NOT end sentences but ARE line break points
  - Question marks (？) and exclamation marks (！) end sentences
- If ambiguous, use natural language processing to determine sentence breaks.

#### Example with Line Breaks

**Input**: "你好，我是学生。今天天气很好。他去了澳洲，然后回到香港，最后找到了工作。"

**Output with Proper Formatting**:

```
[你好] (nei5 hou2 - hello)，
  [我] (ngo5 - I)[係] (hai6 - am)[學生] (hok6 saang1 - student)。

[今日] (gam1 jat6 - today)[天氣] (tin1 hei3 - weather)[好] (hou2 - very)[好] (hou2 - good)。

[佢] (keoi5 - he)[去咗] (heoi3 zo2 - went to)[澳洲] (ou3 zau1 - Australia)，
  [然後] (jin4 hau6 - then)[返到] (faan1 dou3 - returned)[香港] (hoeng1 gong2 - Hong Kong)，
  [最後] (zeoi3 hau6 - finally)[搵到] (wan2 dou3 - found)[工] (gung1 - work)。
```

**Key Points**:
- Short sentences (1-8 words): Keep on single line
- Long sentences with commas: Break after each comma, indent continuation
- Blank line separates different sentences

### 3. Grammar Patterns Section

#### Rule
- Analyze the entire converted Cantonese text to identify key grammar patterns used.
- List each unique pattern with:
  - A brief description.
  - Examples from the converted Cantonese text (referencing the annotated version).
  - Common usage notes specific to Cantonese.

#### Identification Guidelines
- Use natural language processing techniques to detect Cantonese-specific patterns:
  - Subject-Verb-Object (SVO) structure.
  - Use of particles like 嘅 (ge3), 咗 (zo2), 喇 (laa3).
  - Question formations with 咩 (me1), 呀 (aa3), or sentence-final particles.
  - Use of 喺 (hai2) for location.
  - Negative constructions with 唔 (m4) or 冇 (mou5).
- Limit to 3-5 major patterns per text to avoid overload.
- If no patterns are detected, state "No distinct grammar patterns identified."

#### Format
Use a markdown list or table.

#### Example Table

| Grammar Pattern | Description | Example from Text |
|----------------|-------------|-------------------|
| Subject-Verb-Object (SVO) | Basic sentence structure where subject precedes verb and object. | `[我] (ngo5 - I)[係] (hai6 - am)[學生] (hok6 saang1 - student)` – "I am a student." |
| Use of Particle 嘅 (ge3) | Indicates possession or modification (equivalent to 的 in Mandarin). | If present, e.g., `[我嘅] (ngo5 ge3 - my)[書] (syu1 - book)` – "My book." |
| Perfective Aspect 咗 (zo2) | Indicates completed action (equivalent to 了 in Mandarin). | If present, e.g., `[食咗] (sik6 zo2 - ate)` – "ate" or "have eaten." |

### 4. Grammar Schemas Section

#### Rule
- For each grammar pattern identified in the previous section, provide a visual schema.
- Schemas should illustrate the structure (e.g., sentence trees, flowcharts).
- Use text-based representations suitable for markdown:
  - ASCII art for simple trees.
  - Code blocks with pseudo-diagram syntax (e.g., mimicking tree structures).

#### Visualization Guidelines
- Keep schemas simple and readable.
- Label components with Cantonese characters, Jyutping, and English where relevant.
- If complex, suggest using external tools for full diagrams (but provide basic ones here).

#### Format
Use markdown code blocks for each schema.

## Implementation Guidelines for the AI

### Output Formatting Algorithm
When generating the annotated text output, follow this algorithm:

1. **Process each sentence separately** (sentences end with 。！？；)
2. **For each sentence**:
   - Count the number of commas (，) in the sentence
   - If sentence has 0-1 commas AND is relatively short (≤8 words): Output on single line
   - If sentence has 2+ commas OR is long (>8 words): Break into multiple lines
3. **For multi-line sentences**:
   - Start first clause at the beginning of the line
   - After each comma (，), insert a newline
   - Indent continuation lines with 2-4 spaces
   - Keep final punctuation (。！？) on the last line
4. **Separate sentences** with a blank line

### Tools and Libraries
- **Word Segmentation**: Use Jieba with Cantonese support or specialized Cantonese segmentation tools.
- **Jyutping Conversion**: Use libraries like `pycantonese` or `jyutping` for Python, or equivalent tools for other languages.
- **Standardized to Cantonese Conversion**: Automatically convert standardized Chinese to colloquial Cantonese using appropriate linguistic knowledge and tools.
- **Translation**: Use a dictionary-based approach or API (e.g., Google Translate fallback, but prefer offline dict for accuracy).
- **Grammar Analysis**: Use NLP libraries with Cantonese models or specialized Cantonese NLP tools for pattern detection.

### Error Handling
- **Invalid Chinese**: "Input contains invalid characters; please provide valid Chinese text."
- **Long Text**: Limit input to 500 characters; truncate or warn if exceeded.
- **Conversion Errors**: If a character cannot be converted, preserve the original and note it in the annotation.

### Best Practices
- Ensure translations are context-aware (e.g., "hai6" could be "係" (to be) or "係" (yes) based on context).
- Automatically convert standardized Chinese to natural colloquial Cantonese while preserving meaning.
- Output should be culturally sensitive and reflect natural Cantonese speech patterns.
- Use appropriate Cantonese particles and grammar structures automatically.
- Verify Jyutping accuracy using reliable dictionaries or databases.
- **NEVER annotate punctuation marks** - this is critical to avoid cluttering the output with unnecessary annotations.

### Correct vs Incorrect Formatting Examples

#### ❌ INCORRECT (Punctuation Annotated, No Line Breaks):
```
[你好] (nei5 hou2 - hello)[，] (， - ,)[我] (ngo5 - I)[係] (hai6 - am)[學生] (hok6 saang1 - student)[。] (。 - .)
```

#### ❌ INCORRECT (No Punctuation Annotation but No Line Breaks):
```
[拼搏] (ping3 bok3 - strive)[咗] (zo2 - completed action)[一輪] (jat1 leon4 - a while)，[呢] (ni1 - these)[幾年] (gei2 nin4 - recent years)[生活] (sang1 wut6 - life)[穩定] (wan2 ding6 - stable)，[兩個] (loeng5 go3 - two)[女] (neoi2 - daughters)[都] (dou1 - all)[上咗] (soeng5 zo2 - gone to)[小學] (siu2 hok6 - primary school)。
```

#### ✅ CORRECT (Punctuation Not Annotated, Proper Line Breaks):
```
[你好] (nei5 hou2 - hello)，
  [我] (ngo5 - I)[係] (hai6 - am)[學生] (hok6 saang1 - student)。

[拼搏] (ping3 bok3 - strive)[咗] (zo2 - completed action)[一輪] (jat1 leon4 - a while)，
  [呢] (ni1 - these)[幾年] (gei2 nin4 - recent years)[生活] (sang1 wut6 - life)[穩定] (wan2 ding6 - stable)，
  [兩個] (loeng5 go3 - two)[女] (neoi2 - daughters)[都] (dou1 - all)[上咗] (soeng5 zo2 - gone to)[小學] (siu2 hok6 - primary school)。
```

## Testing Examples

### Input 1: "今天天气很好。"

**Expected Output:**

**Converted Cantonese**: "今日天氣好好。"

**Annotated Text**: 

```
[今日] (gam1 jat6 - today)[天氣] (tin1 hei3 - weather)[好] (hou2 - very)[好] (hou2 - good)。
```

**Note**: Short sentence kept on one line. The period (。) is NOT annotated.

### Input 2: "这是我的书。"

**Expected Output:**

**Converted Cantonese**: "呢本係我嘅書。"

**Annotated Text**: 

```
[呢] (ne1 - this)[本] (bun2 - classifier)[係] (hai6 - is)[我] (ngo5 - my)[嘅] (ge3 - possessive particle)[書] (syu1 - book)。
```

**Note**: Short sentence kept on one line. The period (。) is NOT annotated.

### Input 3: "他去了澳洲考飞行执照，然后回到香港，在家人的支持下加入了课程。"

**Expected Output:**

**Converted Cantonese**: "佢去咗澳洲考飛行牌，然後返到香港，喺屋企人支持下加入咗課程。"

**Annotated Text**:

```
[佢] (keoi5 - he)[去咗] (heoi3 zo2 - went to)[澳洲] (ou3 zau1 - Australia)[考] (haau2 - take exam)[飛行牌] (fei1 hang4 paai4 - pilot license)，
  [然後] (jin4 hau6 - then)[返到] (faan1 dou3 - returned)[香港] (hoeng1 gong2 - Hong Kong)，
  [喺] (hai2 - at)[屋企人] (uk1 kei2 jan4 - family)[支持] (zi1 ci4 - support)[下] (haa5 - under)[加入咗] (gaa1 jap6 zo2 - joined)[課程] (fo3 cing4 - course)。
```

**Note**: Long sentence broken into multiple lines after each comma. Continuation lines are indented with 2 spaces.
