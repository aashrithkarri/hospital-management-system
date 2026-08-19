---
name: Clinical Clarity
colors:
  surface: '#f8f9fa'
  surface-dim: '#d9dadb'
  surface-bright: '#f8f9fa'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f4f5'
  surface-container: '#edeeef'
  surface-container-high: '#e7e8e9'
  surface-container-highest: '#e1e3e4'
  on-surface: '#191c1d'
  on-surface-variant: '#424752'
  inverse-surface: '#2e3132'
  inverse-on-surface: '#f0f1f2'
  outline: '#727783'
  outline-variant: '#c2c6d4'
  surface-tint: '#005db6'
  primary: '#00478d'
  on-primary: '#ffffff'
  primary-container: '#005eb8'
  on-primary-container: '#c8daff'
  inverse-primary: '#a9c7ff'
  secondary: '#006a6a'
  on-secondary: '#ffffff'
  secondary-container: '#8cf3f3'
  on-secondary-container: '#007070'
  tertiary: '#41484f'
  on-tertiary: '#ffffff'
  tertiary-container: '#596067'
  on-tertiary-container: '#d4dbe2'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d6e3ff'
  primary-fixed-dim: '#a9c7ff'
  on-primary-fixed: '#001b3d'
  on-primary-fixed-variant: '#00468c'
  secondary-fixed: '#8cf3f3'
  secondary-fixed-dim: '#6fd7d6'
  on-secondary-fixed: '#002020'
  on-secondary-fixed-variant: '#004f4f'
  tertiary-fixed: '#dce3eb'
  tertiary-fixed-dim: '#c0c7cf'
  on-tertiary-fixed: '#151c22'
  on-tertiary-fixed-variant: '#40484e'
  background: '#f8f9fa'
  on-background: '#191c1d'
  surface-variant: '#e1e3e4'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.01em
  caption:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  container-max: 1280px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 40px
---

## Brand & Style
The brand personality is defined by the intersection of clinical precision and human empathy. The target audience includes patients seeking urgent care, families researching long-term treatments, and medical professionals. The UI must evoke a sense of calm, reliability, and immediate clarity.

This design system utilizes a **Modern Corporate** style with elements of **Minimalism**. It prioritizes heavy whitespace to reduce cognitive load and uses high-quality, professional photography. Visual noise is eliminated to ensure that critical medical information is easily scannable. The aesthetic is "uncluttered," using subtle tonal changes rather than aggressive borders to define structure.

## Colors
The palette is anchored by "Healing Blue" (#005EB8), a deep, authoritative blue used for primary actions and brand identity. "Trust Teal" (#008B8B) serves as a secondary color for navigation accents and supporting information. 

The background strategy relies on a "Soft Gray" (#F8F9FA) for page-level surfaces to reduce glare, while pure white (#FFFFFF) is reserved for card surfaces and interactive containers to create a "lifted" effect. Functional colors (Success, Warning, Error) must be highly saturated to ensure accessibility against the soft neutral backgrounds.

## Typography
Inter is used across all levels to maintain a systematic and utilitarian feel. The hierarchy is intentionally steep to ensure that page headers are immediately distinguishable from dense medical text. 

For body content, a slightly increased line height (1.5x) is applied to enhance readability for elderly or vision-impaired users. Labels and captions use a medium weight to maintain legibility at smaller scales. All links within body text should be underlined or styled in the primary color to ensure they are accessible.

## Layout & Spacing
The design system employs a **Fixed Grid** model for desktop, centered within the viewport at a maximum width of 1280px. This ensures that line lengths for medical articles do not become too wide, which hinders readability. 

A 12-column grid is used for desktop, transitioning to a 4-column grid for mobile. Vertical rhythm is strictly enforced using an 8px base unit. Section spacing should be generous (80px–120px) to provide "breathing room" between different medical services or departments, preventing the interface from feeling cramped or stressful.

## Elevation & Depth
Depth is conveyed through **Tonal Layers** and extremely **Ambient Shadows**. Surfaces should not appear to "float" high above the background; instead, they should feel firmly grounded.

- **Level 0 (Background):** Soft Gray (#F8F9FA), flat.
- **Level 1 (Cards/Containers):** Pure White (#FFFFFF) with a 1px border of #E9ECEF or a very soft, diffused shadow (0px 2px 10px rgba(0, 0, 0, 0.05)).
- **Level 2 (Dropdowns/Modals):** Pure White with a more pronounced shadow (0px 10px 30px rgba(0, 0, 0, 0.08)) to indicate a high-priority interaction layer.

Avoid using high-contrast borders; instead, use subtle shifts in background color to define different content zones.

## Shapes
A **Rounded** (0.5rem) shape language is used to soften the clinical nature of the content, making the brand feel more approachable and empathetic. 

Standard components like buttons and input fields use the 0.5rem (8px) radius. Larger containers, such as doctor profile cards or appointment booking modules, should use `rounded-lg` (1rem) to create a friendly, modern appearance. Completely circular "pill" shapes are reserved exclusively for status indicators and tags.

## Components
- **Buttons:** Primary buttons use "Healing Blue" with white text. They must have a minimum height of 48px to ensure a large hit target. Secondary buttons use a "Trust Teal" outline or ghost style.
- **Doctor Profile Cards:** These should feature a prominent circular or soft-square avatar, the doctor's name in `headline-md`, and a clear "Book Appointment" primary button.
- **Forms:** Input fields must have clear, persistent labels and high-contrast focus states using a 2px blue ring. Error messages should be displayed in a saturated red with a supporting icon.
- **Status Indicators:** Use small, pill-shaped chips for availability (e.g., "Accepting Patients" in a soft green background with dark green text).
- **Service Lists:** Use large icons with "Trust Teal" accents and `body-lg` text to help patients navigate between departments like Cardiology, Pediatrics, or Radiology.
- **Alert Banners:** Top-of-page banners for urgent hospital announcements (e.g., visitor policy changes) should use a high-contrast background but maintain the system's rounded corner logic.