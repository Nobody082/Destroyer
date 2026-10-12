"use client";

import React from "react";
import { ActionBar } from "@/components/ActionBar";
import { Dropzone } from "@/components/Dropzone";
import { EffectPicker } from "@/components/EffectPicker";
import { Header } from "@/components/Header";
import { Lightbox } from "@/components/Lightbox";
import { ResultsGallery } from "@/components/ResultsGallery";
import { SettingsPanel } from "@/components/SettingsPanel";
import { ToastViewport } from "@/components/ui/Toast";
import { AppStoreProvider } from "@/lib/store";

export default function AugLabPage() {
  return (
    <AppStoreProvider>
      <div className="min-h-dvh flex flex-col bg-bg text-text">
        <Header />

        <main className="flex-1 w-full max-w-[1680px] mx-auto p-3 sm:p-4 pb-20 md:pb-4 grid grid-cols-1 md:grid-cols-[320px_1fr] xl:grid-cols-[320px_1fr_420px] gap-4 items-start">
          {/* Left Column: Dropzone + Settings */}
          <div className="flex flex-col gap-4 min-w-0">
            <Dropzone />
            <SettingsPanel />
          </div>

          {/* Center Column: Effect Picker */}
          <div className="min-w-0">
            <EffectPicker />
          </div>

          {/* Right / Bottom Column: Results Gallery */}
          <div className="md:col-span-2 xl:col-span-1 min-w-0">
            <ResultsGallery />
          </div>
        </main>

        <ActionBar />
        <Lightbox />
        <ToastViewport />
      </div>
    </AppStoreProvider>
  );
}
