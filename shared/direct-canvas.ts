// Serialized into each sandbox. Reject anything requiring browser compositing.
export function directCanvas(
  width: number,
  height: number,
): HTMLCanvasElement | string | false {
  const canvas = document.querySelector("canvas");
  if (
    !canvas ||
    canvas.width !== width ||
    canvas.height !== height ||
    innerWidth !== width ||
    innerHeight !== height
  )
    return false;
  // A full-frame canvas may be wrapped in neutral layout containers. Every
  // ancestor must pass the same compositing and geometry checks as the canvas.
  const ancestors: HTMLElement[] = [];
  for (let node = canvas.parentElement; node; node = node.parentElement)
    ancestors.push(node);
  if (!ancestors.includes(document.body)) return false;
  const allowed = new Set([
    "HTML",
    "HEAD",
    "BODY",
    "META",
    "STYLE",
    "SCRIPT",
    "TITLE",
    "CANVAS",
  ]);
  for (const element of document.querySelectorAll("*")) {
    if (
      (!allowed.has(element.tagName) &&
        !ancestors.includes(element as HTMLElement)) ||
      element.shadowRoot ||
      (element.tagName === "CANVAS" && element !== canvas)
    )
      return false;
  }
  if (
    ancestors.some((element) =>
      [...element.childNodes].some(
        (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
      ),
    )
  )
    return false;
  for (const element of [...ancestors, canvas]) {
    const style = getComputedStyle(element);
    for (const [property, expected] of Object.entries({
      opacity: "1",
      visibility: "visible",
      filter: "none",
      "backdrop-filter": "none",
      "mix-blend-mode": "normal",
      "clip-path": "none",
      "mask-image": "none",
      "-webkit-mask-box-image-source": "none",
      "offset-path": "none",
      content: "normal",
      clip: "auto",
      "box-shadow": "none",
      "border-top-width": "0px",
      "border-right-width": "0px",
      "border-bottom-width": "0px",
      "border-left-width": "0px",
      "border-top-left-radius": "0px",
      "border-top-right-radius": "0px",
      "border-bottom-left-radius": "0px",
      "border-bottom-right-radius": "0px",
      "outline-style": "none",
      "padding-top": "0px",
      "padding-left": "0px",
      "padding-right": "0px",
      "padding-bottom": "0px",
      perspective: "none",
      translate: "none",
      rotate: "none",
      scale: "none",
      zoom: "1",
      "-webkit-box-reflect": "none",
      "content-visibility": "visible",
    }))
      if (style.getPropertyValue(property) !== expected)
        return `${element.tagName} ${property}: ${style.getPropertyValue(property)}`;
    if (
      style.transform !== "none" &&
      style.transform !== "matrix(1, 0, 0, 1, 0, 0)"
    )
      return false;
    for (const pseudo of ["::before", "::after"]) {
      const content = getComputedStyle(element, pseudo).content;
      if (content !== "none" && content !== "normal") return false;
    }
  }
  const rect = canvas.getBoundingClientRect();
  if (
    rect.x !== 0 ||
    rect.y !== 0 ||
    rect.width !== width ||
    rect.height !== height
  )
    return false;
  for (const element of ancestors) {
    const rootRect = element.getBoundingClientRect();
    if (
      rootRect.x !== 0 ||
      rootRect.y !== 0 ||
      rootRect.width !== width ||
      rootRect.height !== height
    )
      return false;
  }

  return canvas;
}
