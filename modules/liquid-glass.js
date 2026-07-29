"use strict";
(() => {
  // src/liquid-glass.ts
  var ITEM_SELECTOR = "[data-liquid-item]";
  var LENS_CLASS = "liquid-glass-lens";
  var SVG_NS = "http://www.w3.org/2000/svg";
  function smoothstep(start, end, value) {
    const amount = Math.max(0, Math.min(1, (value - start) / (end - start)));
    return amount * amount * (3 - 2 * amount);
  }
  function createDisplacementMap(type, size = 256) {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) return "";
    const image = context.createImageData(size, size);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const nx = (x + 0.5) / size * 2 - 1;
        const ny = (y + 0.5) / size * 2 - 1;
        const distance = Math.hypot(nx, ny);
        let displacementX = 0;
        let displacementY = 0;
        if (distance < 1) {
          if (type === "zoom") {
            const zoom = 1 - smoothstep(0.08, 0.9, distance);
            displacementX = -nx * zoom * 0.74;
            displacementY = -ny * zoom * 0.74;
          } else {
            const rim = smoothstep(0.48, 0.82, distance) * (1 - smoothstep(0.82, 1, distance));
            const directionX = distance ? nx / distance : 0;
            const directionY = distance ? ny / distance : 0;
            displacementX = -directionX * rim;
            displacementY = -directionY * rim;
          }
        }
        const offset = (y * size + x) * 4;
        image.data[offset] = Math.round(128 + displacementX * 127);
        image.data[offset + 1] = Math.round(128 + displacementY * 127);
        image.data[offset + 2] = 128;
        image.data[offset + 3] = 255;
      }
    }
    context.putImageData(image, 0, 0);
    return canvas.toDataURL("image/png");
  }
  function createSpecularMap(size = 256) {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) return "";
    const image = context.createImageData(size, size);
    const light = { x: -0.68, y: -0.74 };
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const nx = (x + 0.5) / size * 2 - 1;
        const ny = (y + 0.5) / size * 2 - 1;
        const distance = Math.hypot(nx, ny);
        const directionX = distance ? nx / distance : 0;
        const directionY = distance ? ny / distance : 0;
        const rim = smoothstep(0.56, 0.84, distance) * (1 - smoothstep(0.9, 1, distance));
        const facingLight = Math.max(0, directionX * light.x + directionY * light.y);
        const alpha = distance < 1 ? rim * (0.22 + facingLight * 0.78) : 0;
        const offset = (y * size + x) * 4;
        image.data[offset] = 255;
        image.data[offset + 1] = 255;
        image.data[offset + 2] = 255;
        image.data[offset + 3] = Math.round(alpha * 220);
      }
    }
    context.putImageData(image, 0, 0);
    return canvas.toDataURL("image/png");
  }
  var opticalMaps = {
    zoom: createDisplacementMap("zoom"),
    bezel: createDisplacementMap("bezel"),
    specular: createSpecularMap()
  };
  function createSvgElement(name, attributes) {
    const element = document.createElementNS(SVG_NS, name);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
    return element;
  }
  var LiquidGlassGroup = class _LiquidGlassGroup extends HTMLElement {
    static nextFilterId = 0;
    lens = null;
    target = null;
    motion = { movement: null, exit: null };
    observer = null;
    filter = null;
    filterImages = [];
    connectedCallback() {
      this.classList.add("liquid-glass-group");
      this.ensureFilter();
      this.ensureLens();
      this.addEventListener("pointerover", this.onPointerOver);
      this.addEventListener("pointerout", this.onPointerOut);
      this.addEventListener("pointerleave", this.onPointerLeave);
      this.addEventListener("focusin", this.onFocusIn);
      this.addEventListener("focusout", this.onFocusOut);
      this.observer = new MutationObserver(() => this.ensureLens());
      this.observer.observe(this, { childList: true });
    }
    disconnectedCallback() {
      this.motion.movement?.cancel();
      this.motion.exit?.cancel();
      this.observer?.disconnect();
      this.filter?.remove();
      this.removeEventListener("pointerover", this.onPointerOver);
      this.removeEventListener("pointerout", this.onPointerOut);
      this.removeEventListener("pointerleave", this.onPointerLeave);
      this.removeEventListener("focusin", this.onFocusIn);
      this.removeEventListener("focusout", this.onFocusOut);
    }
    ensureFilter() {
      if (this.filter?.isConnected) return this.filter;
      const defs = document.getElementById("liquidFilterDefs");
      if (!(defs instanceof SVGDefsElement)) return null;
      const id = `liquid-glass-lens-${_LiquidGlassGroup.nextFilterId += 1}`;
      const filter = createSvgElement("filter", {
        id,
        colorInterpolationFilters: "sRGB"
      });
      const zoomMap = createSvgElement("feImage", {
        href: opticalMaps.zoom,
        x: "0",
        y: "0",
        width: "1",
        height: "1",
        preserveAspectRatio: "none",
        result: "magnifying_displacement_map",
        "data-liquid-map": "zoom"
      });
      const zoom = createSvgElement("feDisplacementMap", {
        in: "SourceGraphic",
        in2: "magnifying_displacement_map",
        scale: "24",
        xChannelSelector: "R",
        yChannelSelector: "G",
        result: "magnified_source"
      });
      const blur = createSvgElement("feGaussianBlur", {
        in: "magnified_source",
        stdDeviation: "0.18",
        result: "blurred_source"
      });
      const bezelMap = createSvgElement("feImage", {
        href: opticalMaps.bezel,
        x: "0",
        y: "0",
        width: "1",
        height: "1",
        preserveAspectRatio: "none",
        result: "displacement_map",
        "data-liquid-map": "bezel"
      });
      const bezel = createSvgElement("feDisplacementMap", {
        in: "blurred_source",
        in2: "displacement_map",
        scale: "38",
        xChannelSelector: "R",
        yChannelSelector: "G",
        result: "displaced"
      });
      const saturation = createSvgElement("feColorMatrix", {
        in: "displaced",
        type: "saturate",
        values: "4",
        result: "displaced_saturated"
      });
      const specularMap = createSvgElement("feImage", {
        href: opticalMaps.specular,
        x: "0",
        y: "0",
        width: "1",
        height: "1",
        preserveAspectRatio: "none",
        result: "specular_layer",
        "data-liquid-map": "specular"
      });
      const specularMask = createSvgElement("feComposite", {
        in: "displaced_saturated",
        in2: "specular_layer",
        operator: "in",
        result: "specular_saturated"
      });
      const specularFade = createSvgElement("feComponentTransfer", {
        in: "specular_layer",
        result: "specular_faded"
      });
      specularFade.appendChild(createSvgElement("feFuncA", {
        type: "linear",
        slope: "0.46"
      }));
      const saturationBlend = createSvgElement("feBlend", {
        in: "specular_saturated",
        in2: "displaced",
        mode: "normal",
        result: "withSaturation"
      });
      const finalBlend = createSvgElement("feBlend", {
        in: "specular_faded",
        in2: "withSaturation",
        mode: "normal"
      });
      filter.append(
        zoomMap,
        zoom,
        blur,
        bezelMap,
        bezel,
        saturation,
        specularMap,
        specularMask,
        specularFade,
        saturationBlend,
        finalBlend
      );
      defs.appendChild(filter);
      this.filter = filter;
      this.filterImages = [zoomMap, bezelMap, specularMap];
      return filter;
    }
    sizeFilter(rect) {
      this.filterImages.forEach((image) => {
        image.setAttribute("width", `${Math.round(rect.width)}`);
        image.setAttribute("height", `${Math.round(rect.height)}`);
      });
    }
    ensureLens() {
      if (this.items.length < 2) {
        this.lens?.remove();
        this.lens = null;
        return null;
      }
      if (this.lens?.isConnected && this.lens.parentElement === this) return this.lens;
      const lens = document.createElement("span");
      lens.className = LENS_CLASS;
      lens.setAttribute("aria-hidden", "true");
      const filter = this.ensureFilter();
      if (filter) lens.style.setProperty("--liquid-lens-filter", `url("#${filter.id}")`);
      this.appendChild(lens);
      this.lens = lens;
      return lens;
    }
    get items() {
      return Array.from(this.children).filter(
        (child) => child instanceof HTMLElement && child.matches(ITEM_SELECTOR)
      );
    }
    findItem(eventTarget) {
      const item = eventTarget instanceof Element ? eventTarget.closest(ITEM_SELECTOR) : null;
      return item instanceof HTMLElement && item.parentElement === this ? item : null;
    }
    lensRectFor(item) {
      const groupRect = this.getBoundingClientRect();
      const itemRect = item.getBoundingClientRect();
      const isCard = this.dataset.liquidVariant === "cards";
      const extraX = isCard ? 18 : Math.min(34, itemRect.height * 0.58);
      const extraY = isCard ? 18 : Math.min(22, itemRect.height * 0.4);
      const itemRadius = Number.parseFloat(getComputedStyle(item).borderRadius) || 22;
      return {
        x: itemRect.left - groupRect.left - extraX / 2,
        y: itemRect.top - groupRect.top - extraY / 2,
        width: itemRect.width + extraX,
        height: itemRect.height + extraY,
        radius: isCard ? `${itemRadius + extraY / 2}px` : "999px"
      };
    }
    renderedLensRect(lens) {
      const groupRect = this.getBoundingClientRect();
      const lensRect = lens.getBoundingClientRect();
      return {
        x: lensRect.left - groupRect.left,
        y: lensRect.top - groupRect.top,
        width: lensRect.width,
        height: lensRect.height,
        radius: lens.style.borderRadius || "999px"
      };
    }
    frameFor(lens, rect, opacity = 1) {
      return {
        transform: `translate3d(${rect.x - lens.offsetLeft}px, ${rect.y - lens.offsetTop}px, 0)`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        borderRadius: rect.radius,
        opacity
      };
    }
    show(item) {
      if (!document.body.classList.contains("enhanced-animations")) return;
      const lens = this.ensureLens();
      if (!lens || this.target === item && lens.classList.contains("is-visible")) return;
      const wasVisible = lens.classList.contains("is-visible");
      const from = wasVisible ? this.renderedLensRect(lens) : this.lensRectFor(item);
      const to = this.lensRectFor(item);
      this.sizeFilter(to);
      const fromCenter = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
      const toCenter = { x: to.x + to.width / 2, y: to.y + to.height / 2 };
      const dx = toCenter.x - fromCenter.x;
      const dy = toCenter.y - fromCenter.y;
      const distance = Math.hypot(dx, dy);
      const horizontal = Math.abs(dx) >= Math.abs(dy);
      const middleWidth = (from.width + to.width) / 2 * (horizontal ? 1.2 : 0.96);
      const middleHeight = (from.height + to.height) / 2 * (horizontal ? 0.94 : 1.2);
      const middle = {
        x: fromCenter.x + dx * 0.52 - middleWidth / 2,
        y: fromCenter.y + dy * 0.52 - middleHeight / 2,
        width: middleWidth,
        height: middleHeight,
        radius: this.dataset.liquidVariant === "cards" ? "34px" : "999px"
      };
      this.motion.movement?.cancel();
      this.motion.exit?.cancel();
      this.target = item;
      lens.classList.add("is-visible");
      lens.style.width = `${to.width}px`;
      lens.style.height = `${to.height}px`;
      lens.style.borderRadius = to.radius;
      lens.style.transform = String(this.frameFor(lens, to).transform);
      const settledFrame = this.frameFor(lens, to);
      const frames = wasVisible ? [this.frameFor(lens, from), this.frameFor(lens, middle), settledFrame] : [
        { ...settledFrame, opacity: 0, transform: `${settledFrame.transform} scale(0.9)` },
        { ...settledFrame, opacity: 1, transform: `${settledFrame.transform} scale(1.035)`, offset: 0.72 },
        settledFrame
      ];
      const duration = wasVisible ? Math.max(340, Math.min(560, 300 + distance * 0.62)) : 240;
      lens.classList.toggle("is-moving", wasVisible);
      this.motion.movement = lens.animate(frames, {
        duration,
        easing: wasVisible ? "cubic-bezier(0.22, 0.78, 0.2, 1)" : "cubic-bezier(0.2, 0.85, 0.25, 1)"
      });
      const animation = this.motion.movement;
      animation.addEventListener("finish", () => {
        if (this.motion.movement !== animation) return;
        this.motion.movement = null;
        lens.classList.remove("is-moving");
      }, { once: true });
    }
    hide() {
      const lens = this.lens;
      if (!lens?.classList.contains("is-visible")) return;
      this.motion.movement?.cancel();
      this.motion.exit?.cancel();
      this.motion.movement = null;
      this.target = null;
      lens.classList.remove("is-moving");
      this.motion.exit = lens.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 150,
        easing: "ease-out",
        fill: "forwards"
      });
      const animation = this.motion.exit;
      animation.addEventListener("finish", () => {
        if (this.motion.exit !== animation) return;
        this.motion.exit = null;
        lens.classList.remove("is-visible");
        animation.cancel();
      }, { once: true });
    }
    onPointerOver = (event) => {
      const item = this.findItem(event.target);
      if (item) this.show(item);
    };
    onPointerOut = (event) => {
      const item = this.findItem(event.target);
      const relatedNode = event.relatedTarget instanceof Node ? event.relatedTarget : null;
      if (!item || item.contains(relatedNode)) return;
      if (this.findItem(event.relatedTarget)) return;
      this.hide();
    };
    onPointerLeave = () => this.hide();
    onFocusIn = (event) => {
      const item = this.findItem(event.target);
      if (item) this.show(item);
    };
    onFocusOut = (event) => {
      const relatedNode = event.relatedTarget instanceof Node ? event.relatedTarget : null;
      if (!this.contains(relatedNode)) this.hide();
    };
  };
  if (!customElements.get("liquid-glass-group")) {
    customElements.define("liquid-glass-group", LiquidGlassGroup);
  }
})();
