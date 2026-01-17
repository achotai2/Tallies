export const createElement = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: { className?: string; text?: string } = {}
): HTMLElementTagNameMap[K] => {
  const element = document.createElement(tag);
  if (options.className) {
    element.className = options.className;
  }
  if (options.text !== undefined) {
    element.textContent = options.text;
  }
  return element;
};
