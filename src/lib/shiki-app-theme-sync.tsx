/**
 * ShikiAppThemeSync was previously responsible for deriving the entire app
 * color palette from the active Shiki code theme.  The app now uses curated
 * light/dark palettes defined in styles.css, so this component is a no-op.
 *
 * It is kept as a stub so the route/provider tree does not need restructuring.
 */
export function ShikiAppThemeSync() {
    return null;
}
