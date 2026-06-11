# Atelier Deep Research: Algorithms, Papers & Techniques for AI Web Design Generation

Last updated: 2026-03-30

This document catalogs research papers, algorithms, and implementable techniques across every dimension relevant to Atelier's AI-powered web design generation pipeline.

---

## Table of Contents

1. [Layout Generation Algorithms](#1-layout-generation-algorithms)
2. [Design Quality Metrics & Scoring](#2-design-quality-metrics--scoring)
3. [Visual Hierarchy & Attention Prediction](#3-visual-hierarchy--attention-prediction)
4. [Colour Science & Palette Generation](#4-colour-science--palette-generation)
5. [Typography & Font Pairing](#5-typography--font-pairing)
6. [Brand Consistency & Design Systems](#6-brand-consistency--design-systems)
7. [Conversion Rate Optimization (CRO) Patterns](#7-conversion-rate-optimization-cro-patterns)
8. [AI Generation: Screenshot-to-Code & Layout-Aware Models](#8-ai-generation-screenshot-to-code--layout-aware-models)
9. [Retrieval-Augmented Generation for Design](#9-retrieval-augmented-generation-for-design)
10. [Design Critique & Automated Review](#10-design-critique--automated-review)
11. [Accessibility & WCAG Automation](#11-accessibility--wcag-automation)
12. [Performance & Technical Quality](#12-performance--technical-quality)
13. [Canvas, Collaboration & Editing](#13-canvas-collaboration--editing)
14. [Implementable Algorithms Summary](#14-implementable-algorithms-summary)

---

## 1. Layout Generation Algorithms

### 1.1 Diffusion-Based Layout Generation

**LACE (LAyout Constraint diffusion modEl)** -- ICLR 2024
- Authors: Chen et al.
- Uses continuous diffusion (not discrete) to handle layout generation with differentiable aesthetic constraint functions
- Key innovation: Global alignment loss + pairwise overlap loss as constraint functions during training and post-processing
- Reparameterization technique to compute layout prediction as target for constraint functions
- SOTA on Rico and PubLayNet datasets for unconditional/conditional generation
- Metrics: FID, Alignment, MaxIoU
- Code: https://github.com/puar-playground/LACE
- **Atelier relevance**: The alignment and overlap constraint functions could be applied as a post-processing step to generated layouts to enforce grid alignment

**LayoutDM (Transformer-based Diffusion Model for Layout Generation)** -- CVPR 2023
- Authors: Chai et al.
- Conditional denoising diffusion probabilistic model with purely transformer-based architecture
- Unified model for various generation conditions using discrete diffusion framework
- Paper: https://arxiv.org/abs/2305.02567

**LayoutDiffusion** -- ICCV 2023
- Authors: Zhang, Guo et al. (Microsoft Research Asia + Shanghai Jiao Tong)
- Discrete denoising diffusion process for layout generation
- Plug-and-play conditional generation without retraining
- Larger transformer backbone significantly improves alignment and overlap metrics

**DogLayout** -- 2024
- Denoising Diffusion GAN combining discrete and continuous layout generation
- Merges advantages of both diffusion paradigms
- Paper: https://arxiv.org/abs/2412.00381

**LayoutDiT** -- 2024 (Tsinghua / Tencent / HKUST)
- Diffusion Transformer exploring content-graphic balance in layout generation
- Paper: https://arxiv.org/abs/2407.15233

**UniLayDiff** -- 2024
- Unified Diffusion Transformer for content-aware layout generation
- Paper: https://arxiv.org/abs/2512.08897

### 1.2 LLM-Based Layout Generation

**LayoutNUWA** -- ICLR 2024
- First model treating layout generation as a code generation task
- Three modules: Code Initialization (CI), Code Completion (CC), Code Rendering (CR)
- Uses HTML code with strategically placed masks; LLM fills in masked portions
- 50%+ improvement over baselines on Rico, PubLayNet, Magazine datasets
- Autoregressive (slower but leverages LLM formatting knowledge)
- Code: https://github.com/ProjectNUWA/LayoutNUWA
- **Atelier relevance**: Directly applicable -- treats layout as HTML code generation, which is exactly what Atelier does. The mask-and-complete approach could improve component placement

**LayoutGPT** -- NeurIPS 2023
- Authors: Feng et al.
- LLMs as visual planners generating layouts from text conditions
- In-context visual demonstrations encoded in CSS format
- Outperforms text-to-image models by 20-40% on spatial/numerical correctness
- Works across 2D images and 3D scenes
- Code: https://github.com/weixi-feng/LayoutGPT
- **Atelier relevance**: The CSS-format in-context learning approach could be used to provide layout examples to the generation LLM

**LayoutPrompter** -- NeurIPS 2023
- Awakening design ability in LLMs via structured prompting

**TextLap** -- EMNLP 2024
- Customizing language models for text-to-layout planning
- Paper: https://arxiv.org/abs/2410.12844

**Empowering LLMs for Multi-Page Layout Generation** -- CIKM 2024
- Consistency-oriented in-context learning for multi-page layouts
- **Atelier relevance**: Directly addresses multi-page design consistency, a core Atelier feature

### 1.3 Content-Aware Layout Generation

**PosterLlama** -- ECCV 2024
- Reformats layout elements into HTML code
- Leverages design knowledge within language models
- Supports image-conditioned layout generation with category/size conditions
- Website: https://lait-cvlab.github.io/PosterLlama/
- **Atelier relevance**: Image-conditioned generation could help lay out content around hero images

**RALF (Retrieval-Augmented Layout Transformer)** -- CVPR 2024 (Oral)
- Authors: Horita, Inoue, Kikuchi, Yamaguchi, Aizawa (CyberAgent AI Lab)
- Retrieves nearest-neighbor layout examples based on input image, feeds into autoregressive generator
- Constraint serialization for user-specified requirements
- Trained on 3,000 samples outperforms baseline trained on 7,734 samples
- Code: https://github.com/CyberAgentAILab/RALF
- **Atelier relevance**: CRITICAL -- this is RAG for layout generation. Could retrieve similar website layouts from a database when generating new designs

**Uni-Layout** -- ACM MM 2025
- Authors: Shuo Lu et al. (CASIA / JD.COM)
- Unified generation + evaluation + alignment framework
- Layout-HF100k dataset: 100,000 expertly annotated layouts (first large-scale human feedback dataset)
- Human-mimicking evaluator: dual-branch (visual + geometric), Chain-of-Thought across 4 stages
- Dynamic-Margin Preference Optimization (DMPO) for alignment
- Evaluator accuracy: 85.5% (vs GPT-4o 61.6%, Claude 3.5 57.8%)
- Human pass rate: 67.4% (+4.8pp over SOTA)
- **Atelier relevance**: The evaluator could serve as a quality gate for generated layouts

### 1.4 Constraint-Based and Graph-Based Approaches

**Generative Layout Modeling using Constraint Graphs** -- ICCV 2021
- Authors: Para, Guerrero et al.
- Three-step: generate layout elements as graph nodes, compute constraints as edges, solve via constrained optimization
- Paper: https://openaccess.thecvf.com/content/ICCV2021

**Graph-Constrained GANs**
- Knowledge graphs encoding domain-specific constraints
- Generate floor plans with realism, diversity, and conformity to design principles
- Applicable to web layout generation with web-specific constraint graphs

### 1.5 Grid Systems & Spacing Algorithms

**8-Point Grid System**: Multiples of 8 (8, 16, 24, 32...) for all spacing. Highly divisible, aligns with device pixel ratios. Used by Material Design, most modern design systems.

**4-Point Grid System**: Multiples of 4 for finer control. Better for mobile/web where precise spacing matters.

**Key Rule**: Internal spacing <= External spacing. The space around elements (external) should be >= space within them (internal).

**Implementable Algorithm**:
```
spacing_scale = [4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128]
// For any two elements:
// if elements are WITHIN same group: use smaller spacing values
// if elements are BETWEEN groups: use larger spacing values
// Enforce: padding(element) <= margin(element)
```

---

## 2. Design Quality Metrics & Scoring

### 2.1 Layout Quality Metrics

From layout generation research, the standard metrics are:

| Metric | What It Measures | How to Compute |
|--------|-----------------|----------------|
| **FID (Frechet Inception Distance)** | Distribution similarity between generated and real layouts | Compare feature distributions from a trained layout encoder |
| **Alignment** | How well elements align to a grid/each other | Measure edge/center deviations from nearest grid lines |
| **Overlap (MaxIoU)** | Unwanted element overlapping | Compute IoU between all element pairs; penalize non-zero |
| **TreeBLEU** | Structural hierarchy recall for HTML | Compare DOM tree structure (WebCode2M metric) |
| **Visual Similarity (CLIP)** | Overall visual match | CLIP embedding cosine similarity between generated and reference |

### 2.2 CSS Code Quality

**Abstractness Factor** (IEEE, Keller & Nussbaumer, 2010)
- Measures the ratio of CSS selectors used as reusable abstractions vs. inline/specific styles
- Higher abstractness = better maintainability and reusability
- Human-authored CSS consistently scores higher than machine-generated
- **Atelier relevance**: Can score generated Tailwind output for class reuse patterns

### 2.3 Semantic HTML Quality Metrics (from LLM evaluation research, 2025)

**Multi-Dimensional Framework** (Evaluating Generative AI for HTML Development, MDPI):
- Validation (W3C compliance)
- Semantic accuracy (proper use of header, nav, main, article, section, aside, footer)
- Accessibility (ARIA, alt text, contrast)
- Efficiency (DOM depth, redundant wrappers)
- Readability (code formatting, comments)
- SEO optimization (meta tags, heading hierarchy)

**Key Finding**: Claude produces the most consistently valid HTML; ChatGPT excels at semantic structure but at cost of efficiency.

---

## 3. Visual Hierarchy & Attention Prediction

### 3.1 Saliency Prediction Models

**TranSalNet** (Neurocomputing, 2022)
- Authors: Lou et al.
- Hybrid CNN + Transformer architecture
- Extracts 3 feature maps at different spatial sizes from CNN encoder
- 3 transformer encoders add long-range context
- CNN decoder fuses for final saliency map
- Two variants: ResNet-50 backbone or DenseNet-161 backbone
- SOTA on MIT300 benchmark and SALICON challenge
- Code: https://github.com/LJOVO/TranSalNet
- **Atelier relevance**: Run on generated pages to verify visual hierarchy -- CTA should have highest saliency

**Gender-Aware Web Saliency** (Brain Informatics, 2025)
- Fine-tuned TranSalNet on WIC640 dataset (640 web pages, 85 participants)
- Revealed age/gender-based attention variations
- Older users engage more with text; younger users with images

**Deep Learning Framework for News Interfaces** (arXiv, March 2025)
- Enhances SaRa (Saliency Ranking) model with DeepGaze IIE
- 10.7% improvement in Salient Object Ranking
- Validated with eye-tracking (30 participants) + mouse-tracking (375 participants)

**SUM (Saliency Unification through Mamba)** -- WACV 2025
- Uses Mamba architecture for efficient long-range information capture
- Conditional Visual State Space block separates distributions of different data types
- Robust across natural scenes, e-commerce imagery, and UIs

### 3.2 Eye Tracking Patterns

**F-Pattern** (Nielsen Norman Group, 2006; 232 users, thousands of pages)
- Horizontal sweep across top, shorter horizontal sweep below, vertical scan down left edge
- Emerges as a "failure state" when pages lack clear visual hierarchy
- **Atelier use**: Ensure generated pages have clear headings/hierarchy to prevent F-pattern degradation

**Z-Pattern**
- For landing pages, homepages, minimal-text pages
- Eye follows: top-left -> top-right -> diagonal -> bottom-left -> bottom-right
- **Atelier use**: Place logo top-left, CTA top-right or bottom-right for landing pages

### 3.3 Attention Prediction Tools (Commercial)

- **Attention Insight**: AI trained on millions of eye-tracking fixations, up to 95% accuracy predicting first 3-5 seconds of attention
- **Brainsight**: AI heatmaps for instant predictive eye-tracking
- **Atelier potential**: Integrate a saliency model to score generated pages before delivery

---

## 4. Colour Science & Palette Generation

### 4.1 OKLCH Color Space

OKLCH (Oklab Lightness-Chroma-Hue) is the recommended perceptual color space for design systems:
- L: perceived lightness (0-1)
- C: chroma/saturation (0 to ~0.4 for displayable colors)
- H: hue angle (0-360)

**Key properties**:
- Perceptually uniform: equal changes in L produce equal perceived brightness changes across all hues
- Same lightness value across different hues = same perceived brightness
- If lightness difference is constant, contrast ratio remains constant regardless of hue
- Supported in CSS: `oklch(0.7 0.15 180)`

**Palette Generation Algorithm** (from Evil Martians, Stripe, Ant Design):
```
Given brand_color in OKLCH:
1. Extract hue (H) and base chroma (C)
2. Generate 10-15 step scale by:
   - Keeping H constant
   - Varying L from 0.98 (lightest) to 0.15 (darkest)
   - Varying C: low at extremes, peak at mid-lightness
3. For accessibility: any two colors with L difference >= 0.40 will meet 4.5:1 contrast
4. Generate semantic tokens:
   - background: L=0.98, C=0.01
   - surface: L=0.95, C=0.02
   - text: L=0.20, C=0.02
   - primary: brand_color
   - primary-hover: L-0.05 from primary
```

**Stripe/USWDS Rule**: When scale numbers differ by 500+, those colors meet AA contrast ratio (4.5:1).

**Ant Design Algorithm**: Single `colorPrimary` token triggers generation of entire palette group automatically.

### 4.2 Colour Harmony Algorithms

**Huemint** (ML-based palette generator) -- https://huemint.com
- Trained on 1.2 million flat-color design images
- Uses CIE Lab color space + CIE Delta-E for contrast relationships
- Encodes color relationships as weighted adjacency matrix (contrast graph)
- Three models:
  1. **Transformer**: Colors quantized to 4,096-token codebook via K-means; encoder-decoder with top-p sampling (0.8)
  2. **Diffusion (DDPM)**: Generates "12-pixel images" representing palettes; category embedding swapped for adjacency matrix projection
  3. **Random baseline**: Samples from designer distribution, returns top 1% matching contrast requirements
- Temperature controls diversity (low = statistically probable, high = creative)
- **Atelier relevance**: The contrast-graph approach could generate palettes that maintain required contrast between all UI element pairs (background-text, button-text, etc.)

**Color Palette Generation Review** (Color Research & Application, Gao 2025)
- Comprehensive review of histogram-based, clustering-based, and neural network-based methods
- K-Means with WCSS is superior for extracting dominant colors

**Palette Discriminability** (Westland, 2024, Color Research & Application)
- Novel palette-difference metric based on Hungarian algorithm
- Compared to minimum color difference model (MICD)
- **Atelier relevance**: Score whether generated palettes have sufficient discriminability between UI states

**Geometric Harmony Models**
- Colors on the surface of a quad on the color wheel produce harmonious schemes
- Interactive methods using familial factors and rhythmic spans (Hu, 2014)
- Palette extension: 3 colors -> 5 or 7 while retaining harmony

### 4.3 Color Accessibility

**APCA (Accessible Perceptual Contrast Algorithm)** -- WCAG 3.0 candidate
- Created by Andrew Somers (Myndex)
- Reports contrast as Lc (Lightness Contrast) value, 0 to +/-106
- Key thresholds:
  - **Lc 90**: Preferred for body text / columns
  - **Lc 75**: Minimum for body text columns
  - **Lc 60**: Minimum for content text (non-body)
  - **Lc 45**: Minimum for large/heavy text (headlines)
  - **Lc 30**: Minimum for non-text elements
- Unlike WCAG 2.x: swapping text/background changes the score
- Accounts for font size AND weight (not just a single ratio)
- Perceptually uniform across all hue/lightness combinations
- Implementation: https://github.com/Myndex/SAPC-APCA
- Sass implementation: https://github.com/gfellerph/sass-apca
- **Atelier relevance**: Replace WCAG 2.x contrast checking with APCA for more accurate, font-size-aware contrast validation

**Context-Adaptive Color Optimization** (arXiv:2512.07623, Dec 2025)
- Author: Lalitha A R
- OKLCH-based accessibility optimization with adaptive constraint strategies
- Mode 1 (Recursive): 93.68% success on all color pairs, 100% on reasonable pairs (+27pp over strict mode)
- Mode 2 (Relaxed Fallback): 98.73% overall success
- Preserves absolute hue while adjusting lightness/chroma for contrast
- Median perceptual change = 0 (most colors already compliant)
- Deployed in CM-Colors v0.5.0 (800+ monthly downloads)
- **Atelier relevance**: CRITICAL -- automatically adjust generated color pairs to meet contrast requirements while preserving brand hue

---

## 5. Typography & Font Pairing

### 5.1 Font Pairing Research

**"Typeface network and the principle of font pairing"** (Scientific Reports, Dec 2024)
- Authors: Researchers from Hanyang University
- Data-driven approach using comprehensive dataset of font-use cases across mediums
- **Non-negative Matrix Factorization (NMF)** extracts fundamental morphological characteristics:
  1. Serif vs. Sans-Serif
  2. Basic vs. Decorative letterforms
  3. Light vs. Bold
- Network analysis identifies authentic font pairings
- Top findings:
  - Most used: Helvetica, Futura, Univers
  - Top pairs: Futura-Futura Condensed, Futura-Helvetica, Helvetica-Times New Roman
  - Pairings vary by medium (web, print, advertising)
- **Atelier relevance**: Build a font pairing graph/network. For any detected heading font, suggest body fonts using network proximity scores

**Visual Font Pairing** (2019, ResearchGate)
- Explores visual similarity metrics for automated font pairing

### 5.2 Typographic Scale

**Modular Scale Algorithm**:
```
Given base_size (e.g., 16px) and ratio (e.g., 1.25 "major third"):
scale[n] = base_size * ratio^n

Common ratios:
- 1.067 Minor Second
- 1.125 Major Second
- 1.200 Minor Third
- 1.250 Major Third (recommended for web)
- 1.333 Perfect Fourth
- 1.414 Augmented Fourth
- 1.500 Perfect Fifth
- 1.618 Golden Ratio
```

### 5.3 Readability & Line Length

**Optimal Line Length Research** (Visible Language, 2005; Baymard Institute)
- Optimal: 50-75 characters per line (including spaces)
- Sweet spot: 66 characters per line
- Novice readers: 34-60 characters, ideal 45
- Too long: hard to track to next line
- Too short: disrupts reading rhythm

**Implementable Algorithm**:
```
Given font_size_px and container_width_px:
avg_char_width ≈ font_size_px * 0.5  // for most proportional fonts
chars_per_line = container_width_px / avg_char_width
if chars_per_line > 75: increase side padding or use max-width
if chars_per_line < 45: decrease side padding or increase container
target: max-width = 66 * avg_char_width
// In Tailwind: max-w-prose (65ch)
```

**Related Factors**: Font type, line-height (1.5-1.75 for body text), letter-spacing, contrast ratio all affect readability.

---

## 6. Brand Consistency & Design Systems

### 6.1 Design Token Architecture

**Three-Tier Token System**:
1. **Primitive tokens**: Raw values (colors, sizes, spacing). Reduce infinite possibilities to brand-relevant subset
2. **Semantic tokens**: Purpose-based naming (primary-action, success-state, surface-elevated). Reference primitives
3. **Component tokens**: Component-specific overrides (button-primary-bg, card-border-radius). Reference semantics

**Automated Token Generation** (from brand signals):
```
From crawled brand_colors:
1. Map each brand color to OKLCH
2. Generate 10-step lightness scale per color
3. Assign semantic roles:
   - Highest-contrast color -> text
   - Dominant brand color -> primary
   - Secondary brand color -> secondary or accent
   - Generate neutrals by desaturating primary hue
4. Generate spacing scale: [4, 8, 12, 16, 24, 32, 48, 64, 96] px
5. Generate border-radius scale based on brand personality:
   - "Rugged" persona -> 0-2px
   - "Sincere" persona -> 4-8px
   - "Exciting" persona -> 12-16px or full-round
```

### 6.2 Brand Consistency Scoring

**Key Metrics** (from brand assessment research):
- Brand guideline compliance rate (% of assets following standards)
- Visual consistency score (color accuracy, logo usage, typography adherence)
- Messaging alignment index (tone/language consistency)
- Compliance velocity (how quickly violations are addressed)

**Research Finding**: User testing across 240 participants showed layered approach with strict brand tokens but flexible layout tokens produced highest perceived consistency scores and task success rates.

### 6.3 AI-Powered Brand Analysis

**Carnegie Mellon (Jan 2024)**: Research on automating consistent product design -- using AI to recognize and enforce brand visual patterns.

**DesignKit** (open-source): Reverse-engineers design systems from live web applications. Extracts tokens, generates styleguides, builds packages from authenticated app UIs.
- GitHub: https://github.com/caio-overmind-ventures/designkit
- **Atelier relevance**: Similar approach to Atelier's URL crawling; could adopt their extraction methodology

### 6.4 Aaker Brand Personality Model

Atelier already uses this. The 5 dimensions:
1. **Sincerity** (down-to-earth, honest, wholesome, cheerful)
2. **Excitement** (daring, spirited, imaginative, up-to-date)
3. **Competence** (reliable, intelligent, successful)
4. **Sophistication** (upper class, charming)
5. **Ruggedness** (outdoorsy, tough)

**Enhancement opportunity**: Map each dimension to concrete design token ranges:
```
Sincerity: warm colors (hue 20-60), rounded corners (8-12px), serif fonts, earth tones
Excitement: vibrant saturated colors, dynamic layouts, bold sans-serif, high contrast
Competence: blue/navy palette, clean grid, systematic spacing, professional sans-serif
Sophistication: muted/deep tones, elegant serif, generous whitespace, gold/purple accents
Ruggedness: dark palette, sharp corners, heavy font weights, high texture contrast
```

---

## 7. Conversion Rate Optimization (CRO) Patterns

### 7.1 Evidence-Based Layout Patterns

**Single CTA Hero**: Simplifying multiple hero CTAs to one primary button increases conversions by up to 42% (HubSpot).

**Sticky Navigation**: Keep CTA visible as users scroll long-form content. Particularly effective on sales pages and documentation.

**Checkout Field Reduction**: Reducing from 8 to 4 fields drops abandonment ~20%, raises completion 25-30%.

**Performance Impact**: 1-second delay causes 7% drop in conversions (Akamai, 2024).

**Accessibility Premium**: Accessible sites outperform peers with 12% revenue advantage (Forrester).

### 7.2 Implementable CRO Rules for Generation

```
Rules for generated landing pages:
1. Single primary CTA above the fold
2. CTA button contrast ratio >= APCA Lc 60 against background
3. Hero section height <= 100vh (no scroll needed for core message)
4. Form fields <= 4 for conversion-focused pages
5. Social proof (testimonials/logos) within first 2 viewport heights
6. Sticky nav with CTA on scroll > 300px
7. Loading time target < 2.5s (LCP)
8. Personalization: 89% of marketers see positive ROI
```

---

## 8. AI Generation: Screenshot-to-Code & Layout-Aware Models

### 8.1 Benchmarks & Datasets

**Design2Code** -- NAACL 2024
- Authors: Chenglei Si, Yanzhe Zhang, Ryan Li, Zhengyuan Yang, Ruibo Liu, Diyi Yang
- First real-world benchmark: 484 diverse webpages
- Metrics: bounding box matches, text accuracy, element positioning, color fidelity, CLIP visual similarity
- Finding: Models mostly lag in recalling visual elements and generating correct layout designs

**WebCode2M** -- ACM Web Conference 2025
- 2.56 million real design-code pairs
- Real-world samples have 50x more tokens, 6x more tags, 2x DOM depth vs. synthetic data
- Introduces **TreeBLEU** metric for structural hierarchy recall
- Baseline WebCoder (ViT, Pix2Struct-1.3B) outperforms Design2Code-18B and WebSight VLM-8B across all metrics

**DesignBench** -- 2025
- Comprehensive benchmark for MLLM-based front-end code generation

**UI-Bench** -- 2025
- Benchmark for evaluating design capabilities of LLMs

**Web2Code** -- NeurIPS 2024
- Large-scale webpage-to-code dataset and evaluation framework

### 8.2 Screenshot-to-Code Approaches

**DCGen (Divide-and-Conquer)** -- ACM SE 2024/2025
- Divides screenshots into semantic segments
- Generates code per segment, reassembles
- 15% improvement in visual similarity, 8% in code similarity vs. baselines
- First segment-aware MLLM approach
- Code: https://github.com/WebPAI/DCGen
- **Atelier relevance**: When regenerating sections of a page, divide the screen into segments and generate individually

**UICopilot** -- ACM Web Conference 2025
- Hierarchical generation: coarse HTML structure first, then fine-grained implementation
- Outperforms GPT-4V in both automatic and human evaluations

**LaTCoder** -- 2025
- Layout-as-Thought approach: reasons about layout structure before generating code

**Sketch2Code** -- 2024
- Multi-turn interactive framework for converting sketches to code
- Evaluates VLMs on real-world webpage sketches

### 8.3 Generative UI (Google Research)

**"Generative UI: LLMs are Effective UI Generators"** (Google, 2025)
- Core principle: AI generates not just content, but the entire user experience
- Deployed in Gemini app ("dynamic view") and Google Search AI Mode
- Human raters strongly prefer generative UI over standard LLM text output
- Comparable to human-expert output in 44% of cases

**A2UI Framework** (Google, December 2025)
- Declarative data format for agent-driven interfaces
- Client maintains catalog of pre-approved UI components
- Agent can only request components from the catalog
- Ensures security while enabling dynamic generation
- **Atelier relevance**: Component library approach is similar -- LLM selects/composes from pre-approved components

**GenerativeGUI** -- CHI Extended Abstracts 2025
- LLMs dynamically generate GUIs as HTML for ongoing conversations
- Significant usability improvements in user studies

### 8.4 Layout Diffusion Models

**CreatiLayout** -- ICCV 2025
- Siamese Multimodal Diffusion Transformer for layout-to-image generation
- Precise spatial relationship and attribute rendering
- FLUX variant released March 2025

**LayoutFlow** -- ECCV 2024
- Flow matching for layout generation

---

## 9. Retrieval-Augmented Generation for Design

### 9.1 RAG for Layout (RALF)

See Section 1.3 above. RALF (CVPR 2024 Oral) is the seminal work applying RAG to layout generation.

Key insight: Retrieving similar layout examples dramatically improves generation quality. 3,000 training samples with retrieval > 7,734 without.

### 9.2 General RAG Architecture for Design

**Recommended Architecture for Atelier**:
```
1. INDEX: Embed all 52 design persona examples + component library into vector DB
   - Embed screenshots (CLIP embeddings)
   - Embed HTML structure (code embeddings)
   - Embed design tokens (structured metadata)

2. RETRIEVE: For new generation request:
   - Query vector DB with: brand personality vector + industry + page type
   - Retrieve top-K similar designs (K=3-5)
   - Retrieve matching components from component library

3. AUGMENT: Include retrieved examples in LLM prompt:
   - "Here are similar websites in this brand persona: [examples]"
   - "Use these components as building blocks: [components]"

4. GENERATE: LLM produces HTML/Tailwind with retrieved context
```

### 9.3 RAG Research Taxonomy

**"Retrieval-Augmented Generation: A Comprehensive Survey"** (arXiv:2506.00054, May 2025)
- Categorizes architectures: retriever-centric, generator-centric, hybrid, robustness-oriented
- Covers multimodal RAG systems

**"Enhancing RAG: A Study of Best Practices"** (arXiv:2501.07391, Jan 2025)
- Practical guidelines for RAG system design

---

## 10. Design Critique & Automated Review

### 10.1 UICrit -- UIST 2024 (Google Research)

- Authors: Peitong Duan, Chin-yi Chen, Gang Li, Bjoern Hartmann, Yang Li
- First targeted dataset of design critiques: 3,059 critiques from 7 professional designers for 983 mobile UIs
- Public version: 11,344 critiques
- Each critique includes natural language feedback + bounding box + quality rating
- **55% performance gain** in LLM-generated UI feedback using few-shot + visual prompting
- Three few-shot selection strategies:
  1. Random sampling
  2. Visual similarity (root mean square difference)
  3. Semantic similarity (CLIP)
- Dataset: https://github.com/google-research-datasets/uicrit
- **Atelier relevance**: CRITICAL -- fine-tune or few-shot an LLM to automatically critique generated designs before delivery. Use as quality gate

### 10.2 MLLM as UI Judge (2025)

- Benchmarks multimodal LLMs for predicting human perception of UIs
- Systematic evaluation of LLM ability to assess UI quality

### 10.3 AccessGuru -- ASSETS 2025

- Authors: Fathallah et al. (University of Southampton)
- Combines LLMs + accessibility testing tools (Axe-Playwright)
- Novel taxonomy: Syntactic, Semantic, and Layout violations
- 3,524 violations across 94 types
- Achieves 84% average violation score decrease (vs. 50% for prior methods)
- Two detectors: syntax/layout (Axe) + semantic (LLM)
- Corrective re-prompting for persistent violations
- Code: https://github.com/NadeenAhmad/AccessGuruLLM
- **Atelier relevance**: Run on every generated page to detect and auto-fix accessibility violations

### 10.4 LLM-Based WCAG Testing

**"Turning manual web accessibility success criteria into automatic: an LLM-based approach"** (Universal Access, 2024)
- Uses LLMs to automate WCAG success criteria that currently require manual testing
- Reduces time/cost of accessibility evaluation

**"Can generative AI create accessible web code?"** (Universal Access, 2025)
- Benchmark analysis of AI-generated HTML against accessibility standards
- Tests multiple AI generators

---

## 11. Accessibility & WCAG Automation

### 11.1 APCA Implementation

See Section 4.3 for full APCA details. Key implementation points:

```javascript
// APCA contrast calculation (simplified)
// Returns Lc value (0-106)
function apcaContrast(textColor, bgColor) {
  // 1. Linearize sRGB values
  // 2. Calculate luminance using APCA-specific coefficients
  // 3. Apply polarity-aware contrast formula
  // 4. Apply clamp and scale
  // Returns signed Lc value (polarity matters)
}

// Font size/weight lookup table for minimum Lc:
// 16px/400 -> Lc 75 minimum
// 24px/400 -> Lc 60 minimum
// 36px/700 -> Lc 45 minimum
// Non-text -> Lc 30 minimum
```

NPM: `apca-w3` package

### 11.2 Automated Color Adjustment

**CM-Colors Algorithm** (Context-Adaptive, 2025):
1. Take text color + background color pair
2. Check APCA contrast
3. If insufficient: adjust lightness in OKLCH while preserving hue
4. Recursive optimization achieves 93.68% success
5. Relaxed fallback for edge cases: 98.73% success

### 11.3 Semantic HTML Enforcement

**Automated checks for generated HTML**:
- Heading hierarchy (h1 > h2 > h3, no skips)
- Landmark regions (header, nav, main, footer, aside)
- Image alt text (never empty for informative images)
- Form labels (every input has associated label)
- ARIA attributes where semantic elements insufficient
- Link text (never "click here" or "read more" alone)
- Language attribute on html element
- Skip navigation link

---

## 12. Performance & Technical Quality

### 12.1 Critical CSS Extraction

**Algorithm**:
1. Load page in headless browser at target viewport (1280x720)
2. Identify all visible elements ("above the fold")
3. Trace computed styles back to source CSS rules
4. Extract minimal ruleset for visible elements
5. Inline critical CSS in `<head>` as `<style>` block
6. Load remaining CSS with `<link rel="preload" as="style">`
7. Add `<noscript>` fallback for non-JS environments

**Impact**: Significantly reduces LCP and FCP. Eliminates render-blocking CSS.

**For Atelier**: Since pages are generated, critical CSS can be computed at generation time. Split Tailwind output into critical (above-fold classes) and deferred.

### 12.2 Image Optimization Strategy

**Format Hierarchy**: AVIF > WebP > JPEG (with fallback)
- AVIF: 50% smaller than JPEG at same quality
- WebP: 25-35% smaller than JPEG

**Key Rules for Generated Pages**:
```html
<!-- Hero/LCP image: eager load with priority -->
<img src="hero.webp" fetchpriority="high" loading="eager"
     srcset="hero-375.webp 375w, hero-768.webp 768w, hero-1440.webp 1440w"
     sizes="100vw" alt="...">

<!-- Below-fold images: lazy load -->
<img src="photo.webp" loading="lazy" decoding="async"
     width="800" height="600" alt="...">

<!-- Always specify width/height to prevent CLS -->
```

**Images account for 40-70% of page weight** -- largest optimization opportunity.

### 12.3 Core Web Vitals Targets

| Metric | Good | Needs Improvement | Poor |
|--------|------|-------------------|------|
| LCP | < 2.5s | 2.5-4.0s | > 4.0s |
| INP | < 200ms | 200-500ms | > 500ms |
| CLS | < 0.1 | 0.1-0.25 | > 0.25 |

**Generated Page Optimization Checklist**:
- [ ] Critical CSS inlined, non-critical deferred
- [ ] LCP image has fetchpriority="high" and no lazy-loading
- [ ] All images have explicit width/height attributes
- [ ] Fonts preloaded with font-display: swap
- [ ] No render-blocking JavaScript
- [ ] Minimal DOM depth (< 32 levels)
- [ ] No excessive DOM size (< 1,500 elements ideally)

---

## 13. Canvas, Collaboration & Editing

### 13.1 Figma's Multiplayer Architecture

**Key Design Decisions**:
1. **Not OT, not pure CRDT**: Simpler hybrid approach
2. **Last-writer-wins per property**: Each object property resolved independently
3. **Fractional indexing for ordered sequences**:
   - Insert between objects A and B: new index = average(A, B)
   - Arbitrary-precision fractions (string-based) to prevent precision loss
   - All indices between 0 and 1 exclusive
4. **Server-authoritative**: Central server coordinates, but clients can work offline
5. **CRDT-inspired properties**: Associative, commutative, idempotent operations

### 13.2 Event Graph Walker (Eg-walker)

**Paper**: "Collaborative Text Editing with Eg-walker: Better, Faster, Smaller" (arXiv:2409.14252, 2024)
- Authors: Joseph Gentle, Martin Kleppmann
- Combines benefits of OT and CRDT
- Uses simple indices for storage; temporarily constructs CRDT during merging
- Analogous to git rebase: rearranges divergent branches into linear order
- After merge resolution, discards internal CRDT (freeing memory)
- **Performance**: Order of magnitude less memory than CRDTs; orders of magnitude faster branch merging than OT
- Adopted by Figma for code layers collaboration
- **Atelier relevance**: If building collaborative canvas editing, Eg-walker is the state-of-the-art algorithm

### 13.3 Smart Snapping Algorithm

**Implementation Approach** (from Fabric.js SnappyRect + Figma/Snapied patterns):
```
When moving element E:
1. Collect all other elements' edges and centers
2. For each reference point (edge/center) of E:
   a. Find nearest matching reference point within threshold (e.g., 8px)
   b. If found: snap E to that position, show guide line
3. Priority: center alignment > edge alignment > grid alignment
4. Multi-snap: simultaneously snap X and Y independently
5. Equal spacing: detect and snap to maintain equal gaps between elements

Reference points:
- Left edge, right edge, horizontal center
- Top edge, bottom edge, vertical center
- Canvas edges, safe area boundaries
- Grid lines (8px grid)
```

### 13.4 Version Diffing for Visual Designs

**Approaches**:
1. **Structural diff**: Compare DOM trees (similar to TreeBLEU metric from WebCode2M)
2. **Visual diff**: Pixel-level comparison of rendered screenshots (perceptual hash or SSIM)
3. **Token diff**: Compare design token JSON (standard JSON diff)
4. **Semantic diff**: LLM-based comparison describing changes in natural language

---

## 14. Implementable Algorithms Summary

Ranked by estimated impact for Atelier:

### Tier 1: High Impact, Moderate Effort

| Algorithm | Source | Impact | Effort |
|-----------|--------|--------|--------|
| OKLCH palette generation from brand colors | Stripe/USWDS/Ant Design | Vastly better color systems | Medium |
| APCA contrast checking (replace WCAG 2.x ratios) | Myndex SAPC-APCA | More accurate accessibility | Low |
| Context-adaptive color adjustment | CM-Colors v0.5.0 | Auto-fix contrast violations | Low |
| RAG for layout generation (RALF approach) | CVPR 2024 | Better layout quality via retrieval | High |
| UICrit-based quality gate | UIST 2024 | Automated design critique before delivery | Medium |
| Typographic scale algorithm | Modular scale theory | Consistent type hierarchy | Low |
| Readability constraints (45-75 char line length) | Baymard / Visible Language | Better text readability | Low |
| CRO rules (single CTA, sticky nav) | HubSpot / Akamai | Higher conversion layouts | Low |

### Tier 2: High Impact, Higher Effort

| Algorithm | Source | Impact | Effort |
|-----------|--------|--------|--------|
| Layout diffusion with aesthetic constraints (LACE) | ICLR 2024 | Aligned, non-overlapping layouts | High |
| Saliency prediction (TranSalNet) | MIT300/SALICON | Verify visual hierarchy | High |
| HTML-as-code layout generation (LayoutNUWA) | ICLR 2024 | Better layout structure | High |
| Uni-Layout evaluator | ACM MM 2025 | Human-level layout quality scoring | High |
| AccessGuru violation detection/correction | ASSETS 2025 | Comprehensive accessibility | Medium |
| DCGen divide-and-conquer code generation | ACM SE 2024 | Better complex page generation | Medium |

### Tier 3: Strategic / Future

| Algorithm | Source | Impact | Effort |
|-----------|--------|--------|--------|
| Eg-walker collaborative editing | Gentle & Kleppmann 2024 | Multiplayer canvas editing | Very High |
| Font pairing network (NMF) | Scientific Reports 2024 | Data-driven font suggestions | Medium |
| Huemint contrast-graph palette generation | Huemint.com | Context-aware palettes | High |
| Gestalt proximity computational model | JOV 2020 | Automated grouping validation | High |
| Design token extraction from screenshots | Codia VisualStruct | Reverse-engineer any design | High |
| Generative UI component catalog (A2UI) | Google 2025 | Agent-driven interface composition | High |

---

## Key Paper References

1. LACE - https://arxiv.org/abs/2402.04754 (ICLR 2024)
2. LayoutNUWA - https://arxiv.org/abs/2309.09506 (ICLR 2024)
3. LayoutGPT - https://github.com/weixi-feng/LayoutGPT (NeurIPS 2023)
4. RALF - https://arxiv.org/abs/2311.13602 (CVPR 2024 Oral)
5. Uni-Layout - https://arxiv.org/abs/2508.02374 (ACM MM 2025)
6. UICrit - https://arxiv.org/abs/2407.08850 (UIST 2024)
7. Design2Code - https://arxiv.org/abs/2403.03163 (NAACL 2024)
8. WebCode2M - https://arxiv.org/abs/2404.06369 (ACM Web 2025)
9. DCGen - https://arxiv.org/abs/2406.16386 (ACM SE 2024)
10. TranSalNet - https://arxiv.org/abs/2110.03593 (Neurocomputing 2022)
11. SUM - WACV 2025
12. Eg-walker - https://arxiv.org/abs/2409.14252 (2024)
13. AccessGuru - https://arxiv.org/abs/2507.19549 (ASSETS 2025)
14. CM-Colors Accessibility - https://arxiv.org/abs/2512.07623 (2025)
15. Font Pairing Networks - https://www.nature.com/articles/s41598-024-81601-w (Sci Reports 2024)
16. PosterLlama - ECCV 2024
17. Generative UI - https://generativeui.github.io/ (Google 2025)
18. LayoutDM - https://arxiv.org/abs/2305.02567 (CVPR 2023)
19. DogLayout - https://arxiv.org/abs/2412.00381 (2024)
20. LayoutDiT - https://arxiv.org/abs/2407.15233 (2024)

---

## Sources

- [LACE - ICLR 2024](https://arxiv.org/abs/2402.04754)
- [LayoutNUWA - ICLR 2024](https://arxiv.org/abs/2309.09506)
- [LayoutGPT - NeurIPS 2023](https://layoutgpt.github.io/)
- [RALF - CVPR 2024](https://github.com/CyberAgentAILab/RALF)
- [Uni-Layout - ACM MM 2025](https://arxiv.org/abs/2508.02374)
- [UICrit - UIST 2024](https://arxiv.org/abs/2407.08850)
- [Design2Code - NAACL 2024](https://arxiv.org/abs/2403.03163)
- [WebCode2M - ACM Web 2025](https://arxiv.org/abs/2404.06369)
- [DCGen](https://arxiv.org/abs/2406.16386)
- [UICopilot - ACM Web 2025](https://dl.acm.org/doi/10.1145/3696410.3714891)
- [TranSalNet](https://arxiv.org/abs/2110.03593)
- [Gender-Aware Web Saliency 2025](https://link.springer.com/article/10.1186/s40708-025-00274-x)
- [SUM - WACV 2025](https://openaccess.thecvf.com/content/WACV2025/papers/Hosseini_SUM_Saliency_Unification_through_Mamba_for_Visual_Attention_Modeling_WACV_2025_paper.pdf)
- [Huemint](https://huemint.com/about/)
- [Color Palette Generation Review - Gao 2025](https://onlinelibrary.wiley.com/doi/full/10.1002/col.22975)
- [Palette Discriminability - Westland 2024](https://onlinelibrary.wiley.com/doi/full/10.1002/col.22927)
- [APCA / SAPC](https://github.com/Myndex/SAPC-APCA)
- [CM-Colors Accessibility Optimization](https://arxiv.org/abs/2512.07623)
- [OKLCH in CSS - Evil Martians](https://evilmartians.com/chronicles/oklch-in-css-why-quit-rgb-hsl)
- [Font Pairing Networks - Scientific Reports 2024](https://www.nature.com/articles/s41598-024-81601-w)
- [Readability Line Length - Baymard](https://baymard.com/blog/line-length-readability)
- [Optimal Line Length - Visible Language 2005](https://journals.uc.edu/index.php/vl/article/view/5765)
- [CRO Layout Patterns - Anchor Points](https://www.anchorpoints.io/blogs/cro-web-design-12-layout-patterns-consistently-lift-conversions)
- [F-Pattern - Nielsen Norman Group](https://www.nngroup.com/articles/f-shaped-pattern-reading-web-content/)
- [Generative UI - Google Research](https://research.google/blog/generative-ui-a-rich-custom-visual-interactive-user-experience-for-any-prompt/)
- [A2UI - Google Developers](https://developers.googleblog.com/introducing-a2ui-an-open-project-for-agent-driven-interfaces/)
- [Eg-walker](https://arxiv.org/abs/2409.14252)
- [Figma Multiplayer](https://www.figma.com/blog/how-figmas-multiplayer-technology-works/)
- [Figma Fractional Indexing](https://www.figma.com/blog/realtime-editing-of-ordered-sequences/)
- [Figma Code Layers](https://www.figma.com/blog/building-figmas-code-layers/)
- [AccessGuru - ASSETS 2025](https://arxiv.org/abs/2507.19549)
- [Evaluating GenAI HTML - MDPI](https://www.mdpi.com/2227-7080/13/10/445)
- [AI-Generated HTML Accessibility Benchmark](https://link.springer.com/article/10.1007/s10209-025-01250-2)
- [CSS Abstractness Metric - IEEE](https://ieeexplore.ieee.org/document/5654791/)
- [Awesome Layout Generation](https://github.com/wd1511/Awesome-Layout-Generation)
- [Awesome Layout Generators](https://github.com/JosephKJ/Awesome-Layout-Generators)
- [8pt Grid System](https://www.thedesignership.com/blog/the-ultimate-spacing-guide-for-ui-designers)
- [Spacing, Grids, and Layouts](https://www.designsystems.com/space-grids-and-layouts/)
- [DesignKit](https://github.com/caio-overmind-ventures/designkit)
- [Gestalt Proximity Computational Model](https://jov.arvojournals.org/article.aspx?articleid=2772625)
- [PosterLlama - ECCV 2024](https://lait-cvlab.github.io/PosterLlama/)
- [Attention Insight](https://attentioninsight.com/)
- [LaTCoder 2025](https://dl.acm.org/doi/pdf/10.1145/3711896.3737016)
- [Sketch2Code](https://arxiv.org/abs/2410.16232)
- [DesignBench](https://arxiv.org/abs/2506.06251)
- [Smart Snapping in Fabric.js](https://hackernoon.com/mastering-object-snapping-in-fabricjs-introducing-the-snappyrect-class)
- [Khroma AI Color Tool](https://www.khroma.co/)
