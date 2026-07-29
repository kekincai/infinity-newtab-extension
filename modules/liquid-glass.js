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
  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }
  function lerp(from, to, progress) {
    return from + (to - from) * progress;
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
    motion = { entrance: null, exit: null };
    observer = null;
    filter = null;
    filterImages = [];
    hideTimer = null;
    isBetween = false;
    connectedCallback() {
      this.classList.add("liquid-glass-group");
      this.ensureFilter();
      this.ensureLens();
      this.addEventListener("pointerover", this.onPointerOver);
      this.addEventListener("pointerout", this.onPointerOut);
      this.addEventListener("pointerleave", this.onPointerLeave);
      this.addEventListener("focusin", this.onFocusIn);
      this.addEventListener("focusout", this.onFocusOut);
      window.addEventListener("pointermove", this.onWindowPointerMove, { passive: true });
      this.observer = new MutationObserver(() => {
        if (this.target && !this.target.isConnected) {
          this.target = null;
          this.isBetween = false;
        }
        this.ensureLens();
      });
      this.observer.observe(this, { childList: true });
    }
    disconnectedCallback() {
      this.cancelScheduledHide();
      this.motion.entrance?.cancel();
      this.motion.exit?.cancel();
      this.observer?.disconnect();
      this.filter?.remove();
      this.removeEventListener("pointerover", this.onPointerOver);
      this.removeEventListener("pointerout", this.onPointerOut);
      this.removeEventListener("pointerleave", this.onPointerLeave);
      this.removeEventListener("focusin", this.onFocusIn);
      this.removeEventListener("focusout", this.onFocusOut);
      window.removeEventListener("pointermove", this.onWindowPointerMove);
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
        this.target = null;
        this.isBetween = false;
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
    show(item) {
      if (!document.body.classList.contains("enhanced-animations")) return;
      this.cancelScheduledHide();
      const lens = this.ensureLens();
      if (!lens) return;
      const wasVisible = lens.classList.contains("is-visible");
      if (wasVisible && this.target === item && !this.isBetween) return;
      this.motion.entrance?.cancel();
      this.motion.exit?.cancel();
      this.motion.exit = null;
      this.target = item;
      this.isBetween = false;
      this.render(this.lensRectFor(item));
      lens.classList.add("is-visible");
      if (wasVisible) return;
      this.motion.entrance = lens.animate(
        [{ opacity: 0, scale: 0.92 }, { opacity: 1, scale: 1 }],
        { duration: 160, easing: "cubic-bezier(0.2, 0.85, 0.25, 1)" }
      );
      const animation = this.motion.entrance;
      animation.addEventListener("finish", () => {
        if (this.motion.entrance === animation) this.motion.entrance = null;
      }, { once: true });
    }
    render(rect) {
      const lens = this.lens;
      if (!lens) return;
      this.sizeFilter(rect);
      lens.style.width = `${rect.width}px`;
      lens.style.height = `${rect.height}px`;
      lens.style.borderRadius = rect.radius;
      lens.style.transform = `translate3d(${rect.x - lens.offsetLeft}px, ${rect.y - lens.offsetTop}px, 0)`;
    }
    renderBetween(pointer) {
      const source = this.target;
      if (!source?.isConnected) return;
      const destination = this.nearestOtherItem(pointer, source);
      if (!destination) return;
      const from = this.lensRectFor(source);
      const to = this.lensRectFor(destination);
      const fromCenter = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
      const toCenter = { x: to.x + to.width / 2, y: to.y + to.height / 2 };
      const dx = toCenter.x - fromCenter.x;
      const dy = toCenter.y - fromCenter.y;
      const distanceSquared = dx * dx + dy * dy;
      if (!distanceSquared) return;
      const progress = clamp(
        ((pointer.x - fromCenter.x) * dx + (pointer.y - fromCenter.y) * dy) / distanceSquared,
        0,
        1
      );
      const blend = Math.sin(Math.PI * progress);
      const distance = Math.sqrt(distanceSquared);
      const horizontal = Math.abs(dx) >= Math.abs(dy);
      let width = lerp(from.width, to.width, progress);
      let height = lerp(from.height, to.height, progress);
      const stretch = Math.min(58, distance * 0.22) * blend;
      if (horizontal) {
        width += stretch;
        height *= 1 - blend * 0.055;
      } else {
        height += stretch;
        width *= 1 - blend * 0.055;
      }
      const centerX = lerp(fromCenter.x, toCenter.x, progress);
      const centerY = lerp(fromCenter.y, toCenter.y, progress);
      const fromRadius = Number.parseFloat(from.radius) || Math.min(from.width, from.height) / 2;
      const toRadius = Number.parseFloat(to.radius) || Math.min(to.width, to.height) / 2;
      const radius = this.dataset.liquidVariant === "cards" ? `${lerp(fromRadius, toRadius, progress) + blend * 4}px` : "999px";
      this.isBetween = true;
      this.render({
        x: centerX - width / 2,
        y: centerY - height / 2,
        width,
        height,
        radius
      });
    }
    nearestOtherItem(pointer, source) {
      const groupRect = this.getBoundingClientRect();
      let nearest = null;
      let nearestDistance = Number.POSITIVE_INFINITY;
      this.items.forEach((item) => {
        if (item === source) return;
        const rect = item.getBoundingClientRect();
        const centerX = rect.left - groupRect.left + rect.width / 2;
        const centerY = rect.top - groupRect.top + rect.height / 2;
        const distance = Math.hypot(pointer.x - centerX, pointer.y - centerY);
        if (distance < nearestDistance) {
          nearest = item;
          nearestDistance = distance;
        }
      });
      return nearest;
    }
    hide() {
      this.cancelScheduledHide();
      const lens = this.lens;
      if (!lens?.classList.contains("is-visible")) return;
      this.motion.entrance?.cancel();
      this.motion.exit?.cancel();
      this.motion.entrance = null;
      this.target = null;
      this.isBetween = false;
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
    scheduleHide() {
      if (this.hideTimer !== null) return;
      this.hideTimer = window.setTimeout(() => {
        this.hideTimer = null;
        this.hide();
      }, 320);
    }
    cancelScheduledHide() {
      if (this.hideTimer === null) return;
      window.clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    onPointerOver = (event) => {
      const item = this.findItem(event.target);
      if (item) this.show(item);
    };
    onWindowPointerMove = (event) => {
      const item = this.findItem(event.target);
      if (item) {
        this.show(item);
        return;
      }
      this.updateFromPointer(event);
    };
    updateFromPointer(event) {
      const lens = this.lens;
      if (!lens?.classList.contains("is-visible") || !this.target) return;
      const groupRect = this.getBoundingClientRect();
      const margin = 16;
      const inside = event.clientX >= groupRect.left - margin && event.clientX <= groupRect.right + margin && event.clientY >= groupRect.top - margin && event.clientY <= groupRect.bottom + margin;
      if (!inside) {
        this.scheduleHide();
        return;
      }
      this.cancelScheduledHide();
      this.motion.entrance?.cancel();
      this.motion.entrance = null;
      this.renderBetween({
        x: event.clientX - groupRect.left,
        y: event.clientY - groupRect.top
      });
    }
    onPointerOut = (event) => {
      const item = this.findItem(event.target);
      const relatedNode = event.relatedTarget instanceof Node ? event.relatedTarget : null;
      if (!item || item.contains(relatedNode)) return;
      if (this.findItem(event.relatedTarget)) return;
      this.scheduleHide();
    };
    onPointerLeave = () => this.scheduleHide();
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
