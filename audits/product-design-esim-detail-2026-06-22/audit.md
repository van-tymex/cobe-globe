# eSIM Detail Screen Audit

Source: Figma node `13887:18808` from `10 VAS Bill UI 2.0 MASTER`.
Captured: 2026-06-22.
Screenshot: `01-esim-detail.png` at 375 x 812.
Figma audit file: https://www.figma.com/design/GM5Xg7IlnqtQDuWqbho1qH

## Step List

1. eSIM detail screen
   - Health: Mostly clear and visually consistent.
   - Risk level: Medium, mainly around state clarity and non-text contrast.
   - Evidence: `01-esim-detail.png`.

## Audit Scope

Single mobile detail screen for an eSIM plan: nav, Japan/Active usage summary, setup guidance banner, plan details list, and fixed Top up dock.

## Strengths

- Clear country-first heading and prominent plan status.
- Strong spacing rhythm: header, guidance card, plan details, and bottom action are easy to scan.
- Plan details are compact and readable, with icons helping row recognition.
- Main text contrast is healthy in the captured colors.

## UX Risks

1. The usage bar conflicts with the numbers. The screen says `0GB` used and `20GB` remaining, but the bar shows a visible filled segment. That can read as data already consumed or progress already advanced.
2. The action hierarchy is mixed. The banner asks the user to turn on the eSIM, while the persistent primary button is `Top up`. If setup is incomplete, activation guidance probably needs stronger priority than topping up.
3. `Active` can be ambiguous. It is not clear whether it means the plan is valid, the eSIM is installed, or data roaming is currently usable.
4. Help paths overlap. The top-right help icon and the list row `how it works` may lead to similar help, but the difference is not clear. The list row also uses lowercase copy while surrounding labels use title case.
5. The bottom dock looks safe in this 812px frame, but implementation still needs scroll and dynamic type checks so the fixed CTA does not cover list content.

## Accessibility Risks

- Progress bar contrast is about `1.13:1` against its track. If the bar communicates remaining or used data, it needs a stronger visual distinction or redundant text.
- Dividers are about `1.22:1` against the card background. This is acceptable only if decorative; do not rely on them as the only grouping cue.
- Screenshot evidence cannot verify focus order, screen-reader labels, actual hit areas, reduced motion, dynamic type, or whether the bottom CTA is reachable without overlap.

## Recommendations

1. Match the usage bar to the numbers. For `0GB` used, show an empty or near-empty consumed bar, or label the filled segment explicitly if it means something else.
2. Make setup state drive the CTA. If the eSIM is not turned on, use `Turn on eSIM` or `How to turn on eSIM` as the primary path; keep `Top up` secondary until setup is done.
3. Clarify the status badge copy, for example `Plan active`, `eSIM installed`, or `Ready to use` depending on the actual state.
4. Merge or differentiate the help entries. Rename the row to `How eSIM works` or `Setup guide` if it is distinct from global help.
5. Increase non-text contrast for the progress indicator, or add a visible percentage/text label so color is not the only signal.
6. Test the implemented screen with VoiceOver, keyboard/focus order where applicable, 200% text, and shorter device heights.

## Evidence Limits

This audit is based on the Figma screenshot captured in this run plus the visible Figma layer context. It does not prove runtime accessibility, localization behavior, scroll behavior, loading states, error states, or device-specific safe-area handling.
