function neutralizeTooltipLinks(svgElement: SVGSVGElement): void {
  svgElement.querySelectorAll('a').forEach((anchor) => {
    const href =
      anchor.getAttribute('href') ??
      anchor.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
    if (href !== '#') {
      return;
    }

    anchor.addEventListener('click', (event) => {
      event.preventDefault();
    });
    anchor.removeAttribute('href');
    anchor.removeAttributeNS('http://www.w3.org/1999/xlink', 'href');
    anchor.style.cursor = 'inherit';
  });

  svgElement.querySelectorAll('.clickable').forEach((node) => {
    node.classList.remove('clickable');
  });
}

function applyNodeTooltips(
  svgElement: SVGSVGElement,
  nodeTooltips: Record<string, string>
): void {
  for (const [nodeId, tooltip] of Object.entries(nodeTooltips)) {
    const nodeElement =
      svgElement.querySelector(`[id^="flowchart-${nodeId}-"]`) ??
      svgElement.querySelector(`[id^="classId-${nodeId}-"]`);
    if (!(nodeElement instanceof Element)) {
      continue;
    }

    nodeElement.setAttribute('data-mermaid-tooltip', tooltip);
    nodeElement.setAttribute('tabindex', '0');
    nodeElement.setAttribute('role', 'button');
    nodeElement.setAttribute('aria-label', tooltip);
    nodeElement.removeAttribute('title');

    if (nodeElement instanceof SVGElement) {
      nodeElement.style.cursor = 'help';
    }
  }
}

export function finalizeMermaidSvg(
  svgElement: SVGSVGElement,
  nodeTooltips: Record<string, string>
): void {
  neutralizeTooltipLinks(svgElement);
  applyNodeTooltips(svgElement, nodeTooltips);
}
