/**
 * App chrome (TopAppBar `z-[1100]`, desktop Sidebar `z-[1200]`) normally sits
 * above page content. While a modal is open the chrome drops to this layer,
 * below every modal backdrop (`ui/Dialog` overlay `z-50`, page-wide modal
 * backdrops `z-40`), so the backdrop greys it out like the rest of the page
 * and a click on it dismisses the modal.
 */
export const CHROME_BELOW_MODAL_CLASS = 'z-30';
