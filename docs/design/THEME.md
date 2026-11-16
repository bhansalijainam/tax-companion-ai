# Ledger & Saffron

*A custom theme made with Theme Factory's "create your own" process (from ComposioHQ/awesome-claude-skills) for a CA firm's tax workspace. Ink and paper suggest a well-kept ledger; saffron gives a warm Indian accent without reading as an alert colour.*

## Color palette

| Name | Hex | Role |
|---|---|---|
| **Ink Indigo** | `#16203f` | Sidebar, primary buttons, headings on light |
| **Saffron** | `#d9771f` | Brand mark and active navigation, always with ink text |
| **Deep Saffron** | `#a85512` | Accent text, links, highlighted borders, accent buttons (white text) |
| **Ledger Green** | `#2f7d5b` | Savings, verified citations, completed steps |
| **Warm Paper** | `#faf7f0` | Page background |
| **Card** | `#fffdf8` | Cards and tables |
| **Ink Text** | `#1c2333` | Body text |
| **Slate** | `#5b6275` | Secondary text |
| **Vermilion** | `#b42a1f` | Errors, high-priority flags |
| **Turmeric** | `#94600a` | Warnings, medium priority |

Dark mode: background `#0f1427`, cards `#161d36`, text `#ece6d8`, saffron `#e8913f`, green `#5bbf94`.

## Typography

- **Headers:** Fraunces (variable serif, 600). It gives page titles and figures the feel of a professional document.
- **Body and UI:** Inter (400/500/600).
- **Numbers:** Inter with `tabular-nums`, so rupee columns line up.

## Contrast (WCAG 2.1, checked)

| Pair | Ratio | |
|---|---|---|
| Ink Text on Paper | 14.7 | AAA |
| Slate on Card | 6.0 | AA |
| Deep Saffron on Card | 5.2 | AA |
| White on Deep Saffron | 5.3 | AA |
| Ink on Saffron | 5.0 | AA |
| Ledger Green on Card | 4.9 | AA |
| Vermilion on Card | 6.3 | AA |
| Turmeric on Card | 5.3 | AA |
| *Saffron on Paper* | *3.0* | *fails for text, so raw saffron is never used for text on light backgrounds* |
| Dark: Slate on Card / Saffron on Card | 7.3 / 6.8 | AA |

## Best used for

Professional-services tools where trust and dense numbers matter: tax, audit, accounting and compliance dashboards.
