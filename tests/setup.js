import 'fake-indexeddb/auto'
// jsdom n'implémente pas matchMedia ni ResizeObserver
if (!globalThis.matchMedia) globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })
if (!globalThis.ResizeObserver) globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }

if (typeof window !== "undefined") window.scrollTo = () => {}
