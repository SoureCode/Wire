/**
 * Client-side replay registry for the Twig filters Wire's compile-time
 * extractor whitelists. Each entry is `(value, ...args) => transformed`.
 * Names match Twig filter names exactly so the JSON marker chain can be
 * applied without translation.
 */
export const FILTERS = {
    upper(value) {
        return value == null ? '' : String(value).toUpperCase();
    },
    lower(value) {
        return value == null ? '' : String(value).toLowerCase();
    },
    trim(value) {
        return value == null ? '' : String(value).trim();
    },
    capitalize(value) {
        if (value == null) return '';
        const s = String(value).toLowerCase();
        return s.length === 0 ? '' : s.charAt(0).toUpperCase() + s.slice(1);
    },
    length(value) {
        if (value == null) return 0;
        if (Array.isArray(value)) return value.length;
        if (typeof value === 'object') return Object.keys(value).length;
        return String(value).length;
    },
    abs(value) {
        return Math.abs(Number(value));
    },
    default(value, fallback) {
        return value == null || value === '' ? fallback : value;
    },
    nl2br(value) {
        return value == null ? '' : String(value).replace(/\n/g, '<br>');
    },
    escape(value) {
        // Default text-context binding writes via textContent which already
        // escapes; an explicit `|escape` is therefore a no-op transform.
        return value == null ? '' : String(value);
    },
    e(value) {
        return FILTERS.escape(value);
    },
    raw(value) {
        // Value is unchanged; the binding-apply layer reads `raw` from the
        // filter chain to choose innerHTML over textContent. For attribute
        // bindings the marker is meaningless and the chain entry is ignored.
        return value == null ? '' : value;
    },
};

/**
 * Apply a filter chain to a value. Each entry is `[filterName, ...args]`.
 * Unknown filters short-circuit to the current value (server already
 * rendered the frozen output; we just don't update further).
 *
 * @param {unknown} value
 * @param {Array<Array<unknown>>|undefined} chain
 * @returns {unknown}
 */
export function applyFilters(value, chain) {
    if (!chain) return value;
    for (const [name, ...args] of chain) {
        const fn = FILTERS[name];
        if (!fn) return value;
        value = fn(value, ...args);
    }
    return value;
}
