'use client';

import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from '@/components/ui/toast';

export function Toaster() {
  return (
    <ToastProvider>
      <ToastViewport>
        <Toast
          variant="default"
          className="bg-background border-border"
        >
          <div className="grid gap-1">
            <ToastTitle className="font-semibold" />
            <ToastDescription className="text-muted-foreground" />
          </div>
          <ToastClose />
        </Toast>
      </ToastViewport>
    </ToastProvider>
  );
}