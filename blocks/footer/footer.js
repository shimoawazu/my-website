import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';

/**
 * loads and decorates the footer
 * @param {Element} block The footer block element
 */
export default async function decorate(block) {
  const footerMeta = getMetadata('footer');
  // console.log("Footer Meta:"+footerMeta);
  // console.log("Footer Meta:"+footerMeta.footer);

  block.textContent = '';

  // load footer fragment
  //const footerPath = footerMeta.footer || '/footer';
  //const footerPath = footerMeta || '/footer';

  //const fragment = await loadFragment(footerPath);

  const footerPath = footerMeta ? new URL(footerMeta).pathname : '/footer';
  console.log("Footer Path:"+footerPath);  
  const fragment = await loadFragment(footerPath);

  // decorate footer DOM
  const footer = document.createElement('div');
  while (fragment.firstElementChild) footer.append(fragment.firstElementChild);

  block.append(footer);
}
