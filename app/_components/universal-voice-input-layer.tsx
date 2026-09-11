"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { voiceInputFieldAllowed } from "../../lib/voice-input";
import VoiceInputControl from "./voice-input-control";

type VoiceField = HTMLInputElement | HTMLTextAreaElement;

type Position = { top: number; left: number };

function fieldDescriptor(field: VoiceField) {
  return [
    field.id,
    field.getAttribute("name"),
    field.getAttribute("placeholder"),
    field.getAttribute("aria-label"),
    field.getAttribute("autocomplete"),
    field.getAttribute("data-purpose"),
  ].filter(Boolean).join(" ");
}

function eligibleField(value: EventTarget | null): VoiceField | null {
  if (!(value instanceof HTMLInputElement) && !(value instanceof HTMLTextAreaElement)) return null;
  if (value instanceof HTMLInputElement && !["text", "search"].includes(value.type || "text")) return null;
  const explicit = value.getAttribute("data-voice-input");
  const voiceInput = explicit === "false" ? false : true;
  return voiceInputFieldAllowed({
    type: value instanceof HTMLTextAreaElement ? "textarea" : value.type,
    inputMode: value.inputMode,
    autocomplete: value.autocomplete,
    descriptor: fieldDescriptor(value),
    disabled: value.disabled,
    readOnly: value.readOnly,
    voiceInput,
  }) ? value : null;
}

function setNativeFieldValue(field: VoiceField, value: string) {
  const prototype = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (!setter) throw new Error("This text field cannot accept local dictation.");
  setter.call(field, value);
  field.dispatchEvent(new Event("input", { bubbles: true }));
}

export default function UniversalVoiceInputLayer() {
  const [target, setTarget] = useState<VoiceField | null>(null);
  const [value, setValue] = useState("");
  const [position, setPosition] = useState<Position | null>(null);
  const fieldRef = useRef<VoiceField | null>(null);
  const layerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fieldRef.current = target;
  }, [target]);

  useEffect(() => {
    const reposition = () => {
      const field = fieldRef.current;
      if (!field || !document.contains(field)) {
        setPosition(null);
        return;
      }
      const rect = field.getBoundingClientRect();
      setPosition({
        top: Math.max(6, Math.min(window.innerHeight - 44, rect.top + 6)),
        left: Math.max(6, Math.min(window.innerWidth - 44, rect.right - 42)),
      });
    };
    const focus = (event: FocusEvent) => {
      if (event.target instanceof Node && layerRef.current?.contains(event.target)) return;
      const next = eligibleField(event.target);
      fieldRef.current = next;
      setTarget(next);
      setValue(next?.value ?? "");
      window.requestAnimationFrame(reposition);
    };
    const input = (event: Event) => {
      if (event.target === fieldRef.current) setValue(fieldRef.current?.value ?? "");
    };
    const blur = () => window.requestAnimationFrame(() => {
      const active = document.activeElement;
      if (active instanceof Node && layerRef.current?.contains(active)) return;
      if (active === fieldRef.current) return;
      const next = eligibleField(active);
      if (!next) {
        fieldRef.current = null;
        setTarget(null);
        setPosition(null);
      }
    });
    document.addEventListener("focusin", focus, true);
    document.addEventListener("input", input, true);
    document.addEventListener("focusout", blur, true);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      document.removeEventListener("focusin", focus, true);
      document.removeEventListener("input", input, true);
      document.removeEventListener("focusout", blur, true);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, []);

  if (!target || !position) return null;

  const style = {
    position: "fixed",
    top: `${position.top}px`,
    left: `${position.left}px`,
    zIndex: 2147483000,
    pointerEvents: "auto",
  } satisfies CSSProperties;

  return (
    <div ref={layerRef} style={style} data-plotpickle-universal-voice-input="true">
      <VoiceInputControl
        value={value}
        onValueChange={(next) => {
          const field = fieldRef.current;
          if (!field) return;
          setNativeFieldValue(field, next);
          setValue(next);
        }}
        inputRef={fieldRef}
        disabled={target.disabled || target.readOnly}
        inputType={target instanceof HTMLTextAreaElement ? "textarea" : target.type}
        purpose="natural-language"
      />
    </div>
  );
}
