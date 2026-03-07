/**
 * AdManager — Manages ad placeholder injection based on viewport size.
 * Placeholder divs are injected dynamically; ready for Google Ads integration.
 */

const BREAKPOINTS = {
  SMALL: 600,
  MEDIUM: 1024,
  LARGE: 1440,
};

const AdManager = {
  _bannerContainer: null,
  _sidebarContainer: null,
  _resizeObserver: null,

  /**
   * Initialize ad manager and inject placeholders.
   * @param {object} options
   * @param {HTMLElement} options.bannerContainer — Element to inject banner ads into
   * @param {HTMLElement} options.sidebarContainer — Element to inject sidebar ads into
   */
  init({ bannerContainer, sidebarContainer }) {
    this._bannerContainer = bannerContainer;
    this._sidebarContainer = sidebarContainer;

    this._updateSlots();

    // Listen for viewport changes
    window.addEventListener('resize', this._debounce(this._updateSlots.bind(this), 250));

    console.log('[AdManager] Initialized');
  },

  /**
   * Update ad slots based on current viewport width.
   */
  _updateSlots() {
    const width = window.innerWidth;

    // Clear existing
    if (this._bannerContainer) this._bannerContainer.innerHTML = '';
    if (this._sidebarContainer) this._sidebarContainer.innerHTML = '';

    if (width < BREAKPOINTS.SMALL) {
      // Mobile: 1 banner
      this._injectBanner(this._bannerContainer, 'banner-1');
    } else if (width < BREAKPOINTS.MEDIUM) {
      // Tablet: 1 banner + 1 sidebar
      this._injectBanner(this._bannerContainer, 'banner-1');
      this._injectSidebar(this._sidebarContainer, 'sidebar-1');
    } else if (width < BREAKPOINTS.LARGE) {
      // Desktop: 1 banner + 2 sidebars
      this._injectBanner(this._bannerContainer, 'banner-1');
      this._injectSidebar(this._sidebarContainer, 'sidebar-1');
      this._injectSidebar(this._sidebarContainer, 'sidebar-2');
    } else {
      // TV: 2 banners + 2 sidebars
      this._injectBanner(this._bannerContainer, 'banner-1');
      this._injectBanner(this._bannerContainer, 'banner-2');
      this._injectSidebar(this._sidebarContainer, 'sidebar-1');
      this._injectSidebar(this._sidebarContainer, 'sidebar-2');
    }
  },

  /**
   * Inject a banner ad placeholder.
   * @param {HTMLElement} container
   * @param {string} slotId
   */
  _injectBanner(container, slotId) {
    if (!container) return;
    const slot = document.createElement('div');
    slot.className = 'ad-slot ad-slot--banner';
    slot.id = `ad-${slotId}`;
    slot.setAttribute('data-ad-slot', slotId);
    slot.setAttribute('aria-hidden', 'true');
    slot.textContent = `Ad Placeholder — ${slotId}`;
    container.appendChild(slot);
  },

  /**
   * Inject a sidebar ad placeholder.
   * @param {HTMLElement} container
   * @param {string} slotId
   */
  _injectSidebar(container, slotId) {
    if (!container) return;
    const slot = document.createElement('div');
    slot.className = 'ad-slot ad-slot--sidebar';
    slot.id = `ad-${slotId}`;
    slot.setAttribute('data-ad-slot', slotId);
    slot.setAttribute('aria-hidden', 'true');
    slot.textContent = `Ad Placeholder — ${slotId}`;
    container.appendChild(slot);
  },

  /**
   * Replace a placeholder with a real ad script (future use).
   * @param {string} slotId
   * @param {string} adUnitCode — Google Ads unit code
   */
  loadAd(slotId, adUnitCode) {
    const el = document.getElementById(`ad-${slotId}`);
    if (!el) return;
    // Future: insert Google Ads <ins> tag or call googletag
    el.innerHTML = `<!-- Google Ad: ${adUnitCode} -->`;
    console.log(`[AdManager] Ad loaded in slot "${slotId}" with code: ${adUnitCode}`);
  },

  /**
   * Simple debounce utility.
   * @private
   */
  _debounce(fn, ms) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), ms);
    };
  },

  /**
   * Destroy and clean up.
   */
  destroy() {
    window.removeEventListener('resize', this._updateSlots);
    if (this._bannerContainer) this._bannerContainer.innerHTML = '';
    if (this._sidebarContainer) this._sidebarContainer.innerHTML = '';
  },
};

export default AdManager;
